"use client";

import { useVehiclesContext } from "./vehicles-provider";

export function VehicleCount({ className }: { className?: string }) {
  const { data } = useVehiclesContext();

  if (!data) return null;

  const total = data.vehicles.length;
  const scheduled = data.vehicles.filter((v) => !v.realtime).length;

  return (
    <p className={className}>
      <span className="tabular-nums text-foreground">{total}</span> vehicles
      moving
      {scheduled > 0 && (
        <>
          {" · "}
          <span className="tabular-nums">{scheduled}</span> geschätzt
        </>
      )}
    </p>
  );
}
