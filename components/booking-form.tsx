"use client";

import { useActionState } from "react";
import { createBooking } from "@/app/(app)/bookings/actions";
import type { ActionState } from "@/app/(app)/tables/actions";
import type { Booking, SnookerTable } from "@/types/domain";

export function BookingForm({ tables, selected, booking, localStart, localEnd }: { tables: SnookerTable[]; selected?: string; booking?: Booking; localStart?: string; localEnd?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBooking, {});
  return <form action={action} className="form-card">
    <h2 style={{margin:"0 0 16px",fontSize:18}}>{booking ? "Edit booking" : "New booking"}</h2>
    {state.error && <div className="error-banner">{state.error}</div>}{state.success && <div className="success-banner">{state.success}</div>}
    {booking && <input type="hidden" name="id" value={booking.id}/>}<div className="field-group"><label htmlFor="customer_name">Customer</label><input className="field" id="customer_name" name="customer_name" defaultValue={booking?.customer_name} required/></div>
    <div className="field-group" style={{marginTop:12}}><label htmlFor="customer_phone">Phone</label><input className="field" id="customer_phone" name="customer_phone" type="tel" inputMode="tel" defaultValue={booking?.customer_phone??""}/></div>
    <div className="field-group" style={{marginTop:12}}><label htmlFor="table_id">Table</label><select className="field" id="table_id" name="table_id" defaultValue={booking?.table_id??selected} required><option value="">Select table</option>{tables.filter((t)=>t.is_active&&t.status!=="maintenance").map((table)=><option value={table.id} key={table.id}>{table.name}</option>)}</select></div>
    <div className="form-grid" style={{marginTop:12}}><div className="field-group"><label htmlFor="start_time">Starts</label><input className="field" id="start_time" name="start_time" type="datetime-local" defaultValue={localStart} required/></div><div className="field-group"><label htmlFor="end_time">Ends</label><input className="field" id="end_time" name="end_time" type="datetime-local" defaultValue={localEnd} required/></div></div>
    <div className="field-group" style={{marginTop:12}}><label htmlFor="hourly_rate">Hourly rate</label><input className="field" id="hourly_rate" name="hourly_rate" type="number" min="0" step="0.01" defaultValue={booking?.hourly_rate} required/></div>
    <div className="field-group" style={{marginTop:12}}><label htmlFor="notes">Notes</label><textarea className="field" id="notes" name="notes" defaultValue={booking?.notes??""}/></div>
    <button className="btn btn-primary btn-block" style={{marginTop:16}} disabled={pending}>{pending?"Checking availability…":booking?"Save booking":"Confirm booking"}</button>
  </form>;
}
