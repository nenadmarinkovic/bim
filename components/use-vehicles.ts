"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      inFlight?.abort();
      inFlight = null;
    };

    async function tick() {
      if (cancelled || document.hidden) return;

      const controller = new AbortController();
      inFlight = controller;

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
        const owns = inFlight === controller;
        if (owns) inFlight = null;
        if (owns && !cancelled && !document.hidden) {
          timer = setTimeout(tick, POLL_MS);
        }
      }
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }

      if (!timer && !inFlight) tick();
    };

    tick();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [getViewport]);

  return state;
}
