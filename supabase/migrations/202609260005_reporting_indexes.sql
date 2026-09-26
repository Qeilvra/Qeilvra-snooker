-- Supports the completed-session and paid-order time-range queries used by Dashboard and Reports.
-- Partial indexes keep the index size proportional to the records that can contribute to revenue.
create index if not exists sessions_club_completed_end
  on public.table_sessions (club_id, end_time desc)
  include (id, table_charge)
  where status = 'completed';

create index if not exists orders_club_paid_completed_created
  on public.orders (club_id, created_at desc)
  include (session_id, total_amount)
  where order_status = 'completed' and payment_status = 'paid';

create index if not exists payments_club_created
  on public.payments (club_id, created_at desc);
