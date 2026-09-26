"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext, zonedDateTimeToUtc } from "@/lib/data";
import { can } from "@/lib/permissions";
import type { ActionState } from "@/app/(app)/tables/actions";

const bookingSchema = z.object({ table_id:z.string().uuid(),customer_name:z.string().trim().min(2).max(100),customer_phone:z.string().trim().max(30).optional(),start_time:z.string(),end_time:z.string(),game_rate:z.coerce.number().nonnegative(),notes:z.string().max(500).optional() });

export async function createBooking(_:ActionState,formData:FormData):Promise<ActionState>{
  const parsed=bookingSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success)return{error:"Complete the required booking fields."};
  const {supabase,club,profile}=await getAppContext();
  if(!can(profile.role,"bookings.manage"))return{error:"You do not have booking access."};
  let start:Date,end:Date;
  try{start=zonedDateTimeToUtc(parsed.data.start_time,club.timezone);end=zonedDateTimeToUtc(parsed.data.end_time,club.timezone);}catch{return{error:"Enter valid booking times."};}
  if(end<=start)return{error:"End time must be after start time."};
  const duration=Math.round((end.getTime()-start.getTime())/60000);
  const values={club_id:club.id,table_id:parsed.data.table_id,customer_name:parsed.data.customer_name,customer_phone:parsed.data.customer_phone||null,booking_date:parsed.data.start_time.slice(0,10),start_time:start.toISOString(),end_time:end.toISOString(),duration_minutes:duration,game_rate:parsed.data.game_rate,estimated_amount:parsed.data.game_rate,status:"confirmed" as const,notes:parsed.data.notes||null};
  const id=z.string().uuid().safeParse(formData.get("id"));
  const query=id.success?supabase.from("bookings").update(values).eq("id",id.data).in("status",["pending","confirmed"]):supabase.from("bookings").insert({...values,created_by:profile.id});
  const {error}=await query;
  if(error)return{error:error.code==="23P01"?"That table already has a confirmed booking during this time.":"The booking could not be created."};
  revalidatePath("/bookings");revalidatePath("/dashboard");revalidatePath("/tables");return{success:id.success?"Booking updated.":"Booking confirmed."};
}

export async function cancelBooking(formData:FormData){
  const id=z.string().uuid().safeParse(formData.get("id"));if(!id.success)return;
  const {supabase,profile}=await getAppContext();if(!can(profile.role,"bookings.manage"))return;
  await supabase.from("bookings").update({status:"cancelled"}).eq("id",id.data).in("status",["pending","confirmed"]);
  revalidatePath("/bookings");revalidatePath("/dashboard");revalidatePath("/tables");
}

export async function startBooking(formData:FormData){
  const bookingId=z.string().uuid().safeParse(formData.get("bookingId"));const tableId=z.string().uuid().safeParse(formData.get("tableId"));
  if(!bookingId.success||!tableId.success)return;
  try {const {supabase}=await getAppContext();const {error}=await supabase.rpc("start_table_session",{p_table_id:tableId.data,p_booking_id:bookingId.data,p_customer_id:null});if(error)return;revalidatePath("/bookings");revalidatePath("/dashboard");revalidatePath("/tables");} catch(error) {console.error("Start booking failed",error);}
}
