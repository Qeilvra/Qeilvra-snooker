"use client";

import { useActionState } from "react";
import { Play } from "lucide-react";
import { startSession, type ActionState } from "@/app/(app)/tables/actions";

export function StartSessionButton({ tableId }: { tableId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(startSession, {});

  return <form action={action} style={{ flex: 1 }}>
    <input type="hidden" name="tableId" value={tableId}/>
    <button className="btn btn-primary btn-sm btn-block" type="submit" disabled={pending}>
      <Play size={14}/>{pending ? "Starting…" : "Start"}
    </button>
    {state.error && <span className="help" role="alert">{state.error}</span>}
  </form>;
}
