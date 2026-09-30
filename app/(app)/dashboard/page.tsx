import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ChartNoAxesColumnIncreasing, CreditCard, Package, Table2, UsersRound, WalletCards } from "lucide-react";
import { getAppContext, dateInTimezone, localDayStartIso } from "@/lib/data";
import { formatMoney, formatTime } from "@/lib/format";
import { TableBrowser } from "@/components/table-browser";
import { PosPanel } from "@/components/pos-panel";
import { EmptyState } from "@/components/empty-state";
import { SessionTimer } from "@/components/session-timer";
import type { Booking, Order, Product, SnookerTable, TableSession } from "@/types/domain";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type SupabaseClient = Awaited<ReturnType<typeof getAppContext>>["supabase"];
type DashboardMetrics = { total_revenue: number; active_session_count: number; tax_rate: number };

export default async function DashboardPage() {
  const { supabase, club, profile } = await getAppContext();
  const now = new Date();
  const reservationHorizon = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const today = dateInTimezone(now, club.timezone);
  const dayStart = localDayStartIso(now, club.timezone);

  // Start every independent request together, but only block the operational
  // dashboard on table state. Analytics, POS inventory, and history stream in
  // through their own boundaries below.
  const tablesPromise = loadTables(supabase, now.toISOString(), reservationHorizon);
  const bookingsPromise = loadBookings(supabase, today);
  const sessionsPromise = tablesPromise.then(sessionsFromTables);
  const ordersPromise = loadOrders(supabase, dayStart);
  const productsPromise = loadProducts(supabase);
  const metricsPromise = loadMetrics(supabase, sessionsPromise);

  const tables = await tablesPromise;
  const activeSessionCount = tables.reduce(
    (count, table) => count + (table.table_sessions?.some((session) => session.status === "active" || session.status === "paused") ? 1 : 0),
    0,
  );
  const usage = tables.length ? Math.round((activeSessionCount / tables.length) * 100) : 0;
  const firstName = profile.full_name.split(" ")[0];

  return <>
    <div className="page-head" style={{display:"none"}}><div><h1 className="page-title">Dashboard</h1></div></div>
    <section className="mobile-home-intro"><h1 className="page-title">Good Evening,<br/>{firstName}</h1><p className="page-subtitle">{new Intl.DateTimeFormat("en-PK",{timeZone:club.timezone,dateStyle:"medium",timeStyle:"short"}).format(now)}</p></section>
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section className="metric-grid" aria-label="Club summary">
          <Metric icon={<Table2/>} label="Total Tables" value={String(tables.length)}/>
          <Metric className="blue" icon={<UsersRound/>} label="Active Sessions" value={String(activeSessionCount)}/>
          <Suspense fallback={<Metric className="amber" icon={<WalletCards/>} label="Total Revenue" value="…"/>}>
            <RevenueMetric metricsPromise={metricsPromise} currency={club.currency}/>
          </Suspense>
          <Metric className="violet" icon={<ChartNoAxesColumnIncreasing/>} label="Table Usage" value={`${usage}%`}/>
        </section>
        <section className="quick-access"><h2>Quick Access</h2><div>{[["/tables","Tables",Table2],["/bookings","Bookings",CalendarDays],["/pos","POS",CreditCard],["/orders","Orders",WalletCards],["/inventory","Inventory",Package],["/reports","Reports",ChartNoAxesColumnIncreasing]].map(([href,label,Icon])=><Link href={String(href)} key={String(href)}><Icon size={27}/><span>{String(label)}</span></Link>)}</div></section>
        <TableBrowser tables={tables} currency={club.currency} timezone={club.timezone}/>
      </div>
      <Suspense fallback={<section className="panel pos-panel" aria-label="Loading point of sale" aria-busy="true"><div className="skeleton skeleton-panel"/></section>}>
        <DashboardPos productsPromise={productsPromise} sessionsPromise={sessionsPromise} metricsPromise={metricsPromise} currency={club.currency} role={profile.role}/>
      </Suspense>
      <Suspense fallback={<div className="data-panels" aria-label="Loading dashboard activity" aria-busy="true"><div className="skeleton skeleton-card"/><div className="skeleton skeleton-card"/><div className="skeleton skeleton-card"/></div>}>
        <DashboardActivity bookingsPromise={bookingsPromise} sessionsPromise={sessionsPromise} ordersPromise={ordersPromise} currency={club.currency} timezone={club.timezone}/>
      </Suspense>
    </div>
  </>;
}

async function RevenueMetric({ metricsPromise, currency }: { metricsPromise: Promise<DashboardMetrics>; currency: string }) {
  const metrics = await metricsPromise;
  return <Metric className="amber" icon={<WalletCards/>} label="Total Revenue" value={formatMoney(Number(metrics.total_revenue), currency)}/>;
}

async function DashboardPos({ productsPromise, sessionsPromise, metricsPromise, currency, role }: {
  productsPromise: Promise<Product[]>;
  sessionsPromise: Promise<TableSession[]>;
  metricsPromise: Promise<DashboardMetrics>;
  currency: string;
  role: string;
}) {
  const [products, sessions, metrics] = await Promise.all([productsPromise, sessionsPromise, metricsPromise]);
  return <PosPanel products={products} session={sessions[0] ?? null} currency={currency} role={role} taxRate={Number(metrics.tax_rate)}/>;
}

