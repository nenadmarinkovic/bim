"use client";

import { CircleNotchIcon } from "@phosphor-icons/react";

import { useVehiclesContext } from "./vehicles-provider";
import { useMapReady } from "./map-ready";
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

function Spinner() {
  return (
    <CircleNotchIcon
      size={13}
      weight="bold"
      aria-hidden
      className="mr-1.5 shrink-0 animate-spin opacity-70 motion-reduce:animate-none"
    />
  );
}

export function VehicleCount({ className }: { className?: string }) {
  const { data, error } = useVehiclesContext();
  const { ready } = useMapReady();
  const dict = useDict();

  if (error) {
    return (
      <p className={cn(className, "text-destructive")} role="status">
        {error}
      </p>
    );
  }

  // Counts are held back until the map has settled too: announcing 137 moving
  // vehicles over a blank frame reads as a glitch, and the pill would swap
  // width twice on the way in.
  if (!data || !ready) {
    return (
      <p className={cn(className, "inline-flex items-center")} role="status">
        <Spinner />
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
