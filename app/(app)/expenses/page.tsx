import Link from "next/link";
import { deleteExpense } from "./actions";
import { getAppContext, dateInTimezone } from "@/lib/data";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/format";
import { ExpenseForm } from "@/components/expense-form";
import { EmptyState } from "@/components/empty-state";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ edit?: string; page?: string }> }) {
  const { supabase, club, profile } = await getAppContext();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const size = 50;
  const from = (page - 1) * size;
  const { data, count } = await supabase.from("expenses").select("id,category,description,amount,expense_date,payment_method,profiles:profiles!expenses_creator_same_club(full_name)", { count: "exact" }).order("expense_date", { ascending: false }).range(from, from + size - 1);
  const expenses = (data ?? []) as unknown as { id: string; category: string; description: string; amount: number; expense_date: string; payment_method: string; profiles: { full_name: string } | null }[];
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const editing = expenses.find((expense) => expense.id === params.edit);
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / size));

  return <>
    <div className="page-head"><div><h1 className="page-title">Expenses</h1><p className="page-subtitle">Operational costs included in net revenue reporting.</p></div><div><span className="help">Visible total</span><div className="metric-value">{formatMoney(total, club.currency)}</div></div></div>
    <div className={can(profile.role, "expenses.manage") ? "split-layout" : ""}>
      <section className="panel">
        {expenses.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th>Staff</th><th>Amount</th><th></th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td>{expense.expense_date}</td><td>{expense.category}</td><td>{expense.description}</td><td>{expense.payment_method}</td><td>{expense.profiles?.full_name}</td><td><strong>{formatMoney(expense.amount, club.currency)}</strong></td><td><div style={{ display: "flex", gap: 5 }}><Link className="btn btn-sm" href={`/expenses?page=${page}&edit=${expense.id}`}>Edit</Link><form action={deleteExpense}><input type="hidden" name="id" value={expense.id}/><ConfirmSubmit className="btn btn-danger btn-sm" message={`Delete the expense “${expense.description}”?`}>Delete</ConfirmSubmit></form></div></td></tr>)}</tbody></table></div> : <EmptyState title="No expenses recorded."/>}
        <div className="pagination"><Link className={`btn btn-sm ${page <= 1 ? "disabled" : ""}`} href={`/expenses?page=${Math.max(1, page - 1)}`}>Previous</Link><span>Page {page} of {pageCount} · {count ?? 0} expenses</span><Link className={`btn btn-sm ${page >= pageCount ? "disabled" : ""}`} href={`/expenses?page=${page + 1}`}>Next</Link></div>
      </section>
      {can(profile.role, "expenses.manage") && <ExpenseForm today={dateInTimezone(new Date(), club.timezone)} expense={editing}/>}
    </div>
  </>;
}
