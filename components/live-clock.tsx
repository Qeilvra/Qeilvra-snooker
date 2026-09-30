"use client";

import { useMemo } from "react";
import { useNow } from "@/components/use-now";

export function LiveClock({ timezone }: { timezone: string }) {
  const now = new Date(useNow());
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat("en-PK", { timeZone: timezone, weekday: "short", day: "2-digit", month: "short", year: "numeric" }), [timezone]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat("en-PK", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit" }), [timezone]);
  return (
    <div className="topbar-time" suppressHydrationWarning>
      {dateFormatter.format(now)}
      <strong suppressHydrationWarning>{timeFormatter.format(now)}</strong>
    </div>
  );
}
