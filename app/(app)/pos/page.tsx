import Link from "next/link";
import { getAppContext } from "@/lib/data";
import { PosPanel } from "@/components/pos-panel";
import { SessionTimer } from "@/components/session-timer";
import type { Product,TableSession } from "@/types/domain";

export const metadata={title:"POS"};export const dynamic="force-dynamic";
export default async function PosPage({searchParams}:{searchParams:Promise<{session?:string}>}){
  const {supabase,club,profile}=await getAppContext();const params=await searchParams;
  const [{data:sessionsData},{data:productsData},{data:settingsData}]=await Promise.all([supabase.from("table_sessions").select("*,snooker_tables(name)").in("status",["active","paused"]).order("start_time"),supabase.from("products").select("*,product_categories(name)").eq("is_active",true).order("name"),supabase.from("club_settings").select("key,value").in("key",["tax_rate","billing_precision"])]);
  const sessions=(sessionsData??[]) as TableSession[];const products=(productsData??[]) as Product[];const selected=sessions.find((s)=>s.id===params.session)??sessions[0]??null;const settings=Object.fromEntries((settingsData??[]).map(x=>[x.key,x.value]));
  return <><div className="page-head"><div><h1 className="page-title">Point of Sale</h1><p className="page-subtitle">Add items, settle table time and take payment.</p></div></div><div className="pos-page-layout"><aside className="panel session-selector"><div className="panel-head"><h2 className="panel-title">Open tabs</h2></div><div className="data-list"><Link href="/pos" className={`session-option ${!selected?"active":""}`}><span>Counter sale</span><small>No table</small></Link>{sessions.map((session)=><Link href={`/pos?session=${session.id}`} className={`session-option ${selected?.id===session.id?"active":""}`} key={session.id}><span>{session.snooker_tables?.name}</span><small><SessionTimer startedAt={session.start_time} pausedSeconds={session.total_paused_seconds}/></small></Link>)}</div></aside><PosPanel products={products} session={selected} currency={club.currency} role={profile.role} taxRate={Number(settings.tax_rate??0)} billingPrecision={(Number(settings.billing_precision??1) as 1|5|15|60)} fullPage/></div></>;
}
