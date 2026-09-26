"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/data";
import { can } from "@/lib/permissions";

export type ActionState = { error?: string; success?: string; id?: string };

export async function startSession(formData: FormData) {
  const tableId = z.string().uuid().safeParse(formData.get("tableId"));
  if (!tableId.success) return;
  try {
    const { supabase, profile } = await getAppContext();
    if (!can(profile.role, "sessions.use")) return;
    const { error } = await supabase.rpc("start_table_session", { p_table_id: tableId.data });
    if (error) return;
    revalidatePath("/dashboard"); revalidatePath("/tables"); revalidatePath("/pos");
  } catch (error) { console.error("Start session failed", error); }
}

export async function endSession(formData: FormData) {
  const sessionId = z.string().uuid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) return;
  try {
    const { supabase, profile } = await getAppContext();
    if (!can(profile.role, "sessions.use")) return;
    const { error } = await supabase.rpc("end_table_session", { p_session_id: sessionId.data, p_rounding_minutes: 1 });
    if (error) return;
    revalidatePath("/dashboard"); revalidatePath("/tables"); revalidatePath("/pos");
  } catch (error) { console.error("End session failed", error); }
}

const tableSchema = z.object({
  name: z.string().trim().min(2).max(60),
  table_number: z.coerce.number().int().positive(),
  game_rate: z.coerce.number().nonnegative(),
  status: z.enum(["available","maintenance","inactive"]),
});

export async function saveTable(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid name, table number and game price." };
  const { supabase, club, profile } = await getAppContext();
  if (!can(profile.role, "tables.manage")) return { error: "Manager permission is required." };
  const id = formData.get("id");
  const query = id ? supabase.from("snooker_tables").update(parsed.data).eq("id", String(id)) : supabase.from("snooker_tables").insert({ ...parsed.data, club_id: club.id });
  const { error } = await query;
  if (error) return { error: error.code === "23505" ? "That table number is already in use." : "The table could not be saved." };
  revalidatePath("/tables"); revalidatePath("/dashboard");
  return { success: id ? "Table updated." : "Table added." };
}
