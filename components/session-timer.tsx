"use client";

import { useEffect, useState } from "react";

export function SessionTimer({ startedAt, pausedSeconds = 0 }: { startedAt: string; pausedSeconds?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const startedAtMs = new Date(startedAt).getTime();
  const elapsedSeconds = Number.isFinite(startedAtMs) ? Math.floor((now - startedAtMs) / 1000) : 0;
  const seconds = Math.max(0, elapsedSeconds - Math.max(0, Number(pausedSeconds) || 0));
  const h = Math.floor(seconds / 3600).toString().padStart(2,"0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,"0");
  const s = (seconds % 60).toString().padStart(2,"0");
  return <span suppressHydrationWarning>{h}:{m}:{s}</span>;
}
