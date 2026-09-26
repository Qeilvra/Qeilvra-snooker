import Link from "next/link";
import { getAppContext } from "@/lib/data";
import { formatMoney, formatClubDateTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

interface TableResult { id: string; name: string; status: string }
interface CustomerResult { id: string; full_name: string; phone: string | null; email: string | null }
interface BookingResult { id: string; customer_name: string; start_time: string; snooker_tables: { name: string } | null }
interface OrderResult { id: string; order_number: string; total_amount: number }

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, club } = await getAppContext();
  const raw = (await searchParams).q?.trim() ?? "";
  const q = raw.replace(/[%_,()]/g, "").slice(0, 80);
  if (!q) return <><div className="page-head"><h1 className="page-title">Search</h1></div><section className="panel"><EmptyState title="Enter a search term." /></section></>;
  const numeric = Number(q);
  const [tableR, customerR, bookingR, orderR] = await Promise.all([
    supabase.from("snooker_tables").select("id,name,table_number,status").or(`name.ilike.%${q}%${Number.isFinite(numeric) ? `,table_number.eq.${numeric}` : ""}`).limit(10),
    supabase.from("customers").select("id,full_name,phone,email").or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(10),
    supabase.from("bookings").select("id,customer_name,start_time,status,snooker_tables:snooker_tables!bookings_table_same_club(name)").ilike("customer_name", `%${q}%`).limit(10),
    supabase.from("orders").select("id,order_number,total_amount,created_at").ilike("order_number", `%${q}%`).limit(10),
  ]);
  const tables = (tableR.data ?? []) as TableResult[];
  const customers = (customerR.data ?? []) as CustomerResult[];
  const bookings = (bookingR.data ?? []) as unknown as BookingResult[];
  const orders = (orderR.data ?? []) as OrderResult[];
  const found = tables.length + customers.length + bookings.length + orders.length > 0;
  return <><div className="page-head"><div><h1 className="page-title">Search</h1><p className="page-subtitle">Results for “{raw}”</p></div></div>{found ? <div className="management-forms">
    {tables.length > 0 && <ResultGroup title="Tables">{tables.map((item) => <Link href="/tables" key={item.id} className="search-result"><strong>{item.name}</strong><span>{item.status}</span></Link>)}</ResultGroup>}
    {customers.length > 0 && <ResultGroup title="Customers">{customers.map((item) => <Link href={`/customers/${item.id}`} key={item.id} className="search-result"><strong>{item.full_name}</strong><span>{item.phone ?? item.email ?? "Customer"}</span></Link>)}</ResultGroup>}
    {bookings.length > 0 && <ResultGroup title="Bookings">{bookings.map((item) => <Link href="/bookings" key={item.id} className="search-result"><strong>{item.customer_name} · {item.snooker_tables?.name}</strong><span>{formatClubDateTime(item.start_time, club.timezone)}</span></Link>)}</ResultGroup>}
    {orders.length > 0 && <ResultGroup title="Orders">{orders.map((item) => <Link href={`/orders/${item.id}/receipt`} key={item.id} className="search-result"><strong>#{item.order_number}</strong><span>{formatMoney(item.total_amount, club.currency)}</span></Link>)}</ResultGroup>}
  </div> : <section className="panel"><EmptyState title="No matching tables, customers, bookings or orders." /></section>}</>;
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-head"><h2 className="panel-title">{title}</h2></div><div className="search-results">{children}</div></section>;
}
