import Link from "next/link";
import { cancelBooking, startBooking } from "./actions";
import { getAppContext, dateInTimezone } from "@/lib/data";
import { formatMoney, formatTime } from "@/lib/format";
import { BookingForm } from "@/components/booking-form";
import { EmptyState } from "@/components/empty-state";
import { ConfirmSubmit } from "@/components/confirm-submit";
import type { Booking, SnookerTable } from "@/types/domain";

export const metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

function localInput(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23" }).formatToParts(new Date(value));
  const read = (type:string) => parts.find((part)=>part.type===type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{table?:string;date?:string;edit?:string}> }) {
  const { supabase, club } = await getAppContext();
  const params = await searchParams;
  const date = params.date ?? dateInTimezone(new Date(), club.timezone);
  const [{data:tablesData},{data:bookingsData}] = await Promise.all([
    supabase.from("snooker_tables").select("id,name,status,is_active").eq("is_active",true).order("sort_order"),
    supabase.from("bookings").select("id,table_id,customer_name,customer_phone,start_time,end_time,game_rate,estimated_amount,status,notes,snooker_tables:snooker_tables!bookings_table_same_club(name)").eq("booking_date",date).order("start_time"),
  ]);
  const tables=(tablesData??[]) as SnookerTable[];
  const bookings=(bookingsData??[]) as unknown as Booking[];
  const editing=bookings.find((booking)=>booking.id===params.edit&&["pending","confirmed"].includes(booking.status));
  return <><div className="page-head"><div><h1 className="page-title">Bookings</h1><p className="page-subtitle">Daily reservations in {club.timezone}.</p></div><form style={{display:"flex",gap:7}}><input className="field" type="date" name="date" defaultValue={date}/><button className="btn">View</button></form></div><div className="split-layout"><section className="panel"><div className="panel-head"><h2 className="panel-title">{date}</h2></div>{bookings.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Table</th><th>Customer</th><th>Estimate</th><th>Status</th><th>Action</th></tr></thead><tbody>{bookings.map((booking)=><tr key={booking.id}><td>{formatTime(booking.start_time,club.timezone)} to {formatTime(booking.end_time,club.timezone)}</td><td>{booking.snooker_tables?.name}</td><td>{booking.customer_name}<br/><span className="help">{booking.customer_phone}</span></td><td>{formatMoney(booking.estimated_amount,club.currency)}</td><td><span className={`badge ${booking.status==="confirmed"?"green":booking.status==="cancelled"?"red":"amber"}`}>{booking.status}</span></td><td style={{display:"flex",gap:5}}>{booking.status==="confirmed"&&<><Link className="btn btn-sm" href={`/bookings?date=${date}&edit=${booking.id}`}>Edit</Link><form action={startBooking}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="tableId" value={booking.table_id}/><button className="btn btn-primary btn-sm">Start</button></form><form action={cancelBooking}><input type="hidden" name="id" value={booking.id}/><ConfirmSubmit className="btn btn-danger btn-sm" message={`Cancel the booking for ${booking.customer_name}?`}>Cancel</ConfirmSubmit></form></>}</td></tr>)}</tbody></table></div>:<EmptyState title="No bookings on this date."/>}</section><BookingForm tables={tables} selected={params.table} booking={editing} localStart={editing?localInput(editing.start_time,club.timezone):undefined} localEnd={editing?localInput(editing.end_time,club.timezone):undefined}/></div></>;
}
