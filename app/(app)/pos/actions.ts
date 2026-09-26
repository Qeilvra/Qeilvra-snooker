"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/data";
import { can } from "@/lib/permissions";

export type SaleState = { error?: string; success?: string; orderId?: string; orderNumber?: string };

const saleSchema = z.object({
  tableId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() })),
  discount: z.number().min(0),
  paymentMethod: z.enum(["cash","card","bank","mobile_wallet","other","split"]),
  splitCash: z.number().min(0).optional(),
});

export async function completeSale(_: SaleState, formData: FormData): Promise<SaleState> {
  let raw: unknown;
  try { raw = JSON.parse(String(formData.get("payload"))); } catch { return { error: "The order data is invalid." }; }
  const parsed = saleSchema.safeParse(raw);
  if (!parsed.success) return { error: "Review the order items and payment method." };
  try {
    const { supabase, profile } = await getAppContext();
    if (!can(profile.role,"pos.use")) return { error: "You do not have POS access." };
    if (parsed.data.discount > 0 && !can(profile.role,"discounts.apply")) return { error: "A manager must approve this discount." };
    if (!parsed.data.sessionId && parsed.data.items.length === 0) return { error: "Add at least one product." };
    const payments = parsed.data.paymentMethod === "split"
      ? [{ method: "cash", amount: parsed.data.splitCash ?? 0 }, { method: "card", amount: null }]
      : [{ method: parsed.data.paymentMethod, amount: null }];
    const { data, error } = await supabase.rpc("complete_order", {
      p_table_id: parsed.data.tableId,
      p_session_id: parsed.data.sessionId,
      p_items: parsed.data.items,
      p_discount: parsed.data.discount,
      p_tax: 0,
      p_payments: payments,
      p_notes: null,
    }).single();
    if (error || !data) {
      const message = error?.message ?? "";
      if (message.includes("Insufficient stock")) return { error: message };
      if (message.includes("permission")) return { error: "Manager approval is required." };
      return { error: "The sale could not be completed. No payment or stock change was recorded." };
    }
    revalidatePath("/dashboard"); revalidatePath("/tables"); revalidatePath("/pos"); revalidatePath("/orders"); revalidatePath("/inventory"); revalidatePath("/reports");
    const order = data as { id: string; order_number: string };
    return { success: "Payment recorded and order completed.", orderId: order.id, orderNumber: order.order_number };
  } catch (error) {
    console.error("Complete order failed", error);
    return { error: "The sale could not be completed. No payment or stock change was recorded." };
  }
}
