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
      // A hidden document draws nothing, so a position fetched now is only a
      // radio wake and a parse whose result is stale before anyone sees it.
      // visibilitychange restarts the loop.
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
        // Hiding aborts this request and going back cancels the wait, so by the
        // time this runs a newer poll may already own the chain. Only the
        // request still holding it may extend it, or the two would run side by
        // side at double the rate.
        const owns = inFlight === controller;
        if (owns) inFlight = null;
        // Chained timeout, not an interval: a slow response must not stack.
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
      // Whatever was on screen when the phone went into a pocket is minutes
      // old by the time it comes back out, so the first frame after returning
      // is a fresh one rather than the tail of the old poll.
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
