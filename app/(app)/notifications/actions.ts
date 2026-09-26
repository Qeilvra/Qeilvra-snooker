"use server";import {revalidatePath} from "next/cache";import {getAppContext} from "@/lib/data";
export async function markNotificationsRead(){const{supabase,profile}=await getAppContext();await supabase.from("notifications").update({read_at:new Date().toISOString()}).is("read_at",null).or(`profile_id.is.null,profile_id.eq.${profile.id}`);revalidatePath("/notifications");}
