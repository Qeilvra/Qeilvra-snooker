"use client";

import { useSyncExternalStore } from "react";

let currentNow = Date.now();
const serverNow = currentNow;
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function updateNow() {
  currentNow = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!interval) {
    updateNow();
    interval = setInterval(updateNow, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

export function useNow() {
  return useSyncExternalStore(subscribe, () => currentNow, () => serverNow);
}
