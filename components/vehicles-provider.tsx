"use client";

import { createContext, useCallback, useContext, useRef } from "react";
import { useVehicles, type VehiclesState } from "./use-vehicles";

const VehiclesContext = createContext<VehiclesState>({
  data: null,
  error: null,
});

/** The map publishes its viewport here so the poll can scope what it asks for. */
const ViewportContext = createContext<{
  set: (bbox: string | null) => void;
}>({ set: () => {} });

// One poll loop for the page; two callers of useVehicles would double the rate.
export function VehiclesProvider({ children }: { children: React.ReactNode }) {
  const viewport = useRef<string | null>(null);
  const getViewport = useCallback(() => viewport.current, []);
  const state = useVehicles(getViewport);

  const set = useCallback((bbox: string | null) => {
    viewport.current = bbox;
  }, []);

  return (
    <ViewportContext.Provider value={{ set }}>
      <VehiclesContext.Provider value={state}>
        {children}
      </VehiclesContext.Provider>
    </ViewportContext.Provider>
  );
}

export function useViewportReporter() {
  return useContext(ViewportContext).set;
}

export function useVehiclesContext(): VehiclesState {
  return useContext(VehiclesContext);
}
