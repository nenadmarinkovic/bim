import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { loadSchedule, loadStops, serviceDayStart } from "./schedule.ts";
import { delaysForTrip, placeTrip } from "./position.ts";
import { DIMENSIONS } from "./colors.ts";
import { sweepMonitor } from "./monitor.ts";
import type { Vehicle } from "./types.ts";

const FEED_URL =
  "https://wiener-linien-gtfs-rt.zuugle-services.com/feed/wienerlinien-rt.pb";

const MODE_BY_ROUTE_TYPE: Record<number, "tram" | "metro" | "bus"> = {
  0: "tram",
  1: "metro",
  3: "bus",
};

export type { Vehicle } from "./types.ts";

type StopDelay = { index: number; delay: number };

let cache: { at: number; delays: Map<string, StopDelay[]> } | null = null;
let inFlight: Promise<Map<string, StopDelay[]>> | null = null;

const FEED_TTL_MS = 20_000;

async function fetchDelays(): Promise<Map<string, StopDelay[]>> {
  const { schedule } = await loadSchedule();
  const response = await fetch(FEED_URL, { cache: "no-store" });
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
      .catch(() => {
        // Keep whatever is cached; the GTFS-RT feed still covers the trip.
      })
      .finally(() => {
        monitorInFlight = null;
      });
  }

  if (!monitorCache && monitorInFlight) await monitorInFlight;
  return monitorCache?.anchors ?? new Map();
}

/** Matches the client poll interval; the client tweens across exactly this span. */
export const LOOKAHEAD_MS = 6_000;

export type Viewport = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Enough track either side to cover the body plus a poll interval of travel. */
const PATH_MARGIN_M = 220;

/**
 * Scheduled transit does not leave early, so a reading this far ahead of the
 * timetable is a mispairing between a real vehicle and a planned run, not a
 * fast one. Taken at face value it drew a tram a kilometre up the line.
 */
const EARLY_LIMIT_S = 120;

/** How far the two sources may differ before one of them is disbelieved. */
const CLASH_S = 120;

const plausible = (a: StopDelay) => a.delay >= -EARLY_LIMIT_S;

/** Slices the shape around a vehicle so the client can bend the body along it. */
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

export async function vehiclesAt(
  nowMs = Date.now(),
  view?: Viewport,
): Promise<Vehicle[]> {
  const [{ schedule, shapes, underground }, feedDelays, monitorDelays] =
    await Promise.all([
      loadSchedule(),
      getDelays().catch(() => new Map<string, StopDelay[]>()),
      getMonitorAnchors(nextTargets).catch(
        () => new Map<string, StopDelay[]>(),
      ),
    ]);

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
      // The feed is keyed on trip id; monitor readings are matched by planned
      // time, which can pair a real vehicle with the wrong run. Where the two
      // clash this hard one of them is a mispairing, so keep the feed's.
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
  const vehicles: Vehicle[] = [];
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
      if (nextStop) upcomingGtfsStops.add(nextStop);

      // A lookup against precomputed distance ranges — the same
      // shape_dist_traveled that placed the vehicle in the first place.
      const tunnels = underground[trip.s];
      const inTunnel = tunnels
        ? tunnels.some(
            ([from, to]) => state.distance >= from && state.distance <= to,
          )
        : false;

      // Only vehicles in view carry their track slice; sending it for the whole
      // network would multiply the payload for geometry nobody can see.
      const lon = Number(state.lon.toFixed(5));
      const lat = Number(state.lat.toFixed(5));
      const inView =
        view &&
        lon >= view.west &&
        lon <= view.east &&
        lat >= view.south &&
        lat <= view.north;
      if (view && !inView) continue;

      const local = inView
        ? localPath(shape, state.distance, DIMENSIONS[mode].length / 2)
        : null;

      // Where it will be when the next poll lands, so the client can animate
      // forward through real time rather than replaying the last interval.
      const ahead = local
        ? placeTrip(trip, shape, delays, dayStart, nowMs + LOOKAHEAD_MS)
        : null;

      vehicles.push({
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
        ...(local
          ? {
              path: local.path,
              pd: local.pd,
              d: state.distance,
              ...(ahead ? { dNext: ahead.distance } : {}),
            }
          : {}),
      });
    }
  }

  void primeMonitorTargets(upcomingGtfsStops);

  return vehicles;
}

let nextTargets: number[] = [];

async function primeMonitorTargets(gtfsStops: Set<string>) {
  if (!gtfsStops.size) return;
  try {
    const stops = await loadStops();
    const wlByGtfs = new Map<string, number>();
    for (const stop of stops) {
      for (const gtfsId of stop.gtfsStopIds) wlByGtfs.set(gtfsId, stop.stopId);
    }
    const targets = new Set<number>();
    for (const gtfsId of gtfsStops) {
      const wl = wlByGtfs.get(gtfsId);
      if (wl !== undefined) targets.add(wl);
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
