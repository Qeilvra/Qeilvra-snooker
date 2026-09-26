"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; success?: string };

const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "The email or password is incorrect." };
  redirect("/dashboard");
}

export async function requestReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${baseUrl}/reset-password` });
  if (error) return { error: "We could not send the reset email. Try again." };
  return { success: "Check your inbox for a secure password reset link." };
}

export async function resetPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success) return { error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "The reset link is invalid or expired." };
  redirect("/dashboard");
}
