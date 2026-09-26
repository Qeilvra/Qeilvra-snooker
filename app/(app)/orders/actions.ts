"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/data";
import { can } from "@/lib/permissions";

export async function refundOrder(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(300) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("A refund reason is required.");
  const { supabase, profile } = await getAppContext();
  if (!can(profile.role, "refunds.create")) throw new Error("Manager permission is required.");
  const { error } = await supabase.rpc("refund_order", { p_order_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) throw new Error("This order cannot be refunded.");
  revalidatePath("/orders");
  revalidatePath("/inventory");
  revalidatePath("/reports");
}
