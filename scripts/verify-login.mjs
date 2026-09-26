import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { "User-Agent": "Qeilvra-Server/1.0" } },
});
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError || !signIn.user) throw signInError ?? new Error("No user returned");
const { data: profile, error: profileError } = await client
  .from("profiles")
  .select("full_name, role, club_id")
  .eq("auth_user_id", signIn.user.id)
  .single();
if (profileError || !profile) throw profileError ?? new Error("No profile returned");
console.log(JSON.stringify({ login: "ok", role: profile.role, club_id: profile.club_id }));
