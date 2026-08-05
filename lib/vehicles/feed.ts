import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import {
  currentServiceDate,
  loadPlatforms,
  loadSchedule,
  platformFor,
  serviceDayStart,
  StaleArtifactError,
} from "./schedule.ts";
import { delaysForTrip, placeTrip } from "./position.ts";
import { DIMENSIONS } from "./colors.ts";
import { sweepMonitor } from "./monitor.ts";
import type { Vehicle, VehicleMode } from "./types.ts";

const FEED_URL =
  "https://wiener-linien-gtfs-rt.zuugle-services.com/feed/wienerlinien-rt.pb";

const MODE_BY_ROUTE_TYPE: Record<number, "tram" | "metro" | "bus" | "train"> = {
  0: "tram",
  1: "metro",
  2: "train",
  3: "bus",
};

export type { Vehicle } from "./types.ts";

type StopDelay = { index: number; delay: number };

let cache: { at: number; delays: Map<string, StopDelay[]> } | null = null;
let inFlight: Promise<Map<string, StopDelay[]>> | null = null;

const FEED_TTL_MS = 20_000;

const FEED_TIMEOUT_MS = 5_000;

async function fetchDelays(): Promise<Map<string, StopDelay[]>> {
  const { schedule } = await loadSchedule();
  const response = await fetch(FEED_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`feed responded ${response.status}`);

  const buffer = new Uint8Array(await response.arrayBuffer());
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

  const byTrip = new Map<string, Map<number, number>>();

  for (const entity of feed.entity) {
    const update = entity.tripUpdate;
    const tripId = update?.trip?.tripId;
    if (!update || !tripId) continue;

    const trip = schedule.trips[tripId];
    if (!trip) continue;

    let stops = byTrip.get(tripId);
    if (!stops) {
      stops = new Map();
      byTrip.set(tripId, stops);
    }

    for (const stu of update.stopTimeUpdate ?? []) {
      const delay = stu.departure?.delay ?? stu.arrival?.delay;
      if (delay === null || delay === undefined) continue;

      let index = (stu.stopSequence ?? 0) - 1;
      if (
        index < 0 ||
        index >= trip.p.length ||
        (stu.stopId && trip.p[index] !== stu.stopId)
      ) {
        index = stu.stopId ? trip.p.indexOf(stu.stopId) : -1;
      }
      if (index < 0) continue;

      stops.set(index, Number(delay));
    }
  }

  const out = new Map<string, StopDelay[]>();
  for (const [tripId, stops] of byTrip) {
    out.set(
      tripId,
      [...stops].map(([index, delay]) => ({ index, delay })),
    );
  }
  return out;
}

async function getDelays(): Promise<Map<string, StopDelay[]>> {
  if (cache && Date.now() - cache.at < FEED_TTL_MS) return cache.delays;

  inFlight ??= fetchDelays()
    .then((delays) => {
      cache = { at: Date.now(), delays };
      return delays;
    })
    .finally(() => {
      inFlight = null;
    });

  try {
    return await inFlight;
  } catch (error) {
    if (cache) return cache.delays;
    throw error;
  }
}

let monitorCache: { at: number; anchors: Map<string, StopDelay[]> } | null =
  null;
let monitorInFlight: Promise<unknown> | null = null;

const MONITOR_TTL_MS = 30_000;

async function getMonitorAnchors(
  priorityStopIds?: number[],
): Promise<Map<string, StopDelay[]>> {
  const stale = !monitorCache || Date.now() - monitorCache.at > MONITOR_TTL_MS;

  if (stale && !monitorInFlight) {
    monitorInFlight = sweepMonitor(priorityStopIds)
      .then((sweep) => {
        monitorCache = { at: sweep.at, anchors: sweep.anchors };
      })
      .catch(() => {})
      .finally(() => {
        monitorInFlight = null;
      });
  }

  return monitorCache?.anchors ?? new Map();
}

export const LOOKAHEAD_MS = 6_000;

export type Viewport = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const PATH_MARGIN_M = 220;

const EARLY_LIMIT_S = 120;

const CLASH_S = 120;

const plausible = (a: StopDelay) => a.delay >= -EARLY_LIMIT_S;

