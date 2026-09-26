create extension if not exists btree_gist;

create type public.app_role as enum ('owner', 'manager', 'staff');
create type public.table_status as enum ('available', 'occupied', 'reserved', 'maintenance', 'inactive');
create type public.booking_status as enum ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show');
create type public.session_status as enum ('active', 'paused', 'completed', 'cancelled');
create type public.payment_method as enum ('cash', 'card', 'bank', 'mobile_wallet', 'split', 'other');
create type public.payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
create type public.order_status as enum ('open', 'completed', 'cancelled', 'refunded');
create type public.inventory_transaction_type as enum ('sale', 'restock', 'adjustment', 'wastage', 'return');

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  currency text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Karachi',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role public.app_role not null default 'staff',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.snooker_tables (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  table_number integer not null check (table_number > 0),
  description text,
  hourly_rate numeric(12,2) not null check (hourly_rate >= 0),
  status public.table_status not null default 'available',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, table_number)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  notes text,
  total_visits integer not null default 0 check (total_visits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  table_id uuid not null references public.snooker_tables(id),
  customer_id uuid references public.customers(id),
  customer_name text not null,
  customer_phone text,
  booking_date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  hourly_rate numeric(12,2) not null check (hourly_rate >= 0),
  estimated_amount numeric(12,2) not null check (estimated_amount >= 0),
  status public.booking_status not null default 'pending',
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    table_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status in ('confirmed', 'active'));

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  table_id uuid not null references public.snooker_tables(id),
  booking_id uuid references public.bookings(id),
  customer_id uuid references public.customers(id),
  started_by uuid not null references public.profiles(id),
  ended_by uuid references public.profiles(id),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  paused_at timestamptz,
  total_paused_seconds integer not null default 0 check (total_paused_seconds >= 0),
  hourly_rate numeric(12,2) not null check (hourly_rate >= 0),
  table_charge numeric(12,2) not null default 0 check (table_charge >= 0),
  status public.session_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_open_session_per_table on public.table_sessions(table_id) where status in ('active', 'paused');

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  category_id uuid references public.product_categories(id),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  sku text,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  track_inventory boolean not null default true,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, sku)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  table_id uuid references public.snooker_tables(id),
  session_id uuid references public.table_sessions(id),
  customer_id uuid references public.customers(id),
  created_by uuid not null references public.profiles(id),
  order_number text not null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  table_charge numeric(12,2) not null default 0 check (table_charge >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_status public.payment_status not null default 'unpaid',
  order_status public.order_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, order_number)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  transaction_reference text,
  received_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  product_id uuid not null references public.products(id),
  transaction_type public.inventory_transaction_type not null,
  quantity integer not null,
  previous_quantity integer not null,
  new_quantity integer not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null,
  payment_method public.payment_method not null,
  attachment_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(12,2) not null default 0,
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  notes text,
  status text not null default 'open' check (status in ('open', 'closed'))
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.club_settings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (club_id, key)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Composite tenant keys make cross-club references impossible even if a UUID is guessed.
alter table public.profiles add constraint profiles_id_club_unique unique (id, club_id);
alter table public.snooker_tables add constraint tables_id_club_unique unique (id, club_id);
alter table public.customers add constraint customers_id_club_unique unique (id, club_id);
alter table public.bookings add constraint bookings_id_club_unique unique (id, club_id);
alter table public.table_sessions add constraint sessions_id_club_unique unique (id, club_id);
alter table public.product_categories add constraint categories_id_club_unique unique (id, club_id);
alter table public.products add constraint products_id_club_unique unique (id, club_id);
alter table public.orders add constraint orders_id_club_unique unique (id, club_id);

alter table public.bookings add constraint bookings_table_same_club foreign key (table_id, club_id) references public.snooker_tables(id, club_id);
alter table public.bookings add constraint bookings_customer_same_club foreign key (customer_id, club_id) references public.customers(id, club_id);
alter table public.bookings add constraint bookings_creator_same_club foreign key (created_by, club_id) references public.profiles(id, club_id);
alter table public.table_sessions add constraint sessions_table_same_club foreign key (table_id, club_id) references public.snooker_tables(id, club_id);
alter table public.table_sessions add constraint sessions_booking_same_club foreign key (booking_id, club_id) references public.bookings(id, club_id);
alter table public.table_sessions add constraint sessions_customer_same_club foreign key (customer_id, club_id) references public.customers(id, club_id);
alter table public.table_sessions add constraint sessions_starter_same_club foreign key (started_by, club_id) references public.profiles(id, club_id);
alter table public.table_sessions add constraint sessions_ender_same_club foreign key (ended_by, club_id) references public.profiles(id, club_id);
alter table public.products add constraint products_category_same_club foreign key (category_id, club_id) references public.product_categories(id, club_id);
alter table public.orders add constraint orders_table_same_club foreign key (table_id, club_id) references public.snooker_tables(id, club_id);
alter table public.orders add constraint orders_session_same_club foreign key (session_id, club_id) references public.table_sessions(id, club_id);
alter table public.orders add constraint orders_customer_same_club foreign key (customer_id, club_id) references public.customers(id, club_id);
alter table public.orders add constraint orders_creator_same_club foreign key (created_by, club_id) references public.profiles(id, club_id);
alter table public.order_items add constraint items_order_same_club foreign key (order_id, club_id) references public.orders(id, club_id);
alter table public.order_items add constraint items_product_same_club foreign key (product_id, club_id) references public.products(id, club_id);
alter table public.payments add constraint payments_order_same_club foreign key (order_id, club_id) references public.orders(id, club_id);
alter table public.payments add constraint payments_receiver_same_club foreign key (received_by, club_id) references public.profiles(id, club_id);
alter table public.inventory_transactions add constraint inventory_product_same_club foreign key (product_id, club_id) references public.products(id, club_id);
alter table public.inventory_transactions add constraint inventory_creator_same_club foreign key (created_by, club_id) references public.profiles(id, club_id);
alter table public.expenses add constraint expenses_creator_same_club foreign key (created_by, club_id) references public.profiles(id, club_id);
alter table public.staff_shifts add constraint shifts_staff_same_club foreign key (staff_id, club_id) references public.profiles(id, club_id);
alter table public.activity_logs add constraint activity_user_same_club foreign key (user_id, club_id) references public.profiles(id, club_id);
alter table public.notifications add constraint notifications_profile_same_club foreign key (profile_id, club_id) references public.profiles(id, club_id);

create index profiles_club on public.profiles(club_id);
create index tables_club_status on public.snooker_tables(club_id, status);
create index customers_club_phone on public.customers(club_id, phone);
create index bookings_club_date on public.bookings(club_id, booking_date, start_time);
create index bookings_table_time on public.bookings(table_id, start_time, end_time);
create index sessions_club_status on public.table_sessions(club_id, status);
create index sessions_table on public.table_sessions(table_id, created_at desc);
create index products_club on public.products(club_id, is_active);
create index orders_club_created on public.orders(club_id, created_at desc);
create index orders_club_number on public.orders(club_id, order_number);
create index inventory_product_created on public.inventory_transactions(product_id, created_at desc);
create index expenses_club_date on public.expenses(club_id, expense_date desc);
create index activity_club_created on public.activity_logs(club_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['clubs','profiles','snooker_tables','customers','bookings','table_sessions','products','orders','expenses'] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

alter publication supabase_realtime add table public.snooker_tables, public.table_sessions, public.bookings, public.orders, public.notifications;
