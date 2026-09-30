"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ clubId }: { clubId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const watchedTables = tablesForPath(pathname);
    if (watchedTables.length === 0) return;
    const supabase = createClient();
    let refreshPending = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") {
        refreshPending = true;
        return;
      }
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 300);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && refreshPending) {
        refreshPending = false;
        refresh();
      }
    };
    let channel = supabase.channel(`club:${clubId}:${pathname}`);
    for (const table of watchedTables) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `club_id=eq.${clubId}` }, refresh);
    }
    channel.subscribe();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [clubId, pathname, router]);
  return null;
}

function tablesForPath(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/pos") return ["snooker_tables", "table_sessions", "bookings", "orders"];
  if (pathname === "/tables" || pathname === "/bookings") return ["snooker_tables", "table_sessions", "bookings"];
  if (pathname === "/orders") return ["orders"];
  if (pathname === "/inventory") return ["orders"];
  if (pathname === "/reports") return ["table_sessions", "orders"];
  if (pathname === "/notifications") return ["bookings", "orders"];
  return [];
}