function localPath(
  shape: { c: number[]; d: number[] },
  distance: number,
  halfLength: number,
) {
  const from = distance - halfLength - PATH_MARGIN_M;
  const to = distance + halfLength + PATH_MARGIN_M;
  const path: number[] = [];
  const pd: number[] = [];
  for (let i = 0; i < shape.d.length; i++) {
    if (shape.d[i] < from || shape.d[i] > to) continue;
    path.push(shape.c[i * 2], shape.c[i * 2 + 1]);
    pd.push(shape.d[i]);
  }
  return pd.length >= 2 ? { path, pd } : null;
}

let warnedStaleFor: string | null = null;

function checkFreshness(
  scheduleDate: string,
  coverageEndMs: number,
  nowMs: number,
) {
  if (nowMs > coverageEndMs) {
    throw new StaleArtifactError(
      `data/schedule.json covers ${scheduleDate} and that service day is over` +
        " — re-run `npm run ingest` and restart",
    );
  }

  const today = currentServiceDate(nowMs);
  if (today !== scheduleDate && warnedStaleFor !== today) {
    warnedStaleFor = today;
    console.warn(
      `schedule artifact is for ${scheduleDate}, today is ${today} —` +
        " only after-midnight runs are left; re-run `npm run ingest`",
    );
  }
}

type PlaceArgs = Parameters<typeof placeTrip>;

type Placed = {
  vehicle: Vehicle;
  trip: PlaceArgs[0];
  shape: PlaceArgs[1];
  delays: PlaceArgs[2];
  dayStart: number;
  distance: number;
  mode: VehicleMode;
};

async function placeAll(nowMs: number): Promise<Placed[]> {
  const [
    { schedule, shapes, underground, coverageEndMs },
    feedDelays,
    monitorDelays,
  ] = await Promise.all([
    loadSchedule(),
    getDelays().catch(() => new Map<string, StopDelay[]>()),
    getMonitorAnchors(nextTargets).catch(() => new Map<string, StopDelay[]>()),
  ]);

  checkFreshness(schedule.date, coverageEndMs, nowMs);

  const delayMap = new Map<string, StopDelay[]>();
  for (const [tripId, list] of feedDelays) {
    const kept = list.filter(plausible);
    if (kept.length) delayMap.set(tripId, kept);
  }

  for (const [tripId, anchors] of monitorDelays) {
    const kept = anchors.filter(plausible);
    if (!kept.length) continue;

    const existing = delayMap.get(tripId);
    if (!existing) {
      delayMap.set(tripId, kept);
      continue;
    }

    const merged = new Map(existing.map((a) => [a.index, a.delay]));
    for (const a of kept) {
      const fromFeed = merged.get(a.index);
      if (fromFeed !== undefined && Math.abs(a.delay - fromFeed) > CLASH_S) {
        continue;
      }
      merged.set(a.index, a.delay);
    }
    delayMap.set(
      tripId,
      [...merged].map(([index, delay]) => ({ index, delay })),
    );
  }

  const dayStarts = new Map<string, number>();
  const placed: Placed[] = [];
  const upcomingGtfsStops = new Set<string>();

  for (const run of schedule.runs) {
    let dayStart = dayStarts.get(run.date);
    if (dayStart === undefined) {
      dayStart = serviceDayStart(run.date);
      dayStarts.set(run.date, dayStart);
    }

    for (const tripId of run.tripIds) {
      const trip = schedule.trips[tripId];
      if (!trip) continue;

      const shape = shapes[trip.s];
      if (!shape) continue;

      const updates = delayMap.get(tripId);
      const delays = delaysForTrip(trip.t, updates ?? []);
      const state = placeTrip(trip, shape, delays, dayStart, nowMs);
      if (!state) continue;

      const route = schedule.routes[trip.r];
      const mode = MODE_BY_ROUTE_TYPE[route?.type ?? -1];
      if (!mode) continue;

      let stopsFromReport = Number.POSITIVE_INFINITY;
      if (updates?.length) {
        for (const { index } of updates) {
          const gap = Math.min(
            Math.abs(index - state.fromStop),
            Math.abs(index - (state.fromStop + 1)),
          );
          if (gap < stopsFromReport) stopsFromReport = gap;
        }
      }

      const certainty = !updates?.length
        ? "scheduled"
        : stopsFromReport === 0
          ? "measured"
          : "interpolated";

      const nextStop = trip.p[state.fromStop + 1];
      if (nextStop && route?.name) {
        upcomingGtfsStops.add(`${nextStop}\u0000${route.name}`);
      }

      const tunnels = underground[trip.s];
      const inTunnel = tunnels
        ? tunnels.some(
            ([from, to]) => state.distance >= from && state.distance <= to,
          )
        : false;

      placed.push({
        vehicle: {
          id: tripId,
          line: route?.name ?? trip.r,
          mode,
          towards: trip.h,
          lon: Number(state.lon.toFixed(5)),
          lat: Number(state.lat.toFixed(5)),
          bearing: Math.round(state.bearing),
          delay: Math.round(state.delay),
          realtime: updates !== undefined,
          certainty,
          stopsFromReport: Number.isFinite(stopsFromReport)
            ? stopsFromReport
            : -1,
          underground: inTunnel,
        },
        trip,
        shape,
        delays,
        dayStart,
        distance: state.distance,
        mode,
      });
    }
  }

  void primeMonitorTargets(upcomingGtfsStops);

  return placed;
}

