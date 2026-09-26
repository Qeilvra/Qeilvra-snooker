import { getAppContext } from "@/lib/data";
import { can } from "@/lib/permissions";
import { TableBrowser } from "@/components/table-browser";
import { TableForm } from "@/components/table-form";
import type { SnookerTable } from "@/types/domain";

export const metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

export default async function TablesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { supabase,club,profile } = await getAppContext();
  const params = await searchParams;
  const now = new Date();
  const reservationHorizon = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("snooker_tables").select("*, table_sessions:table_sessions!sessions_table_same_club(id,table_id,start_time,end_time,total_paused_seconds,hourly_rate,table_charge,status), bookings:bookings!bookings_table_same_club(id,table_id,customer_name,customer_phone,booking_date,start_time,end_time,duration_minutes,hourly_rate,estimated_amount,status,notes)").in("table_sessions.status",["active","paused"]).eq("bookings.status","confirmed").gte("bookings.start_time",now.toISOString()).lte("bookings.start_time",reservationHorizon).order("sort_order");
  const tables=(data??[]) as SnookerTable[];
  const editing=tables.find((table)=>table.id===params.edit);
  return <><div className="page-head"><div><h1 className="page-title">Tables</h1><p className="page-subtitle">Live status, rates and active sessions.</p></div></div><div className={can(profile.role,"tables.manage")?"split-layout":""}><TableBrowser tables={tables} currency={club.currency} timezone={club.timezone}/>{can(profile.role,"tables.manage")&&<TableForm table={editing}/>}</div></>;
}
