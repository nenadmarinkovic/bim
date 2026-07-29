"use client";

import { useVehiclesContext } from "./vehicles-provider";
import { useDict } from "./locale-provider";
import { cn } from "@/lib/utils";

function Counted({ template, n }: { template: string; n: number }) {
  const [before, after = ""] = template.split("{n}");
  return (
    <>
      {before}
      <span className="tabular-nums">{n}</span>
      {after}
    </>
  );
}

export function VehicleCount({ className }: { className?: string }) {
  const { data, error } = useVehiclesContext();
  const dict = useDict();

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
        {dict.count.loading}
      </p>
    );
  }

  const total = data.vehicles.length;
  const scheduled = data.vehicles.filter((v) => !v.realtime).length;

  return (
    <p className={className} role="status">
      <Counted
        template={total === 1 ? dict.count.moving.one : dict.count.moving.other}
        n={total}
      />
      {scheduled > 0 && (
        <>
          {" · "}
          <Counted template={dict.count.estimated} n={scheduled} />
        </>
      )}
    </p>
  );
}
