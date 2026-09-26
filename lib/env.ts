const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseEnv() {
  return Boolean(url && anonKey && !url.includes("your-project"));
}

export function getSupabaseEnv() {
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Copy .env.example to .env.local.");
  }
  return { url, anonKey };
}
