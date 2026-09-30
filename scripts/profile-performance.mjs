import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

function readEnv(path = ".env.local") {
  return Object.fromEntries(
    fs.readFileSync(path, "utf8").split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function timed(label, operation) {
  const start = performance.now();
  const result = await operation();
  const durationMs = performance.now() - start;
  const error = result?.error?.message;
  console.log(JSON.stringify({ label, durationMs: Math.round(durationMs), ok: !error, ...(error ? { error } : {}) }));
  return result;
}

const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrlArgument = process.argv.find((argument) => argument.startsWith("--base-url="));
const baseUrl = baseUrlArgument?.slice("--base-url=".length);

if (!url || !anonKey || !serviceKey) {
  throw new Error("Supabase URL, anon key, and service-role key are required");
}

console.log(JSON.stringify({
  supabaseHost: new URL(url).host,
  ...(env.NEXT_PUBLIC_APP_URL ? { appHost: new URL(env.NEXT_PUBLIC_APP_URL).host } : {}),
}));

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await timed("supabase-rest-handshake", () => admin.from("profiles").select("id", { count: "exact", head: true }));
await timed("supabase-auth-admin", () => admin.auth.admin.listUsers({ page: 1, perPage: 1 }));
const profileResult = await timed("profile", () => admin.from("profiles").select("id,auth_user_id,club_id,role,is_active").eq("is_active", true).limit(1).maybeSingle());
if (!profileResult.data?.club_id) throw new Error("No active profile is available for read-only query profiling");

if (baseUrl) {
  for (const [label, path] of [["login-cold", "/login"], ["login-warm", "/login"], ["protected-redirect", "/dashboard"]]) {
    await timed(label, async () => {
      const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
      await response.arrayBuffer();
      return { error: null };
    });
  }
}

const testEmail = process.env.PERF_TEST_EMAIL ?? env.PERF_TEST_EMAIL;
const testPassword = process.env.PERF_TEST_PASSWORD ?? env.PERF_TEST_PASSWORD;
if (!testEmail || !testPassword) {
  console.log(JSON.stringify({
    label: "authenticated-page-profile",
    skipped: true,
    reason: "Set PERF_TEST_EMAIL and PERF_TEST_PASSWORD to profile RLS-protected page queries.",
  }));
  process.exit(0);
}

const authenticated = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const signInResult = await timed("password-sign-in", () => authenticated.auth.signInWithPassword({ email: testEmail, password: testPassword }));
if (signInResult.error) process.exit(1);

const now = new Date();
const horizon = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
const dashboardQueries = [
  ["dashboard-tables", () => authenticated.from("snooker_tables").select("id,name,table_number,game_rate,status,sort_order,is_active,table_sessions:table_sessions!sessions_table_same_club(id,table_id,customer_id,start_time,total_paused_seconds,game_rate,table_charge,status,customers:customers!sessions_customer_same_club(full_name)),bookings:bookings!bookings_table_same_club(id,table_id,start_time,status)").eq("is_active", true).in("table_sessions.status", ["active", "paused"]).eq("bookings.status", "confirmed").gte("bookings.start_time", now.toISOString()).lte("bookings.start_time", horizon).order("sort_order")],
  ["dashboard-bookings", () => authenticated.from("bookings").select("id,table_id,customer_name,start_time,status").order("start_time").limit(5)],
  ["dashboard-orders", () => authenticated.from("orders").select("id,order_number,total_amount,created_at").eq("order_status", "completed").gte("created_at", dayStart).order("created_at", { ascending: false }).limit(6)],
  ["dashboard-products", () => authenticated.from("products").select("id,category_id,name,price,stock_quantity,track_inventory").eq("is_active", true).order("name").limit(40)],
  ["dashboard-metrics", () => authenticated.rpc("get_dashboard_metrics").single()],
];

for (const [label, query] of dashboardQueries) await timed(label, query);
await timed("dashboard-five-queries-parallel", async () => {
  const results = await Promise.all(dashboardQueries.map(([, query]) => query()));
  return { error: results.find((result) => result.error)?.error };
});
await timed("tables-query-warm", dashboardQueries[0][1]);
await timed("members-page", () => authenticated.from("customers").select("id,full_name,phone,email,total_visits", { count: "exact" }).order("created_at", { ascending: false }).range(0, 24));
await timed("payments-page-via-orders", () => authenticated.from("orders").select("id,order_number,total_amount,payment_status,order_status,created_at").order("created_at", { ascending: false }).range(0, 24));
