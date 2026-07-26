import type { Feature, FeatureCollection, Point } from "geojson";
import { vehicleColour } from "./colors.ts";
import type { Vehicle } from "./types.ts";

export type Tween = {
  vehicle: Vehicle;
  fromLon: number;
  fromLat: number;
  fromBearing: number;
  /** Heading to settle on: the direction actually travelled this interval. */
  toBearing: number;
  /** Distance along `vehicle.path` at the start of the tween, when known. */
  fromDistance?: number;
  startedAt: number;
  duration: number;
};

function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

const SNAP_METRES = 300;

/**
 * How long a vehicle takes to swing onto its new heading.
 *
 * Short, and deliberately not the whole poll interval. Position moves along the
 * straight chord from the last sample to the next, so spreading the rotation
 * across the same window leaves the body pointing one way while it travels
 * another — it crabs sideways through corners instead of driving round them.
 * Turning quickly and then holding keeps it aligned with its own motion.
 */
const TURN_MS = 1400;

/** Below this the vehicle is effectively stopped, and its heading is meaningless. */
const MOVING_METRES = 1.5;

/** Compass heading from one point to another, in degrees. */
function headingBetween(
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const dx = (bLon - aLon) * Math.cos((aLat * Math.PI) / 180);
  const dy = bLat - aLat;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

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
    const fromBearing = "bearing" in from ? from.bearing : vehicle.bearing;

    // Face the way it is going. Where it barely moved — sitting at a stop — the
    // chord is noise, so the reported heading along the track is kept instead.
    const travelled = roughMetres(from.lon, from.lat, vehicle.lon, vehicle.lat);
    const toBearing =
      travelled >= MOVING_METRES
        ? headingBetween(from.lon, from.lat, vehicle.lon, vehicle.lat)
        : vehicle.bearing;

    // With track geometry, interpolate along the rails rather than across the
    // chord — the vehicle then follows the curve instead of cutting it.
    const priorDistance = prior?.vehicle.d;
    const fromDistance =
      !jumped && vehicle.d !== undefined && priorDistance !== undefined
        ? priorDistance
        : vehicle.d;

    next.set(vehicle.id, {
      vehicle,
      fromLon: from.lon,
      fromLat: from.lat,
      fromBearing,
      toBearing,
      fromDistance,
      startedAt: now,
      duration: jumped ? 0 : duration,
    });
  }

  return next;
}

/** Position and heading at a distance along a flat [lon, lat, ...] path. */
export function alongPath(
  path: number[],
  pd: number[],
  distance: number,
): { lon: number; lat: number; bearing: number } | null {
  if (pd.length < 2) return null;
  const clamped = Math.min(Math.max(distance, pd[0]), pd[pd.length - 1]);

  let lo = 0;
  let hi = pd.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pd[mid] <= clamped) lo = mid;
    else hi = mid;
  }

  const span = pd[lo + 1] - pd[lo];
  const f = span > 0 ? (clamped - pd[lo]) / span : 0;
  const lon0 = path[lo * 2];
  const lat0 = path[lo * 2 + 1];
  const lon1 = path[(lo + 1) * 2];
  const lat1 = path[(lo + 1) * 2 + 1];
  const lon = lon0 + (lon1 - lon0) * f;
  const lat = lat0 + (lat1 - lat0) * f;

  return { lon, lat, bearing: headingBetween(lon0, lat0, lon1, lat1) };
}

export function sample(tween: Tween, now: number) {
  const elapsed = now - tween.startedAt;
  const t =
    tween.duration > 0 ? Math.min(Math.max(elapsed / tween.duration, 0), 1) : 1;

  const { path, pd, d } = tween.vehicle;
  if (path && pd && d !== undefined && tween.fromDistance !== undefined) {
    const distance = tween.fromDistance + (d - tween.fromDistance) * t;
    const on = alongPath(path, pd, distance);
    if (on) return { ...on, distance };
  }

  // Rotation finishes well before the move does, so the body spends most of the
  // interval pointing along its path rather than easing into it.
  const turn =
    tween.duration > 0 ? Math.min(Math.max(elapsed / TURN_MS, 0), 1) : 1;
  const eased = turn * turn * (3 - 2 * turn);

  return {
    lon: tween.fromLon + (tween.vehicle.lon - tween.fromLon) * t,
    lat: tween.fromLat + (tween.vehicle.lat - tween.fromLat) * t,
    bearing:
      tween.fromBearing +
      angleDelta(tween.fromBearing, tween.toBearing) * eased,
    distance: undefined as number | undefined,
  };
}

export type VehicleFeature = Feature<Point>;

/** Viewport box, already padded by the caller. */
export type Cull = { west: number; south: number; east: number; north: number };

const inside = (cull: Cull | undefined, lon: number, lat: number) =>
  !cull ||
  (lon >= cull.west &&
    lon <= cull.east &&
    lat >= cull.south &&
    lat <= cull.north);

export function toFeatureCollection(
  tweens: Map<string, Tween>,
  now: number,
  dark = false,
  cull?: Cull,
): FeatureCollection<Point> {
  const features: VehicleFeature[] = [];

  for (const tween of tweens.values()) {
    const { lon, lat, bearing } = sample(tween, now);
    if (!inside(cull, lon, lat)) continue;
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
