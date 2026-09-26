"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/(auth)/actions";

export function LoginForm({ action }: { action: (state: AuthState, data: FormData) => Promise<AuthState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction}>
    {state.error && <div className="error-banner" role="alert">{state.error}</div>}
    <div className="field-group"><label htmlFor="email">Email address</label><input className="field" id="email" name="email" type="email" autoComplete="email" required/></div>
    <div className="field-group"><label htmlFor="password">Password</label><input className="field" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required/></div>
    <div style={{display:"flex",justifyContent:"flex-end",margin:"-3px 0 18px"}}><Link className="auth-link" href="/forgot-password">Forgot password?</Link></div>
    <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}

export function ResetRequestForm({ action }: { action: (state: AuthState, data: FormData) => Promise<AuthState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction}>
    {state.error && <div className="error-banner" role="alert">{state.error}</div>}
    {state.success && <div className="success-banner" role="status">{state.success}</div>}
    <div className="field-group"><label htmlFor="email">Email address</label><input className="field" id="email" name="email" type="email" autoComplete="email" required/></div>
    <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
  </form>;
}

export function NewPasswordForm({ action }: { action: (state: AuthState, data: FormData) => Promise<AuthState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction}>
    {state.error && <div className="error-banner" role="alert">{state.error}</div>}
    <div className="field-group"><label htmlFor="password">New password</label><input className="field" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required/><span className="help">At least 8 characters.</span></div>
    <button className="btn btn-primary btn-block" disabled={pending}>{pending ? "Updating…" : "Update password"}</button>
  </form>;
}
