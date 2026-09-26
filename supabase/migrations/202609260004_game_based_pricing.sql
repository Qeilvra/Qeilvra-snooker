-- Timers remain operational, but a table visit is charged once per game.
alter table public.snooker_tables rename column hourly_rate to game_rate;
alter table public.bookings rename column hourly_rate to game_rate;
alter table public.table_sessions rename column hourly_rate to game_rate;

create or replace function public.start_table_session(p_table_id uuid, p_customer_id uuid default null, p_booking_id uuid default null)
returns public.table_sessions language plpgsql security definer set search_path = public as $$
declare v_table public.snooker_tables; v_session public.table_sessions; v_profile uuid := public.current_profile_id(); v_club uuid := public.current_club_id();
begin
  if v_profile is null then raise exception 'Not authenticated'; end if;
  select * into v_table from public.snooker_tables where id = p_table_id and club_id = v_club for update;
  if not found then raise exception 'Table not found'; end if;
  if p_customer_id is not null and not exists(select 1 from public.customers where id=p_customer_id and club_id=v_club) then raise exception 'Customer not found'; end if;
  if p_booking_id is not null and not exists(select 1 from public.bookings where id=p_booking_id and club_id=v_club and table_id=p_table_id and status='confirmed') then raise exception 'Booking not found'; end if;
  if v_table.status <> 'available' and not (v_table.status = 'reserved' and p_booking_id is not null) then raise exception 'Table is not available'; end if;
  insert into public.table_sessions(club_id, table_id, booking_id, customer_id, started_by, game_rate)
  values(v_club, v_table.id, p_booking_id, p_customer_id, v_profile, v_table.game_rate) returning * into v_session;
  update public.snooker_tables set status = 'occupied' where id = v_table.id;
  if p_booking_id is not null then update public.bookings set status = 'active' where id = p_booking_id and club_id = v_club; end if;
  insert into public.activity_logs(club_id,user_id,action,entity_type,entity_id) values(v_club,v_profile,'session_started','table_session',v_session.id);
  return v_session;
end $$;

create or replace function public.end_table_session(p_session_id uuid, p_rounding_minutes integer default 1)
returns public.table_sessions language plpgsql security definer set search_path = public as $$
declare v_session public.table_sessions; v_profile uuid := public.current_profile_id(); v_club uuid := public.current_club_id(); v_end timestamptz := now();
begin
  select * into v_session from public.table_sessions where id = p_session_id and club_id = v_club for update;
  if not found or v_session.status not in ('active','paused') then raise exception 'Session is already closed'; end if;
  update public.table_sessions set end_time=v_end, ended_by=v_profile, status='completed', table_charge=game_rate where id=p_session_id returning * into v_session;
  update public.snooker_tables set status='available' where id=v_session.table_id and status='occupied';
  if v_session.booking_id is not null then update public.bookings set status='completed' where id=v_session.booking_id; end if;
  insert into public.activity_logs(club_id,user_id,action,entity_type,entity_id,metadata) values(v_club,v_profile,'session_ended','table_session',v_session.id,jsonb_build_object('table_charge',v_session.table_charge));
  return v_session;
end $$;

