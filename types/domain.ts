export type AppRole = "owner" | "manager" | "staff";
export type TableStatus = "available" | "occupied" | "reserved" | "maintenance" | "inactive";
export type SessionStatus = "active" | "paused" | "completed" | "cancelled";

export interface Profile {
  id: string;
  auth_user_id: string;
  club_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: AppRole;
  avatar_url: string | null;
  is_active: boolean;
}

export interface Club {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
}

export interface SnookerTable {
  id: string;
  club_id: string;
  name: string;
  table_number: number;
  description: string | null;
  game_rate: number;
  status: TableStatus;
  sort_order: number;
  is_active: boolean;
  table_sessions?: TableSession[];
  bookings?: Booking[];
}

export interface TableSession {
  id: string;
  table_id: string;
  customer_id: string | null;
  start_time: string;
  end_time: string | null;
  total_paused_seconds: number;
  game_rate: number;
  table_charge: number;
  status: SessionStatus;
  customers?: { full_name: string } | null;
  snooker_tables?: { name: string } | null;
}

export interface Booking {
  id: string;
  table_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  game_rate: number;
  estimated_amount: number;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  snooker_tables?: { name: string } | null;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  image_url: string | null;
  is_active: boolean;
  product_categories?: { name: string } | null;
}

export interface Order {
  id: string;
  order_number: string;
  table_id: string | null;
  subtotal: number;
  table_charge: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
  snooker_tables?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

export interface DashboardData {
  club: Club;
  profile: Profile;
  tables: SnookerTable[];
  bookings: Booking[];
  sessions: TableSession[];
  orders: Order[];
  products: Product[];
  todayRevenue: number;
}
