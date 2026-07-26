"use client";

import { useVehiclesContext } from "./vehicles-provider";
import { cn } from "@/lib/utils";

export function VehicleCount({ className }: { className?: string }) {
  const { data, error } = useVehiclesContext();

  if (error) {
    return (
      <p className={cn(className, "text-destructive")} role="status">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <p className={cn(className, "animate-pulse")} role="status">
        Loading live positions…
      </p>
    );
  }

  const total = data.vehicles.length;
  const scheduled = data.vehicles.filter((v) => !v.realtime).length;

  return (
    <p className={className} role="status">
      <span className="tabular-nums">{total}</span> vehicles moving
      {scheduled > 0 && (
        <>
          {" · "}
          <span className="tabular-nums">{scheduled}</span> estimated
        </>
      )}
    </p>
  );
}
