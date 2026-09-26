"use client";

import { useEffect, useState } from "react";

export function SessionTimer({ startedAt, pausedSeconds = 0 }: { startedAt: string; pausedSeconds?: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  if (!now) return <span>00:00:00</span>;
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000) - pausedSeconds);
  const h = Math.floor(seconds / 3600).toString().padStart(2,"0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,"0");
  const s = (seconds % 60).toString().padStart(2,"0");
  return <span>{h}:{m}:{s}</span>;
}
