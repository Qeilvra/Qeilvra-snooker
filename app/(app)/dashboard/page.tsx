import Link from "next/link";
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

export default async function DashboardPage() {
  const { supabase, club, profile } = await getAppContext();
  const now = new Date();
  const reservationHorizon = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const today = dateInTimezone(now,club.timezone);
  const dayStart = localDayStartIso(now,club.timezone);
  const [tablesResult, bookingsResult, sessionsResult, ordersResult, productsResult, settingsResult] = await Promise.all([
    supabase.from("snooker_tables").select("*, table_sessions(id,table_id,start_time,end_time,total_paused_seconds,hourly_rate,table_charge,status), bookings(id,table_id,customer_name,customer_phone,booking_date,start_time,end_time,duration_minutes,hourly_rate,estimated_amount,status,notes)").eq("is_active",true).in("table_sessions.status",["active","paused"]).eq("bookings.status","confirmed").gte("bookings.start_time",now.toISOString()).lte("bookings.start_time",reservationHorizon).order("sort_order"),
    supabase.from("bookings").select("*, snooker_tables(name)").eq("booking_date",today).order("start_time").limit(5),
    supabase.from("table_sessions").select("*, customers(full_name), snooker_tables(name)").in("status",["active","paused"]).order("start_time").limit(6),
    supabase.from("orders").select("*, snooker_tables(name)").eq("order_status","completed").gte("created_at",dayStart).order("created_at",{ascending:false}).limit(6),
    supabase.from("products").select("*, product_categories(name)").eq("is_active",true).order("name").limit(40),
    supabase.from("club_settings").select("key,value").in("key",["tax_rate","billing_precision"]),
  ]);
  const tables = (tablesResult.data ?? []) as SnookerTable[];
  const bookings = (bookingsResult.data ?? []) as Booking[];
  const sessions = (sessionsResult.data ?? []) as TableSession[];
  const orders = (ordersResult.data ?? []) as Order[];
  const products = (productsResult.data ?? []) as Product[];
  const revenue = orders.reduce((sum,order)=>sum+Number(order.total_amount),0);
  const usage = tables.length ? Math.round((sessions.length/tables.length)*100) : 0;
  const activePosSession = sessions[0] ?? null;
  const settings=Object.fromEntries((settingsResult.data??[]).map(x=>[x.key,x.value]));
  const firstName = profile.full_name.split(" ")[0];
  return <>
    <div className="page-head" style={{display:"none"}}><div><h1 className="page-title">Dashboard</h1></div></div>
    <section className="mobile-home-intro"><h1 className="page-title">Good Evening,<br/>{firstName}</h1><p className="page-subtitle">{new Intl.DateTimeFormat("en-PK",{timeZone:club.timezone,dateStyle:"medium",timeStyle:"short"}).format(now)}</p></section>
    <div className="dashboard-grid">
      <div className="dashboard-main">
        <section className="metric-grid" aria-label="Club summary">
          <Metric icon={<Table2/>} label="Total Tables" value={String(tables.length)}/>
          <Metric className="blue" icon={<UsersRound/>} label="Active Sessions" value={String(sessions.length)}/>
          <Metric className="amber" icon={<WalletCards/>} label="Today’s Revenue" value={formatMoney(revenue,club.currency)}/>
          <Metric className="violet" icon={<ChartNoAxesColumnIncreasing/>} label="Table Usage" value={`${usage}%`}/>
        </section>
        <section className="quick-access"><h2>Quick Access</h2><div>{[["/tables","Tables",Table2],["/bookings","Bookings",CalendarDays],["/pos","POS",CreditCard],["/orders","Orders",WalletCards],["/inventory","Inventory",Package],["/reports","Reports",ChartNoAxesColumnIncreasing]].map(([href,label,Icon])=><Link href={String(href)} key={String(href)}><Icon size={27}/><span>{String(label)}</span></Link>)}</div></section>
        <TableBrowser tables={tables} currency={club.currency} timezone={club.timezone}/>
      </div>
      <PosPanel products={products} session={activePosSession} currency={club.currency} role={profile.role} taxRate={Number(settings.tax_rate??0)} billingPrecision={(Number(settings.billing_precision??1) as 1|5|15|60)}/>
      <div className="data-panels">
        <SummaryPanel title="Today’s Bookings" href="/bookings" empty="No bookings today.">{bookings.map((booking)=><div className="data-row" key={booking.id}><strong>{formatTime(booking.start_time,club.timezone)}</strong><span>{booking.snooker_tables?.name}</span><span>{booking.customer_name}</span><span className={`badge ${booking.status==="confirmed"?"green":booking.status==="pending"?"amber":"blue"}`}>{booking.status}</span></div>)}</SummaryPanel>
        <SummaryPanel title="Active Sessions" href="/tables" empty="No active sessions.">{sessions.map((session)=><div className="data-row" key={session.id}><span className="badge red">{session.snooker_tables?.name}</span><span>{session.customers?.full_name ?? "Walk-in"}</span><span><SessionTimer startedAt={session.start_time} pausedSeconds={session.total_paused_seconds}/></span><Link className="btn btn-danger btn-sm" href={`/pos?session=${session.id}`}>Settle</Link></div>)}</SummaryPanel>
        <SummaryPanel title="Recent Orders" href="/orders" empty="No orders today.">{orders.map((order)=><div className="data-row" key={order.id}><strong>#{order.order_number}</strong><span>{order.snooker_tables?.name ?? "Counter"}</span><span>{formatMoney(order.total_amount,club.currency)}</span><span>{formatTime(order.created_at,club.timezone)}</span></div>)}</SummaryPanel>
      </div>
    </div>
  </>;
}

function Metric({icon,label,value,className=""}:{icon:React.ReactNode;label:string;value:string;className?:string}) {
  return <article className={`metric-card ${className}`}><span className="metric-icon">{icon}</span><div><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div></article>;
}

function SummaryPanel({title,href,empty,children}:{title:string;href:string;empty:string;children:React.ReactNode}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="panel"><div className="panel-head"><h2 className="panel-title">{title}</h2><div className="panel-actions"><Link className="btn btn-sm" href={href}>View all</Link></div></div>{hasItems?<div className="data-list">{children}</div>:<EmptyState title={empty}/>}</section>;
}
