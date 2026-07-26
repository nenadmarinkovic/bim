import type { Shape, TripRecord } from "./schedule.ts";

/**
 * Largest index whose distance is <= `target`. The distance arrays are sorted
 * and can run to thousands of points per shape, so this is a binary search.
 */
function floorIndex(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (values[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export type Placed = { lon: number; lat: number; bearing: number };

/** Interpolates a point at `distance` along a shape, plus its heading. */
export function pointAtDistance(shape: Shape, distance: number): Placed | null {
  const { c, d } = shape;
  const count = d.length;
  if (count < 2) return null;

  const clamped = Math.min(Math.max(distance, d[0]), d[count - 1]);
  const i = Math.min(floorIndex(d, clamped), count - 2);

  const span = d[i + 1] - d[i];
  const f = span > 0 ? (clamped - d[i]) / span : 0;

  const lon0 = c[i * 2];
  const lat0 = c[i * 2 + 1];
  const lon1 = c[(i + 1) * 2];
  const lat1 = c[(i + 1) * 2 + 1];

  const lon = lon0 + (lon1 - lon0) * f;
  const lat = lat0 + (lat1 - lat0) * f;

  // Heading of the segment the vehicle currently sits on. Latitude scaling
  // keeps the angle true at Vienna's latitude rather than in raw degrees.
  const dx = (lon1 - lon0) * Math.cos((lat * Math.PI) / 180);
  const dy = lat1 - lat0;
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;

  return { lon, lat, bearing };
}

/**
 * Per-stop delay in seconds.
 *
 * GTFS-RT sends updates for some stops, not all: a delay applies from its stop
 * onward until superseded. Stops before the first update have no reported
 * delay, and the first known value is carried backwards so a trip that is
 * already running late is not drawn as if it were on time.
 */
export function delaysForTrip(
  stopCount: number,
  updates: { index: number; delay: number }[],
): number[] {
  const delays = new Array<number>(stopCount).fill(0);
  if (!updates.length) return delays;

  const sorted = [...updates].sort((a, b) => a.index - b.index);
  let cursor = 0;
  let current = sorted[0].delay;

  for (let i = 0; i < stopCount; i++) {
    while (cursor < sorted.length && sorted[cursor].index <= i) {
      current = sorted[cursor].delay;
      cursor++;
    }
    delays[i] = current;
  }

  return delays;
}

export type VehicleState = {
  lon: number;
  lat: number;
  bearing: number;
  /** Index of the stop just departed. */
  fromStop: number;
  /** Seconds late at the current point in the trip. */
  delay: number;
  /** Progress between the bracketing stops, 0..1. */
  segmentProgress: number;
};

/**
 * Places a trip at `nowMs`, or returns null when the trip has not started or
 * has already finished.
 *
 * The whole method rests on `shape_dist_traveled` being present and consistent
 * in both `stop_times.txt` and `shapes.txt`, which lets a timestamp become a
 * distance and a distance become a coordinate without any geometric fitting.
 * Between two stops the vehicle is assumed to cover distance linearly in time,
 * which is why accuracy is roughly one stop-to-stop segment.
 */
export function placeTrip(
  trip: TripRecord,
  shape: Shape,
  delays: number[],
  serviceDayStartMs: number,
  nowMs: number,
): VehicleState | null {
  const count = trip.t.length;
  if (count < 2) return null;

  const at = (i: number) => serviceDayStartMs + (trip.t[i] + delays[i]) * 1000;

  if (nowMs < at(0)) return null;
  if (nowMs > at(count - 1)) return null;

  let lo = 0;
  let hi = count - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (at(mid) <= nowMs) lo = mid;
    else hi = mid;
  }

  const start = at(lo);
  const end = at(lo + 1);
  const span = end - start;
  const progress = span > 0 ? (nowMs - start) / span : 0;

  const distance = trip.d[lo] + (trip.d[lo + 1] - trip.d[lo]) * progress;
  const placed = pointAtDistance(shape, distance);
  if (!placed) return null;

  return {
    ...placed,
    fromStop: lo,
    delay: delays[lo],
    segmentProgress: progress,
  };
}
