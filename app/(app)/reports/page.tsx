import { getAppContext, dateInTimezone, zonedDateTimeToUtc } from "@/lib/data";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/format";
import { RevenueChart, ProductChart, PaymentChart } from "@/components/report-charts";
import { EmptyState } from "@/components/empty-state";
import { recognizedSessionIds, totalRecognizedRevenue } from "@/lib/revenue";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

interface ReportSummary {
  revenue: number;
  expenseTotal: number;
  tableRevenue: number;
  trend: { date: string; revenue: number; expenses: number }[];
  topProducts: { name: string; quantity: number }[];
  paymentData: { name: string; value: number }[];
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { supabase, club, profile } = await getAppContext();
  if (!can(profile.role, "reports.view")) return <div className="error-banner">Your role does not include access to sensitive reports.</div>;

  const params = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 29 * 86400000);
  const from = params.from ?? dateInTimezone(defaultFrom, club.timezone);
  const to = params.to ?? dateInTimezone(now, club.timezone);
  const afterTo = new Date(`${to}T00:00:00Z`);
  afterTo.setUTCDate(afterTo.getUTCDate() + 1);
  const start = zonedDateTimeToUtc(`${from}T00:00`, club.timezone).toISOString();
  const end = zonedDateTimeToUtc(`${afterTo.toISOString().slice(0, 10)}T00:00`, club.timezone).toISOString();
  const summary = await loadReportSummary(supabase, club.timezone, { start, end, from, to });

  return <>
    <div className="page-head"><div><h1 className="page-title">Reports</h1><p className="page-subtitle">Sales, expenses and operations from real club data.</p></div><form style={{ display: "flex", gap: 7 }}><input className="field" type="date" name="from" defaultValue={from}/><input className="field" type="date" name="to" defaultValue={to}/><button className="btn">Apply</button></form></div>
    <section className="metric-grid"><div className="metric-card"><div><div className="metric-label">Gross revenue</div><div className="metric-value">{formatMoney(summary.revenue, club.currency)}</div></div></div><div className="metric-card blue"><div><div className="metric-label">Table revenue</div><div className="metric-value">{formatMoney(summary.tableRevenue, club.currency)}</div></div></div><div className="metric-card amber"><div><div className="metric-label">Expenses</div><div className="metric-value">{formatMoney(summary.expenseTotal, club.currency)}</div></div></div><div className="metric-card violet"><div><div className="metric-label">Net revenue</div><div className="metric-value">{formatMoney(summary.revenue - summary.expenseTotal, club.currency)}</div></div></div></section>
    {summary.trend.length ? <div className="report-grid"><section className="panel"><div className="panel-head"><h2 className="panel-title">Revenue trend</h2></div><div className="chart-wrap"><RevenueChart data={summary.trend} currency={club.currency}/></div></section><section className="panel"><div className="panel-head"><h2 className="panel-title">Payment methods</h2></div><div className="chart-wrap"><PaymentChart data={summary.paymentData}/></div></section><section className="panel"><div className="panel-head"><h2 className="panel-title">Top products</h2></div><div className="chart-wrap"><ProductChart data={summary.topProducts}/></div></section></div> : <section className="panel"><EmptyState title="No report data in this date range."/></section>}
  </>;
}

type SupabaseClient = Awaited<ReturnType<typeof getAppContext>>["supabase"];

