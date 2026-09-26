"use client";

import { useMemo, useState } from "react";
import { TableCard } from "@/components/table-card";
import { EmptyState } from "@/components/empty-state";
import type { SnookerTable, TableStatus } from "@/types/domain";
import { Grid2X2, List } from "lucide-react";

type Filter = "all" | TableStatus;
export function TableBrowser({ tables, currency, timezone }: { tables: SnookerTable[]; currency: string; timezone: string }) {
  const [filter,setFilter] = useState<Filter>("all");
  const [view,setView] = useState<"grid"|"list">("grid");
  const effectiveStatus = (table: SnookerTable): TableStatus => table.status === "available" && table.bookings?.some((booking) => booking.status === "confirmed") ? "reserved" : table.status;
  const shown = useMemo(() => tables.filter((table) => filter === "all" || effectiveStatus(table) === filter),[tables,filter]);
  const filters: [Filter,string][] = [["all","All"],["available","Available"],["occupied","In Use"],["reserved","Reserved"],["maintenance","Maintenance"]];
  return <section className="panel tables-panel"><div className="panel-head"><h2 className="panel-title">Tables</h2><div className="panel-actions"><div className="segmented" role="tablist" aria-label="Table status">{filters.map(([value,label]) => <button key={value} className={`segment ${filter===value?"active":""}`} onClick={()=>setFilter(value)} role="tab" aria-selected={filter===value}>{label} ({value === "all" ? tables.length : tables.filter((t)=>effectiveStatus(t)===value).length})</button>)}</div><div className="segmented view-toggle" aria-label="Table view"><button className={`segment ${view==="grid"?"active":""}`} onClick={()=>setView("grid")} aria-label="Floor view"><Grid2X2 size={15}/></button><button className={`segment ${view==="list"?"active":""}`} onClick={()=>setView("list")} aria-label="List view"><List size={16}/></button></div></div></div>{shown.length ? <div className={`table-grid ${view==="list"?"list-view":""}`}>{shown.map((table)=><TableCard key={table.id} table={table} currency={currency} timezone={timezone}/>)}</div> : <EmptyState title="No tables match this filter"/>}</section>;
}