const PLACEMENT_TTL_MS = 1_000;

let placements: { at: number; placed: Placed[] } | null = null;
let placingAt = 0;
let placing: Promise<Placed[]> | null = null;

async function placedAt(
  nowMs: number,
): Promise<{ at: number; placed: Placed[] }> {
  if (placements && Math.abs(nowMs - placements.at) < PLACEMENT_TTL_MS) {
    return placements;
  }

  if (placing && Math.abs(nowMs - placingAt) < PLACEMENT_TTL_MS) {
    return { at: placingAt, placed: await placing };
  }

  placingAt = nowMs;
  placing = placeAll(nowMs)
    .then((placed) => {
      placements = { at: nowMs, placed };
      return placed;
    })
    .finally(() => {
      placing = null;
    });

  return { at: nowMs, placed: await placing };
}

export async function vehiclesFor(
  nowMs = Date.now(),
  view?: Viewport,
): Promise<{ at: number; vehicles: Vehicle[] }> {
  const { at, placed } = await placedAt(nowMs);

  const vehicles: Vehicle[] = [];

  for (const entry of placed) {
    const { vehicle } = entry;
    const inView =
      view &&
      vehicle.lon >= view.west &&
      vehicle.lon <= view.east &&
      vehicle.lat >= view.south &&
      vehicle.lat <= view.north;
    if (view && !inView) continue;

    const local = inView
      ? localPath(
          entry.shape,
          entry.distance,
          DIMENSIONS[entry.mode].length / 2,
        )
      : null;

    const ahead = local
      ? placeTrip(
          entry.trip,
          entry.shape,
          entry.delays,
          entry.dayStart,
          at + LOOKAHEAD_MS,
        )
      : null;

    vehicles.push(
      local
        ? {
            ...vehicle,
            path: local.path,
            pd: local.pd,
            d: entry.distance,
            ...(ahead ? { dNext: ahead.distance } : {}),
          }
        : vehicle,
    );
  }

  return { at, vehicles };
}

export async function vehiclesAt(
  nowMs = Date.now(),
  view?: Viewport,
): Promise<Vehicle[]> {
  return (await vehiclesFor(nowMs, view)).vehicles;
}

let nextTargets: number[] = [];

async function primeMonitorTargets(stopsWithLine: Set<string>) {
  if (!stopsWithLine.size) return;
  try {
    const platforms = await loadPlatforms();
    const targets = new Set<number>();
    for (const key of stopsWithLine) {
      const split = key.lastIndexOf("\u0000");
      const stopId = platformFor(
        platforms,
        key.slice(0, split),
        key.slice(split + 1),
      );
      if (stopId !== undefined) targets.add(stopId);
    }
    nextTargets = [...targets];
  } catch {
    nextTargets = [];
  }
}

export async function feedStats() {
  const delays = await getDelays();
  return { tripsInFeed: delays.size, fetchedAt: cache?.at ?? null };
}
