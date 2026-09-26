"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ clubId }: { clubId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const refresh = () => router.refresh();
    const channel = supabase.channel(`club:${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "snooker_tables", filter: `club_id=eq.${clubId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter: `club_id=eq.${clubId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `club_id=eq.${clubId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `club_id=eq.${clubId}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clubId, router]);
  return null;
}
