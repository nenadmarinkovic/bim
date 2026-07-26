"use client";

import { createContext, useContext } from "react";
import { useVehicles, type VehiclesState } from "./use-vehicles";

const VehiclesContext = createContext<VehiclesState>({
  data: null,
  error: null,
});

// One poll loop for the page; two callers of useVehicles would double the rate.
export function VehiclesProvider({ children }: { children: React.ReactNode }) {
  const state = useVehicles();
  return (
    <VehiclesContext.Provider value={state}>{children}</VehiclesContext.Provider>
  );
}

export function useVehiclesContext(): VehiclesState {
  return useContext(VehiclesContext);
}
