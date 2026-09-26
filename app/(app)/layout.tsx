import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { getAuthenticatedContext } from "@/lib/data";
import type { Club, Profile } from "@/types/domain";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv()) redirect("/login");
  const { profile, club } = await getAuthenticatedContext();
  if (!profile) return <main className="auth-form-wrap"><div className="auth-form"><h2>Profile setup required</h2><p>Your login exists but is not assigned to an active club profile. Ask the club owner to finish your staff setup.</p></div></main>;
  if (!club) return <main className="auth-form-wrap"><div className="auth-form"><h2>Club unavailable</h2><p>Your club record could not be loaded.</p></div></main>;
  return <AppShell profile={profile as Profile} club={club as Club}>{children}</AppShell>;
}
