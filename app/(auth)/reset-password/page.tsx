import { Brand } from "@/components/brand";
import { NewPasswordForm } from "@/components/auth-form";
import { resetPassword } from "../actions";

export default function ResetPasswordPage() {
  return <main className="auth-page"><section className="auth-art"><Brand/><h1>Choose a new password.</h1><p>Use a password that is unique to this account.</p></section><section className="auth-form-wrap"><div className="auth-form"><h2>New password</h2><p>Your new password must be at least 8 characters.</p><NewPasswordForm action={resetPassword}/></div></section></main>;
}
