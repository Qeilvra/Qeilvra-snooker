create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public
as $$ select id from public.profiles where auth_user_id = auth.uid() and is_active limit 1 $$;

create or replace function public.current_club_id()
returns uuid language sql stable security definer set search_path = public
as $$ select club_id from public.profiles where auth_user_id = auth.uid() and is_active limit 1 $$;

create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where auth_user_id = auth.uid() and is_active limit 1 $$;

create or replace function public.has_role(allowed public.app_role[])
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() = any(allowed), false) $$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_club_id() from public;
revoke all on function public.current_role() from public;
revoke all on function public.has_role(public.app_role[]) from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_club_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['clubs','profiles','snooker_tables','customers','bookings','table_sessions','product_categories','products','orders','order_items','payments','inventory_transactions','expenses','staff_shifts','activity_logs','club_settings','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy clubs_read on public.clubs for select to authenticated using (id = public.current_club_id());
create policy clubs_update on public.clubs for update to authenticated using (id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[])) with check (id = public.current_club_id());

create policy profiles_read on public.profiles for select to authenticated using (club_id = public.current_club_id());
create policy profiles_update_self on public.profiles for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid() and club_id = public.current_club_id());

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' and (new.role <> old.role or new.club_id <> old.club_id or new.auth_user_id <> old.auth_user_id) then
    raise exception 'Profile security fields can only be changed by a trusted server workflow';
  end if;
  return new;
end $$;
create trigger protect_profile_security_fields before update on public.profiles for each row execute function public.protect_profile_security_fields();

do $$
declare t text;
begin
  foreach t in array array['snooker_tables','customers','bookings','table_sessions','product_categories','products','orders','order_items','payments','inventory_transactions','expenses','staff_shifts','activity_logs','club_settings','notifications'] loop
    execute format('create policy %I_club_read on public.%I for select to authenticated using (club_id = public.current_club_id())', t, t);
  end loop;
end $$;

create policy tables_manage on public.snooker_tables for all to authenticated using (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[])) with check (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[]));
create policy customers_write on public.customers for all to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy bookings_insert on public.bookings for insert to authenticated with check (club_id = public.current_club_id() and created_by = public.current_profile_id());
create policy bookings_update on public.bookings for update to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy bookings_delete on public.bookings for delete to authenticated using (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[]));
create policy categories_manage on public.product_categories for all to authenticated using (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[])) with check (club_id = public.current_club_id());
create policy products_manage on public.products for all to authenticated using (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[])) with check (club_id = public.current_club_id());
create policy expenses_insert on public.expenses for insert to authenticated with check (club_id = public.current_club_id() and created_by = public.current_profile_id());
create policy expenses_manage on public.expenses for update to authenticated using (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[])) with check (club_id = public.current_club_id());
create policy expenses_delete on public.expenses for delete to authenticated using (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[]));
create policy settings_manage on public.club_settings for all to authenticated using (club_id = public.current_club_id() and public.has_role(array['owner','manager']::public.app_role[])) with check (club_id = public.current_club_id());
create policy notifications_update on public.notifications for update to authenticated using (club_id = public.current_club_id() and (profile_id is null or profile_id = public.current_profile_id())) with check (club_id = public.current_club_id());

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
  insert into public.table_sessions(club_id, table_id, booking_id, customer_id, started_by, hourly_rate)
  values(v_club, v_table.id, p_booking_id, p_customer_id, v_profile, v_table.hourly_rate) returning * into v_session;
  update public.snooker_tables set status = 'occupied' where id = v_table.id;
  if p_booking_id is not null then update public.bookings set status = 'active' where id = p_booking_id and club_id = v_club; end if;
  insert into public.activity_logs(club_id,user_id,action,entity_type,entity_id) values(v_club,v_profile,'session_started','table_session',v_session.id);
  return v_session;
end $$;

create or replace function public.end_table_session(p_session_id uuid, p_rounding_minutes integer default 1)
returns public.table_sessions language plpgsql security definer set search_path = public as $$
declare v_session public.table_sessions; v_profile uuid := public.current_profile_id(); v_club uuid := public.current_club_id(); v_end timestamptz := now(); v_minutes numeric; v_billable numeric;
begin
  if p_rounding_minutes not in (1,5,15,60) then raise exception 'Invalid billing precision'; end if;
  select * into v_session from public.table_sessions where id = p_session_id and club_id = v_club for update;
  if not found or v_session.status not in ('active','paused') then raise exception 'Session is already closed'; end if;
  v_minutes := greatest(0, extract(epoch from (v_end - v_session.start_time)) / 60 - v_session.total_paused_seconds / 60.0);
  v_billable := ceil(v_minutes / p_rounding_minutes) * p_rounding_minutes;
  update public.table_sessions set end_time=v_end, ended_by=v_profile, status='completed', table_charge=round((v_billable / 60) * hourly_rate,2) where id=p_session_id returning * into v_session;
  update public.snooker_tables set status='available' where id=v_session.table_id and status='occupied';
  if v_session.booking_id is not null then update public.bookings set status='completed' where id=v_session.booking_id; end if;
  insert into public.activity_logs(club_id,user_id,action,entity_type,entity_id,metadata) values(v_club,v_profile,'session_ended','table_session',v_session.id,jsonb_build_object('table_charge',v_session.table_charge));
  return v_session;
end $$;

