"use client";

import { useEffect, useState } from "react";

export function LiveClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  if (!now) return <div className="topbar-time">Loading time…</div>;
  return (
    <div className="topbar-time">
      {new Intl.DateTimeFormat("en-PK", { timeZone: timezone, weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(now)}
      <strong>{new Intl.DateTimeFormat("en-PK", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)}</strong>
    </div>
  );
}
