"use client";

import { useSyncExternalStore } from "react";

export type Job = "map" | "stations";

const SETTLE_MS = 350;

const jobs = new Set<Job>();
const listeners = new Set<() => void>();

let pending: Job | null = null;
let visible: Job | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function publish() {
  for (const listener of listeners) listener();
}

function settle() {
  const next = jobs.size ? [...jobs][0]! : null;
  if (next === pending) return;
  pending = next;

  clearTimeout(timer);

  if (!next) {
    if (visible !== null) {
      visible = null;
      publish();
    }
    return;
  }

  if (visible !== null) {
    if (visible !== next) {
      visible = next;
      publish();
    }
    return;
  }

  timer = setTimeout(() => {
    visible = pending;
    publish();
  }, SETTLE_MS);
}

export function startJob(job: Job) {
  if (jobs.has(job)) return;
  jobs.add(job);
  settle();
}

export function endJob(job: Job) {
  if (!jobs.delete(job)) return;
  settle();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBusy(): Job | null {
  return useSyncExternalStore(
    subscribe,
    () => visible,
    () => null,
  );
}
