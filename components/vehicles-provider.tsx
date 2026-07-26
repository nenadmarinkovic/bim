"use client";

import { createContext, useContext } from "react";
import { useVehicles, type VehiclesState } from "./use-vehicles";

const VehiclesContext = createContext<VehiclesState>({
  data: null,
  error: null,
});

/**
 * Runs a single poll loop for the whole page. Both the map and the counter need
 * the same snapshot, and letting each call `useVehicles` would double the
 * request rate for identical data.
 */
export function VehiclesProvider({ children }: { children: React.ReactNode }) {
  const state = useVehicles();
  return (
    <VehiclesContext.Provider value={state}>{children}</VehiclesContext.Provider>
  );
}

export function useVehiclesContext(): VehiclesState {
  return useContext(VehiclesContext);
}
