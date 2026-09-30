-- Query-specific indexes for the filters and joins used by the application.
create index if not exists customers_club_created
  on public.customers (club_id, created_at desc);

create index if not exists bookings_club_confirmed_start
  on public.bookings (club_id, start_time)
  where status = 'confirmed';

create index if not exists bookings_club_customer_start
  on public.bookings (club_id, customer_id, start_time desc)
  where customer_id is not null;

create index if not exists orders_club_customer_created
  on public.orders (club_id, customer_id, created_at desc)
  where customer_id is not null;

create index if not exists orders_club_paid_session
  on public.orders (club_id, session_id)
  where order_status = 'completed' and payment_status = 'paid' and session_id is not null;

create index if not exists order_items_order
  on public.order_items (order_id);

create index if not exists payments_order
  on public.payments (order_id);

create index if not exists notifications_club_created
  on public.notifications (club_id, created_at desc);

-- The application intentionally supports contains searches (ILIKE '%term%').
-- Trigram indexes make those searches scale without changing their behavior.
create extension if not exists pg_trgm;

create index if not exists tables_name_trgm
  on public.snooker_tables using gin (name gin_trgm_ops);

create index if not exists customers_name_trgm
  on public.customers using gin (full_name gin_trgm_ops);

create index if not exists customers_phone_trgm
  on public.customers using gin (phone gin_trgm_ops)
  where phone is not null;

create index if not exists bookings_customer_name_trgm
  on public.bookings using gin (customer_name gin_trgm_ops);

create index if not exists orders_number_trgm
  on public.orders using gin (order_number gin_trgm_ops);

-- Return dashboard totals as one row instead of transferring all historical
-- orders and sessions to the application server on every dashboard refresh.
create or replace function public.get_dashboard_metrics()
returns table (
  total_revenue numeric,
  active_session_count bigint,
  tax_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with context as (
    select public.current_club_id() as club_id
  ),
  paid_orders as (
    select o.total_amount, o.session_id
    from public.orders o, context c
    where o.club_id = c.club_id
      and o.order_status = 'completed'
      and o.payment_status = 'paid'
  )
  select
    coalesce((select sum(po.total_amount) from paid_orders po), 0)
      + coalesce((
          select sum(s.table_charge)
          from public.table_sessions s, context c
          where s.club_id = c.club_id
            and s.status = 'completed'
            and not exists (
              select 1 from paid_orders po where po.session_id = s.id
            )
        ), 0) as total_revenue,
    (select count(*) from public.table_sessions s, context c where s.club_id = c.club_id and s.status in ('active', 'paused')) as active_session_count,
    coalesce((
      select (cs.value #>> '{}')::numeric
      from public.club_settings cs, context c
      where cs.club_id = c.club_id and cs.key = 'tax_rate'
    ), 0) as tax_rate;
$$;

revoke all on function public.get_dashboard_metrics() from public;
grant execute on function public.get_dashboard_metrics() to authenticated;

-- Aggregate reports in PostgreSQL so response size is proportional to the
-- number of chart points, not the number of orders, items, and payments.
create or replace function public.get_report_summary(
  p_start timestamptz,
  p_end timestamptz,
  p_from date,
  p_to date
)
returns table (
  total_revenue numeric,
  expense_total numeric,
  table_revenue numeric,
  trend jsonb,
  top_products jsonb,
  payment_data jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['owner','manager']::public.app_role[]) then
    raise exception 'Report access requires manager permission' using errcode = '42501';
  end if;

  return query
  with context as (
    select c.id as club_id, c.timezone
    from public.clubs c
    where c.id = public.current_club_id()
  ),
  paid_orders as (
    select o.id, o.total_amount, o.session_id, o.created_at
    from public.orders o, context c
    where o.club_id = c.club_id
      and o.order_status = 'completed'
      and o.payment_status = 'paid'
      and o.created_at >= p_start
      and o.created_at < p_end
  ),
  completed_sessions as (
    select s.id, s.table_charge, s.end_time
    from public.table_sessions s, context c
    where s.club_id = c.club_id
      and s.status = 'completed'
      and s.end_time >= p_start
      and s.end_time < p_end
  ),
  unmatched_sessions as (
    select s.*
    from completed_sessions s
    where not exists (select 1 from paid_orders o where o.session_id = s.id)
  ),
  range_expenses as (
    select e.amount, e.expense_date
    from public.expenses e, context c
    where e.club_id = c.club_id
      and e.expense_date >= p_from
      and e.expense_date <= p_to
  ),
  daily as (
    select points.report_date, sum(points.revenue) as revenue, sum(points.expenses) as expenses
    from (
      select (o.created_at at time zone c.timezone)::date as report_date, o.total_amount as revenue, 0::numeric as expenses
      from paid_orders o cross join context c
      union all
      select (s.end_time at time zone c.timezone)::date, s.table_charge, 0::numeric
      from unmatched_sessions s cross join context c
      union all
      select e.expense_date, 0::numeric, e.amount
      from range_expenses e
    ) points
    group by points.report_date
  ),
  product_totals as (
    select i.product_name, sum(i.quantity)::bigint as quantity
    from public.order_items i
    join paid_orders o on o.id = i.order_id
    group by i.product_name
    order by quantity desc, i.product_name
    limit 7
  ),
  payment_totals as (
    select p.payment_method::text as name, sum(p.amount) as value
    from public.payments p cross join context c
    join public.orders o on o.id = p.order_id and o.club_id = p.club_id
    where p.club_id = c.club_id
      and o.order_status = 'completed'
      and o.payment_status = 'paid'
      and p.created_at >= p_start
      and p.created_at < p_end
    group by p.payment_method
  )
  select
    coalesce((select sum(o.total_amount) from paid_orders o), 0)
      + coalesce((select sum(s.table_charge) from unmatched_sessions s), 0),
    coalesce((select sum(e.amount) from range_expenses e), 0),
    coalesce((select sum(s.table_charge) from completed_sessions s), 0),
    coalesce((
      select jsonb_agg(jsonb_build_object('date', to_char(d.report_date, 'MM-DD'), 'revenue', d.revenue, 'expenses', d.expenses) order by d.report_date)
      from daily d
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('name', p.product_name, 'quantity', p.quantity) order by p.quantity desc, p.product_name)
      from product_totals p
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'value', p.value) order by p.name)
      from payment_totals p
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_report_summary(timestamptz, timestamptz, date, date) from public;
grant execute on function public.get_report_summary(timestamptz, timestamptz, date, date) to authenticated;
