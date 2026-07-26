"use client";

import { useEffect, useRef, useState } from "react";
import type { VehiclesResponse } from "@/lib/vehicles/types";

export const POLL_MS = 6_000;

export type VehiclesState = {
  data: VehiclesResponse | null;
  error: string | null;
};

export function useVehicles(getViewport?: () => string | null): VehiclesState {
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
        const bbox = getViewport?.();
        const response = await fetch(
          bbox ? `/api/vehicles?bbox=${bbox}` : "/api/vehicles",
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body.error ?? `positions unavailable (${response.status})`,
          );
        }

        const data = (await response.json()) as VehiclesResponse;
        if (!cancelled) setState({ data, error: null });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          error:
            error instanceof Error ? error.message : "positions unavailable",
        }));
      } finally {
        // Chained timeout, not an interval: a slow response must not stack.
        if (!cancelled) timer.current = setTimeout(tick, POLL_MS);
      }
    }

    tick();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [getViewport]);

  return state;
}
