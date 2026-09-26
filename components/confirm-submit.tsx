"use client";

export function ConfirmSubmit({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
  return <button className={className} type="submit" onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{children}</button>;
}