create or replace function public.complete_order(p_table_id uuid, p_session_id uuid, p_items jsonb, p_discount numeric, p_tax numeric, p_payments jsonb, p_notes text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_club uuid := public.current_club_id(); v_profile uuid := public.current_profile_id(); v_order public.orders; v_session public.table_sessions; v_item jsonb; v_payment jsonb; v_product public.products; v_subtotal numeric := 0; v_table_charge numeric := 0; v_paid numeric := 0; v_order_no text; v_tax_rate numeric := 0;
begin
  if v_profile is null then raise exception 'Not authenticated'; end if;
  if jsonb_array_length(p_payments) = 0 then raise exception 'Payment is required'; end if;
  if p_session_id is null and jsonb_array_length(p_items) = 0 then raise exception 'Order is empty'; end if;
  if p_discount < 0 or p_tax < 0 then raise exception 'Invalid totals'; end if;
  if p_discount > 0 and not public.has_role(array['owner','manager']::public.app_role[]) then raise exception 'Discount requires manager permission'; end if;
  select coalesce((value #>> '{}')::numeric,0) into v_tax_rate from public.club_settings where club_id=v_club and key='tax_rate';
  v_tax_rate := coalesce(v_tax_rate,0);
  if p_session_id is not null then
    select * into v_session from public.table_sessions where id=p_session_id and club_id=v_club for update;
    if not found then raise exception 'Session not found'; end if;
    if v_session.status in ('active','paused') then v_session := public.end_table_session(v_session.id); end if;
    v_table_charge := v_session.table_charge;
    p_table_id := v_session.table_id;
  elsif p_table_id is not null and not exists(select 1 from public.snooker_tables where id=p_table_id and club_id=v_club) then raise exception 'Table not found'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and club_id=v_club and is_active for update;
    if not found then raise exception 'Product unavailable'; end if;
    if (v_item->>'quantity')::integer <= 0 then raise exception 'Invalid item quantity'; end if;
    if v_product.track_inventory and v_product.stock_quantity < (v_item->>'quantity')::integer then raise exception 'Insufficient stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + v_product.price * (v_item->>'quantity')::integer;
  end loop;
  if p_discount > v_subtotal + v_table_charge then raise exception 'Discount exceeds subtotal'; end if;
  p_tax := round((v_subtotal + v_table_charge - p_discount) * v_tax_rate / 100, 2);
  v_order_no := to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.orders(club_id,table_id,session_id,created_by,order_number,subtotal,table_charge,discount_amount,tax_amount,total_amount,payment_status,order_status,notes)
  values(v_club,p_table_id,p_session_id,v_profile,v_order_no,v_subtotal,v_table_charge,p_discount,p_tax,v_subtotal+v_table_charge-p_discount+p_tax,'unpaid','open',p_notes) returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid for update;
    insert into public.order_items(club_id,order_id,product_id,product_name,quantity,unit_price) values(v_club,v_order.id,v_product.id,v_product.name,(v_item->>'quantity')::integer,v_product.price);
    if v_product.track_inventory then
      update public.products set stock_quantity=stock_quantity-(v_item->>'quantity')::integer where id=v_product.id;
      insert into public.inventory_transactions(club_id,product_id,transaction_type,quantity,previous_quantity,new_quantity,reference_type,reference_id,created_by)
      values(v_club,v_product.id,'sale',-(v_item->>'quantity')::integer,v_product.stock_quantity,v_product.stock_quantity-(v_item->>'quantity')::integer,'order',v_order.id,v_profile);
    end if;
  end loop;
  for v_payment in select * from jsonb_array_elements(p_payments) loop
    if nullif(v_payment->>'amount','') is null then
      insert into public.payments(club_id,order_id,amount,payment_method,transaction_reference,received_by) values(v_club,v_order.id,v_order.total_amount-v_paid,(v_payment->>'method')::public.payment_method,v_payment->>'reference',v_profile);
      v_paid := v_order.total_amount;
    else
      v_paid := v_paid + (v_payment->>'amount')::numeric;
      insert into public.payments(club_id,order_id,amount,payment_method,transaction_reference,received_by) values(v_club,v_order.id,(v_payment->>'amount')::numeric,(v_payment->>'method')::public.payment_method,v_payment->>'reference',v_profile);
    end if;
  end loop;
  if v_paid <> v_order.total_amount then raise exception 'Payment total does not match order total'; end if;
  update public.orders set payment_status='paid', order_status='completed' where id=v_order.id returning * into v_order;
  insert into public.activity_logs(club_id,user_id,action,entity_type,entity_id,metadata) values(v_club,v_profile,'order_completed','order',v_order.id,jsonb_build_object('total',v_order.total_amount));
  return v_order;
end $$;
