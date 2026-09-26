import Link from "next/link";
import { refundOrder } from "./actions";
import { getAppContext } from "@/lib/data";
import { can } from "@/lib/permissions";
import { formatMoney,formatClubDateTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import type { Order } from "@/types/domain";

export const metadata={title:"Orders"};export const dynamic="force-dynamic";
export default async function OrdersPage({searchParams}:{searchParams:Promise<{page?:string}>}){
  const {supabase,club,profile}=await getAppContext();const params=await searchParams;const page=Math.max(1,Number(params.page)||1);const size=25;const from=(page-1)*size;
  const {data,count}=await supabase.from("orders").select("*,snooker_tables(name),profiles!orders_created_by_fkey(full_name)",{count:"exact"}).order("created_at",{ascending:false}).range(from,from+size-1);const orders=(data??[]) as Order[];
  return <><div className="page-head"><div><h1 className="page-title">Orders</h1><p className="page-subtitle">Completed sales and printable receipts.</p></div></div><section className="panel">{orders.length?<><div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Date</th><th>Table</th><th>Staff</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>{orders.map((order)=><tr key={order.id}><td><strong>#{order.order_number}</strong></td><td>{formatClubDateTime(order.created_at,club.timezone)}</td><td>{order.snooker_tables?.name??"Counter"}</td><td>{order.profiles?.full_name??"Staff"}</td><td><span className={`badge ${order.payment_status==="paid"?"green":"amber"}`}>{order.payment_status}</span></td><td><strong>{formatMoney(order.total_amount,club.currency)}</strong></td><td><div style={{display:"flex",gap:6}}><Link className="btn btn-sm" href={`/orders/${order.id}/receipt`}>Receipt</Link>{can(profile.role,"refunds.create")&&order.order_status==="completed"&&<details className="refund-details"><summary className="btn btn-danger btn-sm">Refund</summary><form action={refundOrder}><input type="hidden" name="id" value={order.id}/><input className="field" name="reason" placeholder="Refund reason" required/><button className="btn btn-danger btn-sm">Confirm</button></form></details>}</div></td></tr>)}</tbody></table></div><div className="pagination"><Link className={`btn btn-sm ${page<=1?"disabled":""}`} href={`/orders?page=${Math.max(1,page-1)}`}>Previous</Link><span>Page {page} of {Math.max(1,Math.ceil((count??0)/size))}</span><Link className={`btn btn-sm ${from+size>=(count??0)?"disabled":""}`} href={`/orders?page=${page+1}`}>Next</Link></div></>:<EmptyState title="No orders recorded."/>}</section></>;
}
