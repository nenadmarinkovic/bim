"use client";

import { useSyncExternalStore } from "react";

let ready = false;

const listeners = new Set<() => void>();

export function markMapReady() {
  if (ready) return;
  ready = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMapReady() {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => false,
  );
}
