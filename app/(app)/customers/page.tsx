import Link from "next/link";
import { getAppContext } from "@/lib/data";
import { CustomerForm } from "@/components/customer-form";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase } = await getAppContext();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const size = 25;
  const from = (page - 1) * size;
  const term = params.q?.replace(/[%_,]/g, "");
  let query = supabase.from("customers").select("id,full_name,phone,email,total_visits", { count: "exact" }).order("created_at", { ascending: false });
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data, count } = await query.range(from, from + size - 1);
  const customers = data ?? [];
  const querySuffix = term ? `&q=${encodeURIComponent(params.q ?? "")}` : "";
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / size));

  return <>
    <div className="page-head"><div><h1 className="page-title">Customers</h1><p className="page-subtitle">Profiles for repeat guests. Walk-ins do not require an account.</p></div></div>
    <div className="split-layout">
      <section className="panel">
        <div className="panel-head"><form style={{ display: "flex", gap: 7, width: "100%" }}><input className="field" name="q" defaultValue={params.q} placeholder="Search name or phone"/><button className="btn">Search</button></form></div>
        {customers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Visits</th><th></th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.full_name}</strong></td><td>{customer.phone ?? "—"}</td><td>{customer.email ?? "—"}</td><td>{customer.total_visits}</td><td><Link className="btn btn-sm" href={`/customers/${customer.id}`}>View</Link></td></tr>)}</tbody></table></div> : <EmptyState title="No customers found."/>}
        <div className="pagination"><Link className={`btn btn-sm ${page <= 1 ? "disabled" : ""}`} href={`/customers?page=${Math.max(1, page - 1)}${querySuffix}`}>Previous</Link><span>Page {page} of {pageCount} · {count ?? 0} customers</span><Link className={`btn btn-sm ${page >= pageCount ? "disabled" : ""}`} href={`/customers?page=${page + 1}${querySuffix}`}>Next</Link></div>
      </section>
      <CustomerForm/>
    </div>
  </>;
}
