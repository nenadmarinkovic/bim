"use client";

import { createContext, useContext, useMemo, useState } from "react";

const MapReadyContext = createContext<{
  ready: boolean;
  setReady: (ready: boolean) => void;
}>({ ready: false, setReady: () => {} });

export function useMapReady() {
  return useContext(MapReadyContext);
}

export function MapReadyProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const value = useMemo(() => ({ ready, setReady }), [ready]);
  return <MapReadyContext value={value}>{children}</MapReadyContext>;
}
