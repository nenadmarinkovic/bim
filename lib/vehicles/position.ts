import type { Shape, TripRecord } from "./schedule.ts";

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

  const dx = (lon1 - lon0) * Math.cos((lat * Math.PI) / 180);
  const dy = lat1 - lat0;
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;

  return { lon, lat, bearing };
}

export function delaysForTrip(
  scheduledTimes: number[],
  updates: { index: number; delay: number }[],
): number[] {
  const stopCount = scheduledTimes.length;
  const delays = new Array<number>(stopCount).fill(0);
  if (!updates.length) return delays;

  const anchors = [...updates]
    .filter((u) => u.index >= 0 && u.index < stopCount)
    .sort((a, b) => a.index - b.index);
  if (!anchors.length) return delays;

  for (let i = 0; i < stopCount; i++) {
    if (i <= anchors[0].index) {
      delays[i] = anchors[0].delay;
      continue;
    }
    if (i >= anchors[anchors.length - 1].index) {
      delays[i] = anchors[anchors.length - 1].delay;
      continue;
    }

    let next = 0;
    while (anchors[next].index < i) next++;
    const before = anchors[next - 1];
    const after = anchors[next];
    const span = scheduledTimes[after.index] - scheduledTimes[before.index];
    const f =
      span > 0
        ? (scheduledTimes[i] - scheduledTimes[before.index]) / span
        : (i - before.index) / (after.index - before.index);

    delays[i] = before.delay + (after.delay - before.delay) * f;
  }

  return delays;
}

const RAMP = 0.25;
const CRUISE = 1 / (1 - RAMP);

function travelled(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < RAMP) return (CRUISE * u * u) / (2 * RAMP);
  if (u > 1 - RAMP) {
    const left = 1 - u;
    return 1 - (CRUISE * left * left) / (2 * RAMP);
  }
  return CRUISE * (u - RAMP / 2);
}

function waitsOf(trip: TripRecord): number[] | null {
  if (!trip.w?.length) return null;
  const waits = new Array<number>(trip.t.length).fill(0);
  for (let i = 0; i < trip.w.length; i += 2) waits[trip.w[i]] = trip.w[i + 1];
  return waits;
}

export type VehicleState = {
  lon: number;
  lat: number;
  bearing: number;
  fromStop: number;
  delay: number;
  segmentProgress: number;
  distance: number;
};

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

  const waits = waitsOf(trip);
  const start = at(lo);
  const end = at(lo + 1) - (waits ? waits[lo + 1] * 1000 : 0);
  const span = end - start;
  const progress = span > 0 ? Math.min((nowMs - start) / span, 1) : 1;

  const distance =
    trip.d[lo] + (trip.d[lo + 1] - trip.d[lo]) * travelled(progress);
  const placed = pointAtDistance(shape, distance);
  if (!placed) return null;

  return {
    ...placed,
    fromStop: lo,
    delay: delays[lo],
    segmentProgress: progress,
    distance,
  };
}
