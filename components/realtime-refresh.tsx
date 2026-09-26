"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ clubId }: { clubId: string }) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 150);
    };
    const channel = supabase.channel(`club:${clubId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "snooker_tables", filter: `club_id=eq.${clubId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter: `club_id=eq.${clubId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `club_id=eq.${clubId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `club_id=eq.${clubId}` }, refresh)
      .subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [clubId, router]);
  return null;
}
