import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Club, Profile } from "@/types/domain";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("auth_user_id", user.id).eq("is_active", true).single();
  if (!profile) return <main className="auth-form-wrap"><div className="auth-form"><h2>Profile setup required</h2><p>Your login exists but is not assigned to an active club profile. Ask the club owner to finish your staff setup.</p></div></main>;
  const { data: club } = await supabase.from("clubs").select("*").eq("id", profile.club_id).single();
  if (!club) return <main className="auth-form-wrap"><div className="auth-form"><h2>Club unavailable</h2><p>Your club record could not be loaded.</p></div></main>;
  return <AppShell profile={profile as Profile} club={club as Club}>{children}</AppShell>;
}
