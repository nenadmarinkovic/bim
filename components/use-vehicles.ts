"use client";

import { useEffect, useRef, useState } from "react";
import type { VehiclesResponse } from "@/lib/vehicles/types";

/** Matches the tween duration, so a vehicle arrives just as the next poll lands. */
export const POLL_MS = 6_000;

export type VehiclesState = {
  data: VehiclesResponse | null;
  error: string | null;
};

/**
 * Polls the position endpoint. Polling rather than streaming keeps this working
 * behind any proxy without connection bookkeeping, and the payload is small
 * enough that the difference does not matter at this scale.
 */
export function useVehicles(): VehiclesState {
  const [state, setState] = useState<VehiclesState>({
    data: null,
    error: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function tick() {
      try {
        const response = await fetch("/api/vehicles", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `positions unavailable (${response.status})`);
        }

        const data = (await response.json()) as VehiclesResponse;
        if (!cancelled) setState({ data, error: null });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : "positions unavailable",
        }));
      } finally {
        // Chained timeout rather than an interval: a slow response must not
        // stack requests on top of each other.
        if (!cancelled) timer.current = setTimeout(tick, POLL_MS);
      }
    }

    tick();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return state;
}
