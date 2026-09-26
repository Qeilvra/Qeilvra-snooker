import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
if (!email || !password) throw new Error("Usage: node scripts/bootstrap-owner.mjs <email> <password>");

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
  global: { headers: { "User-Agent": "Qeilvra-Server/1.0" } },
});

const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Club Owner" },
});

let user = created.data.user;
if (created.error) {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  user = listed.data.users.find((candidate) => candidate.email === email);
  if (!user) throw created.error;
}

const { error } = await admin.from("profiles").upsert({
  auth_user_id: user.id,
  club_id: "11111111-1111-4111-8111-111111111111",
  full_name: "Club Owner",
  email,
  role: "owner",
  is_active: true,
}, { onConflict: "auth_user_id" });

if (error) throw error;
console.log(`OWNER_READY ${email}`);
