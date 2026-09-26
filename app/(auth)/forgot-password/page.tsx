import Link from "next/link";
import { Brand } from "@/components/brand";
import { ResetRequestForm } from "@/components/auth-form";
import { requestReset } from "../actions";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><section className="auth-art"><Brand/><h1>Secure account recovery.</h1><p>We will send a one-time reset link to the email attached to your staff account.</p></section><section className="auth-form-wrap"><div className="auth-form"><h2>Reset password</h2><p>Enter your account email.</p><ResetRequestForm action={requestReset}/><div style={{marginTop:18,textAlign:"center"}}><Link className="auth-link" href="/login">Back to sign in</Link></div></div></section></main>;
}
