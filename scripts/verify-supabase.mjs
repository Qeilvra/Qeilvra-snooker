import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [profiles, anonymousClubs] = await Promise.all([
  admin.from("profiles").select("*", { count: "exact", head: true }),
  anonymous.from("clubs").select("id"),
]);

const namedResults = { profiles };
for (const [name, result] of Object.entries(namedResults)) {
  if (result.error) {
    console.error(JSON.stringify({ query: name, error: result.error }));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  profiles: profiles.count,
  anonymous_club_access_blocked: Boolean(anonymousClubs.error) || anonymousClubs.data.length === 0,
}));
