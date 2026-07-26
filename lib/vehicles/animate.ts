import type { Feature, FeatureCollection, Point } from "geojson";
import { vehicleColour } from "./colors.ts";
import type { Vehicle } from "./types.ts";

export type Tween = {
  vehicle: Vehicle;
  fromLon: number;
  fromLat: number;
  fromBearing: number;
  startedAt: number;
  duration: number;
};

function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

const SNAP_METRES = 300;

function roughMetres(
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const METRES_PER_DEGREE = 111_320;
  const dx = (bLon - aLon) * Math.cos((aLat * Math.PI) / 180);
  const dy = bLat - aLat;
  return Math.hypot(dx, dy) * METRES_PER_DEGREE;
}

export function reconcile(
  previous: Map<string, Tween>,
  vehicles: Vehicle[],
  now: number,
  duration: number,
): Map<string, Tween> {
  const next = new Map<string, Tween>();

  for (const vehicle of vehicles) {
    const prior = previous.get(vehicle.id);
    const at = prior ? sample(prior, now) : null;

    const jumped =
      at !== null &&
      roughMetres(at.lon, at.lat, vehicle.lon, vehicle.lat) > SNAP_METRES;
    const from = at && !jumped ? at : vehicle;

    next.set(vehicle.id, {
      vehicle,
      fromLon: from.lon,
      fromLat: from.lat,
      fromBearing: "bearing" in from ? from.bearing : vehicle.bearing,
      startedAt: now,
      duration: jumped ? 0 : duration,
    });
  }

  return next;
}

export function sample(tween: Tween, now: number) {
  const elapsed = now - tween.startedAt;
  const t =
    tween.duration > 0 ? Math.min(Math.max(elapsed / tween.duration, 0), 1) : 1;

  return {
    lon: tween.fromLon + (tween.vehicle.lon - tween.fromLon) * t,
    lat: tween.fromLat + (tween.vehicle.lat - tween.fromLat) * t,
    bearing:
      tween.fromBearing +
      angleDelta(tween.fromBearing, tween.vehicle.bearing) * t,
  };
}

export type VehicleFeature = Feature<Point>;

export function toFeatureCollection(
  tweens: Map<string, Tween>,
  now: number,
  dark = false,
): FeatureCollection<Point> {
  const features: VehicleFeature[] = [];

  for (const tween of tweens.values()) {
    const { lon, lat, bearing } = sample(tween, now);
    const { vehicle } = tween;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        id: vehicle.id,
        line: vehicle.line,
        mode: vehicle.mode,
        towards: vehicle.towards,
        delay: vehicle.delay,
        realtime: vehicle.realtime,
        certainty: vehicle.certainty,
        stopsFromReport: vehicle.stopsFromReport,
        color: vehicleColour(vehicle.mode, vehicle.line, dark),
        bearing,
      },
    });
  }

  return { type: "FeatureCollection", features };
}
