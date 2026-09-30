import Link from "next/link";
import { CalendarPlus, Square } from "lucide-react";
import { formatMoney, formatTime } from "@/lib/format";
import { SessionTimer } from "@/components/session-timer";
import { TableVisual } from "@/components/table-visual";
import { endSession } from "@/app/(app)/tables/actions";
import { StartSessionButton } from "@/components/start-session-button";
import type { SnookerTable } from "@/types/domain";
import { ConfirmSubmit } from "@/components/confirm-submit";

export function TableCard({ table, currency, timezone, compact = false }: { table: SnookerTable; currency: string; timezone: string; compact?: boolean }) {
  const session = table.table_sessions?.find((item) => item.status === "active" || item.status === "paused");
  const booking = table.bookings?.find((item) => item.status === "confirmed");
  const effectiveStatus = table.status === "available" && booking ? "reserved" : table.status;
  const statusLabel = { available:"Available", occupied:"In Use", reserved:"Reserved", maintenance:"Maintenance", inactive:"Inactive" }[effectiveStatus];
  return <article className={`table-card ${effectiveStatus}`}>
    <TableVisual/>
    <div className="table-info">
      <div className="table-name-row"><span className="table-name">{table.name}</span>{session && <span className="timer"><SessionTimer startedAt={session.start_time} pausedSeconds={session.total_paused_seconds}/></span>}</div>
      <span className={`status ${effectiveStatus}`}>{statusLabel}</span>
      <div className="rate">{booking ? `Starts ${formatTime(booking.start_time, timezone)}` : `${formatMoney(table.game_rate,currency)} / game`}</div>
      <div className="card-actions">
        {effectiveStatus === "available" && <><Link className="btn btn-sm" href={`/bookings?table=${table.id}`}><CalendarPlus size={14}/>Book</Link><StartSessionButton tableId={table.id}/></>}
        {session && <><Link className="btn btn-sm" href={`/pos?session=${session.id}`}>Add items</Link><form action={endSession} style={{flex:1}}><input type="hidden" name="sessionId" value={session.id}/><ConfirmSubmit className="btn btn-danger btn-sm btn-block" message={`End the active session on ${table.name}?`} pendingText="Ending…"><Square size={13}/>End</ConfirmSubmit></form></>}
        {effectiveStatus === "reserved" && <Link className="btn btn-blue btn-sm btn-block" href={`/bookings?table=${table.id}`}>View booking</Link>}
        {(table.status === "maintenance" || table.status === "inactive") && !compact && <Link className="btn btn-sm btn-block" href={`/tables?edit=${table.id}`}>Manage table</Link>}
      </div>
    </div>
  </article>;
}
