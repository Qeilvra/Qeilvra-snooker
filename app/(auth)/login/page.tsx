import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth-form";
import { hasSupabaseEnv } from "@/lib/env";
import { login } from "../actions";

export default function LoginPage() {
  const configured = hasSupabaseEnv();
  return <main className="auth-page">
    <section className="auth-art"><Brand/><h1>Run every table, tab and shift with confidence.</h1><p>Live table management, bookings, inventory and a fast point of sale built for busy snooker clubs.</p></section>
    <section className="auth-form-wrap"><div className="auth-form"><h2>Welcome back</h2><p>Sign in to your Qeilvra workspace.</p>{!configured ? <div className="error-banner">Supabase is not configured yet. Copy <strong>.env.example</strong> to <strong>.env.local</strong> and add your project values.</div> : <LoginForm action={login}/>}</div></section>
  </main>;
}
