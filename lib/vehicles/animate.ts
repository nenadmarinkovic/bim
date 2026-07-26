import type { Feature, FeatureCollection, Point } from "geojson";
import type { Vehicle } from "./types.ts";

export type Tween = {
  vehicle: Vehicle;
  fromLon: number;
  fromLat: number;
  fromBearing: number;
  startedAt: number;
  duration: number;
};

/** Shortest signed angular difference, so a vehicle never spins the long way. */
function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * Beyond this, a position change is treated as a correction rather than travel
 * and is applied instantly.
 *
 * Positions derive from schedule plus reported delay, so when the feed revises
 * a delay — a bus going from on-time to five minutes late — the computed point
 * legitimately moves a kilometre or more. Sliding that across a poll interval
 * would draw a bus doing several hundred km/h; snapping reads as what it is.
 * The cap sits above anything the network can actually cover in one interval:
 * the fastest thing on it is the Badner Bahn at about 70 km/h, or ~120 m.
 */
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

/**
 * Builds the next tween set from a fresh server snapshot.
 *
 * The server reports where each vehicle is at a single instant; between polls
 * the client walks it from its last drawn position to the new one. Vehicles
 * seen for the first time are placed directly rather than sliding in from
 * nowhere, and vehicles missing from the snapshot are dropped — their trip
 * has ended.
 */
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

/** Position of a tween at `now`, clamped once the tween has completed. */
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
        bearing,
      },
    });
  }

  return { type: "FeatureCollection", features };
}