async function DashboardActivity({ bookingsPromise, sessionsPromise, ordersPromise, currency, timezone }: {
  bookingsPromise: Promise<Booking[]>;
  sessionsPromise: Promise<TableSession[]>;
  ordersPromise: Promise<Order[]>;
  currency: string;
  timezone: string;
}) {
  const [bookings, sessions, orders] = await Promise.all([bookingsPromise, sessionsPromise, ordersPromise]);
  return <div className="data-panels">
    <SummaryPanel title="Today’s Bookings" href="/bookings" empty="No bookings today.">{bookings.map((booking)=><div className="data-row" key={booking.id}><strong>{formatTime(booking.start_time,timezone)}</strong><span>{booking.snooker_tables?.name}</span><span>{booking.customer_name}</span><span className={`badge ${booking.status==="confirmed"?"green":booking.status==="pending"?"amber":"blue"}`}>{booking.status}</span></div>)}</SummaryPanel>
    <SummaryPanel title="Active Sessions" href="/tables" empty="No active sessions.">{sessions.map((session)=><div className="data-row" key={session.id}><span className="badge red">{session.snooker_tables?.name}</span><span>{session.customers?.full_name ?? "Walk-in"}</span><span><SessionTimer startedAt={session.start_time} pausedSeconds={session.total_paused_seconds}/></span><Link className="btn btn-danger btn-sm" href={`/pos?session=${session.id}`}>Settle</Link></div>)}</SummaryPanel>
    <SummaryPanel title="Recent Orders" href="/orders" empty="No orders today.">{orders.map((order)=><div className="data-row" key={order.id}><strong>#{order.order_number}</strong><span>{order.snooker_tables?.name ?? "Counter"}</span><span>{formatMoney(order.total_amount,currency)}</span><span>{formatTime(order.created_at,timezone)}</span></div>)}</SummaryPanel>
  </div>;
}

async function loadTables(supabase: SupabaseClient, now: string, reservationHorizon: string) {
  const { data } = await supabase.from("snooker_tables").select("id,name,table_number,game_rate,status,sort_order,is_active,table_sessions:table_sessions!sessions_table_same_club(id,table_id,customer_id,start_time,total_paused_seconds,game_rate,table_charge,status,customers:customers!sessions_customer_same_club(full_name)),bookings:bookings!bookings_table_same_club(id,table_id,start_time,status)").eq("is_active",true).in("table_sessions.status",["active","paused"]).eq("bookings.status","confirmed").gte("bookings.start_time",now).lte("bookings.start_time",reservationHorizon).order("sort_order");
  return (data ?? []) as unknown as SnookerTable[];
}

function sessionsFromTables(tables: SnookerTable[]) {
  return tables
    .flatMap((table) => (table.table_sessions ?? []).map((session) => ({ ...session, snooker_tables: { name: table.name } })))
    .sort((left, right) => left.start_time.localeCompare(right.start_time))
    .slice(0, 6);
}

async function loadBookings(supabase: SupabaseClient, today: string) {
  const { data } = await supabase.from("bookings").select("id,table_id,customer_name,start_time,status,snooker_tables:snooker_tables!bookings_table_same_club(name)").eq("booking_date",today).order("start_time").limit(5);
  return (data ?? []) as unknown as Booking[];
}

async function loadOrders(supabase: SupabaseClient, dayStart: string) {
  const { data } = await supabase.from("orders").select("id,order_number,total_amount,created_at,snooker_tables:snooker_tables!orders_table_same_club(name)").eq("order_status","completed").gte("created_at",dayStart).order("created_at",{ascending:false}).limit(6);
  return (data ?? []) as unknown as Order[];
}

async function loadProducts(supabase: SupabaseClient) {
  const { data } = await supabase.from("products").select("id,category_id,name,price,stock_quantity,track_inventory,product_categories:product_categories!products_category_same_club(name)").eq("is_active",true).order("name").limit(40);
  return (data ?? []) as unknown as Product[];
}

async function loadMetrics(supabase: SupabaseClient, sessionsPromise: Promise<TableSession[]>): Promise<DashboardMetrics> {
  const metricsResult = await supabase.rpc("get_dashboard_metrics").single();
  const metrics = metricsResult.data as DashboardMetrics | null;
  if (!metricsResult.error && metrics) return metrics;

  const [{ data: paidOrders }, { data: completedSessions }, { count }, { data: settingsData }, sessions] = await Promise.all([
    supabase.from("orders").select("total_amount,session_id").eq("order_status","completed").eq("payment_status","paid"),
    supabase.from("table_sessions").select("id,table_charge").eq("status","completed"),
    supabase.from("table_sessions").select("id", { count: "exact", head: true }).in("status",["active","paused"]),
    supabase.from("club_settings").select("value").eq("key","tax_rate").maybeSingle(),
    sessionsPromise,
  ]);
  const settled = new Set((paidOrders ?? []).flatMap((order) => order.session_id ? [order.session_id] : []));
  const totalRevenue = (paidOrders ?? []).reduce((sum, order) => sum + Number(order.total_amount), 0)
    + (completedSessions ?? []).filter((session) => !settled.has(session.id)).reduce((sum, session) => sum + Number(session.table_charge), 0);
  return { total_revenue: totalRevenue, active_session_count: count ?? sessions.length, tax_rate: Number(settingsData?.value ?? 0) };
}

function Metric({icon,label,value,className=""}:{icon:React.ReactNode;label:string;value:string;className?:string}) {
  return <article className={`metric-card ${className}`}><span className="metric-icon">{icon}</span><div><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div></article>;
}

function SummaryPanel({title,href,empty,children}:{title:string;href:string;empty:string;children:React.ReactNode}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="panel"><div className="panel-head"><h2 className="panel-title">{title}</h2><div className="panel-actions"><Link className="btn btn-sm" href={href}>View all</Link></div></div>{hasItems?<div className="data-list">{children}</div>:<EmptyState title={empty}/>}</section>;
}
