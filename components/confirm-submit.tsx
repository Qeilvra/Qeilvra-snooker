"use client";

import { useFormStatus } from "react-dom";

export function ConfirmSubmit({ message, children, className, pendingText = "Processing…" }: { message: string; children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-busy={pending} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{pending ? pendingText : children}</button>;
}
