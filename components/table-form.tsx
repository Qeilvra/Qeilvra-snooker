"use client";

import { useActionState } from "react";
import { saveTable, type ActionState } from "@/app/(app)/tables/actions";
import type { SnookerTable } from "@/types/domain";

export function TableForm({ table }: { table?: SnookerTable }) {
  const [state,action,pending] = useActionState<ActionState,FormData>(saveTable,{});
  return <form action={action} className="form-card">
    <h2 style={{margin:"0 0 16px",fontSize:18}}>{table?"Edit table":"Add table"}</h2>
    {state.error && <div className="error-banner">{state.error}</div>}{state.success && <div className="success-banner">{state.success}</div>}
    {table && <input type="hidden" name="id" value={table.id}/>}<div className="field-group"><label htmlFor="name">Table name</label><input className="field" id="name" name="name" defaultValue={table?.name} placeholder="Table 9" required/></div>
    <div className="form-grid" style={{marginTop:13}}><div className="field-group"><label htmlFor="table_number">Number</label><input className="field" id="table_number" name="table_number" type="number" min="1" defaultValue={table?.table_number} required/></div><div className="field-group"><label htmlFor="game_rate">Game price</label><input className="field" id="game_rate" name="game_rate" type="number" min="0" step="0.01" defaultValue={table?.game_rate} required/></div></div>
    <div className="field-group" style={{marginTop:13}}><label htmlFor="status">Status</label><select className="field" id="status" name="status" defaultValue={table && ["available","maintenance","inactive"].includes(table.status)?table.status:"available"}><option value="available">Available</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></div>
    <button className="btn btn-primary btn-block" style={{marginTop:16}} disabled={pending}>{pending?"Saving…":table?"Save changes":"Add table"}</button>
  </form>;
}