create or replace function public.complete_order(p_table_id uuid, p_session_id uuid, p_items jsonb, p_discount numeric, p_tax numeric, p_payments jsonb, p_notes text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_club uuid := public.current_club_id(); v_profile uuid := public.current_profile_id(); v_order public.orders; v_session public.table_sessions; v_item jsonb; v_payment jsonb; v_product public.products; v_subtotal numeric := 0; v_table_charge numeric := 0; v_paid numeric := 0; v_order_no text; v_tax_rate numeric := 0; v_precision integer := 1;
begin
  if v_profile is null then raise exception 'Not authenticated'; end if;
  if jsonb_array_length(p_payments) = 0 then raise exception 'Payment is required'; end if;
  if p_session_id is null and jsonb_array_length(p_items) = 0 then raise exception 'Order is empty'; end if;
  if p_discount < 0 or p_tax < 0 then raise exception 'Invalid totals'; end if;
  if p_discount > 0 and not public.has_role(array['owner','manager']::public.app_role[]) then raise exception 'Discount requires manager permission'; end if;
  select coalesce((value #>> '{}')::numeric,0) into v_tax_rate from public.club_settings where club_id=v_club and key='tax_rate';
  select coalesce((value #>> '{}')::integer,1) into v_precision from public.club_settings where club_id=v_club and key='billing_precision';
  v_tax_rate := coalesce(v_tax_rate,0); v_precision := coalesce(v_precision,1);
  if p_session_id is not null then
    select * into v_session from public.table_sessions where id=p_session_id and club_id=v_club for update;
    if not found then raise exception 'Session not found'; end if;
    if v_session.status in ('active','paused') then v_session := public.end_table_session(v_session.id, v_precision); end if;
    v_table_charge := v_session.table_charge;
    p_table_id := v_session.table_id;
  elsif p_table_id is not null and not exists(select 1 from public.snooker_tables where id=p_table_id and club_id=v_club) then
    raise exception 'Table not found';
  end if;
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

revoke all on function public.start_table_session(uuid,uuid,uuid) from public;
revoke all on function public.end_table_session(uuid,integer) from public;
revoke all on function public.complete_order(uuid,uuid,jsonb,numeric,numeric,jsonb,text) from public;
grant execute on function public.start_table_session(uuid,uuid,uuid) to authenticated;
grant execute on function public.end_table_session(uuid,integer) to authenticated;
grant execute on function public.complete_order(uuid,uuid,jsonb,numeric,numeric,jsonb,text) to authenticated;

create or replace function public.adjust_inventory(p_product_id uuid, p_quantity integer, p_notes text default null)
returns public.products language plpgsql security definer set search_path=public as $$
declare v_product public.products; v_profile uuid:=public.current_profile_id(); v_club uuid:=public.current_club_id(); v_type public.inventory_transaction_type;
begin
  if not public.has_role(array['owner','manager']::public.app_role[]) then raise exception 'Manager permission required'; end if;
  if p_quantity = 0 then raise exception 'Quantity cannot be zero'; end if;
  select * into v_product from public.products where id=p_product_id and club_id=v_club for update;
  if not found then raise exception 'Product not found'; end if;
  if v_product.stock_quantity + p_quantity < 0 then raise exception 'Stock cannot be negative'; end if;
  v_type := case when p_quantity > 0 then 'restock'::public.inventory_transaction_type else 'adjustment'::public.inventory_transaction_type end;
  update public.products set stock_quantity=stock_quantity+p_quantity where id=p_product_id returning * into v_product;
  insert into public.inventory_transactions(club_id,product_id,transaction_type,quantity,previous_quantity,new_quantity,notes,created_by)
  values(v_club,p_product_id,v_type,p_quantity,v_product.stock_quantity-p_quantity,v_product.stock_quantity,p_notes,v_profile);
  insert into public.activity_logs(club_id,user_id,action,entity_type,entity_id,metadata) values(v_club,v_profile,'inventory_adjusted','product',p_product_id,jsonb_build_object('quantity',p_quantity));
  return v_product;
end $$;
revoke all on function public.adjust_inventory(uuid,integer,text) from public;
grant execute on function public.adjust_inventory(uuid,integer,text) to authenticated;

create or replace function public.refund_order(p_order_id uuid, p_reason text)
returns public.orders language plpgsql security definer set search_path=public as $$
declare v_order public.orders; v_item record; v_product public.products; v_profile uuid:=public.current_profile_id(); v_club uuid:=public.current_club_id();
begin
  if not public.has_role(array['owner','manager']::public.app_role[]) then raise exception 'Manager permission required'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Refund reason required'; end if;
  select * into v_order from public.orders where id=p_order_id and club_id=v_club for update;
  if not found or v_order.order_status <> 'completed' or v_order.payment_status <> 'paid' then raise exception 'Order cannot be refunded'; end if;
  for v_item in select product_id,quantity from public.order_items where order_id=v_order.id and product_id is not null loop
    select * into v_product from public.products where id=v_item.product_id for update;
    if found and v_product.track_inventory then
      update public.products set stock_quantity=stock_quantity+v_item.quantity where id=v_product.id;
      insert into public.inventory_transactions(club_id,product_id,transaction_type,quantity,previous_quantity,new_quantity,reference_type,reference_id,notes,created_by)
      values(v_club,v_product.id,'return',v_item.quantity,v_product.stock_quantity,v_product.stock_quantity+v_item.quantity,'refund',v_order.id,p_reason,v_profile);
    end if;
  end loop;
  update public.orders set order_status='refunded',payment_status='refunded',notes=concat_ws(E'\n',notes,'Refund: '||p_reason) where id=v_order.id returning * into v_order;
  insert into public.activity_logs(club_id,user_id,action,entity_type,entity_id,metadata) values(v_club,v_profile,'refund_made','order',v_order.id,jsonb_build_object('total',v_order.total_amount,'reason',p_reason));
  return v_order;
end $$;
revoke all on function public.refund_order(uuid,text) from public;
grant execute on function public.refund_order(uuid,text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