async function loadReportSummary(supabase: SupabaseClient, timezone: string, range: { start: string; end: string; from: string; to: string }): Promise<ReportSummary> {
  const { data, error } = await supabase.rpc("get_report_summary", {
    p_start: range.start,
    p_end: range.end,
    p_from: range.from,
    p_to: range.to,
  }).single();

  if (!error && data) {
    const result = data as { total_revenue: number; expense_total: number; table_revenue: number; trend: unknown; top_products: unknown; payment_data: unknown };
    const trend = (Array.isArray(result.trend) ? result.trend : []) as { date: string; revenue: number; expenses: number }[];
    const topProducts = (Array.isArray(result.top_products) ? result.top_products : []) as { name: string; quantity: number }[];
    const paymentData = (Array.isArray(result.payment_data) ? result.payment_data : []) as { name: string; value: number }[];
    return {
      revenue: Number(result.total_revenue),
      expenseTotal: Number(result.expense_total),
      tableRevenue: Number(result.table_revenue),
      trend: trend.map((point) => ({ ...point, revenue: Number(point.revenue), expenses: Number(point.expenses) })),
      topProducts: topProducts.map((product) => ({ ...product, quantity: Number(product.quantity) })),
      paymentData: paymentData.map((payment) => ({ ...payment, value: Number(payment.value) })),
    };
  }

  // Keeps the app deployable before the migration is applied; the optimized
  // RPC path is used automatically as soon as the database is up to date.
  const [{ data: orders }, { data: expenses }, { data: items }, { data: payments }, { data: sessions }] = await Promise.all([
    supabase.from("orders").select("total_amount,session_id,created_at").eq("order_status", "completed").eq("payment_status", "paid").gte("created_at", range.start).lt("created_at", range.end),
    supabase.from("expenses").select("amount,expense_date").gte("expense_date", range.from).lte("expense_date", range.to),
    supabase.from("order_items").select("product_name,quantity,orders:orders!items_order_same_club!inner(created_at,order_status,payment_status)").eq("orders.order_status", "completed").eq("orders.payment_status", "paid").gte("orders.created_at", range.start).lt("orders.created_at", range.end),
    supabase.from("payments").select("amount,payment_method,created_at,orders:orders!payments_order_same_club!inner(order_status,payment_status)").eq("orders.order_status", "completed").eq("orders.payment_status", "paid").gte("created_at", range.start).lt("created_at", range.end),
    supabase.from("table_sessions").select("id,table_charge,end_time").eq("status", "completed").gte("end_time", range.start).lt("end_time", range.end),
  ]);

  const paidOrders = orders ?? [];
  const completedSessions = sessions ?? [];
  const settledSessionIds = recognizedSessionIds(paidOrders);
  const revenue = totalRecognizedRevenue(paidOrders, completedSessions);
  const expenseTotal = (expenses ?? []).reduce((total, expense) => total + Number(expense.amount), 0);
  const tableRevenue = completedSessions.reduce((total, session) => total + Number(session.table_charge), 0);
  const byDate = new Map<string, { date: string; revenue: number; expenses: number }>();
  const addRevenue = (timestamp: string, amount: number) => {
    const key = dateInTimezone(new Date(timestamp), timezone);
    const point = byDate.get(key) ?? { date: key.slice(5), revenue: 0, expenses: 0 };
    point.revenue += amount;
    byDate.set(key, point);
  };
  paidOrders.forEach((order) => addRevenue(order.created_at, Number(order.total_amount)));
  completedSessions.filter((session) => !settledSessionIds.has(session.id) && session.end_time).forEach((session) => addRevenue(session.end_time!, Number(session.table_charge)));
  (expenses ?? []).forEach((expense) => {
    const point = byDate.get(expense.expense_date) ?? { date: expense.expense_date.slice(5), revenue: 0, expenses: 0 };
    point.expenses += Number(expense.amount);
    byDate.set(expense.expense_date, point);
  });
  const trend = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, point]) => point);
  const productMap = new Map<string, number>();
  (items ?? []).forEach((item) => productMap.set(item.product_name, (productMap.get(item.product_name) ?? 0) + item.quantity));
  const topProducts = [...productMap].map(([name, quantity]) => ({ name, quantity })).sort((left, right) => right.quantity - left.quantity).slice(0, 7);
  const paymentMap = new Map<string, number>();
  (payments ?? []).forEach((payment) => paymentMap.set(payment.payment_method, (paymentMap.get(payment.payment_method) ?? 0) + Number(payment.amount)));
  const paymentData = [...paymentMap].map(([name, value]) => ({ name, value }));
  return { revenue, expenseTotal, tableRevenue, trend, topProducts, paymentData };
}
