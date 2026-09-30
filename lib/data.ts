import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Club, Profile } from "@/types/domain";

export const getAuthenticatedContext = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect("/login");
  const user = { id: userId };
  const { data } = await supabase.from("profiles").select("id,auth_user_id,club_id,full_name,email,phone,role,avatar_url,is_active,clubs:clubs!profiles_club_id_fkey(id,name,currency,timezone,phone,email,address,logo_url)").eq("auth_user_id", userId).eq("is_active", true).single();
  if (!data) return { supabase, user, profile: null, club: null };
  const { clubs, ...profile } = data as unknown as Profile & { clubs: Club | null };
  return { supabase, user, profile, club: clubs };
});

export const getAppContext = cache(async () => {
  const { supabase, user, profile, club } = await getAuthenticatedContext();
  if (!profile) throw new Error("Active staff profile not found");
  if (!club) throw new Error("Club not found");
  return { supabase, user, profile: profile as Profile, club: club as Club };
});

export function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function localDayStartIso(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallMidnight = Date.UTC(n("year"), n("month") - 1, n("day"));
  const getOffset = (instant: Date) => {
    const zoned = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(instant);
    const z = (type: string) => Number(zoned.find((part) => part.type === type)?.value);
    return Date.UTC(z("year"), z("month") - 1, z("day"), z("hour"), z("minute"), z("second")) - instant.getTime();
  };
  const first = new Date(wallMidnight - getOffset(new Date(wallMidnight)));
  return new Date(wallMidnight - getOffset(first)).toISOString();
}

export function zonedDateTimeToUtc(localValue: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue);
  if (!match) throw new Error("Invalid local date and time");
  const [,year,month,day,hour,minute] = match.map(Number);
  const wall = Date.UTC(year,month-1,day,hour,minute);
  const offsetAt = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric",hourCycle:"h23"}).formatToParts(instant);
    const n = (type:string)=>Number(parts.find((part)=>part.type===type)?.value);
    return Date.UTC(n("year"),n("month")-1,n("day"),n("hour"),n("minute"),n("second"))-instant.getTime();
  };
  const first = new Date(wall-offsetAt(new Date(wall)));
  return new Date(wall-offsetAt(first));
}
