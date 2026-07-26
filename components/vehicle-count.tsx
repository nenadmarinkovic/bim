"use client";

import { useVehiclesContext } from "./vehicles-provider";

/**
 * Ambient readout of how much of the network is in motion. The scheduled count
 * is called out separately because those positions come from the timetable
 * alone — the map should never imply more certainty than the data carries.
 */
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
