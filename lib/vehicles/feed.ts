import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { loadSchedule, serviceDayStart } from "./schedule.ts";
import { delaysForTrip, placeTrip } from "./position.ts";
import type { Vehicle } from "./types.ts";

const FEED_URL =
  "https://wiener-linien-gtfs-rt.zuugle-services.com/feed/wienerlinien-rt.pb";

/** Wiener Linien only runs these GTFS route types; anything else is a data bug. */
const MODE_BY_ROUTE_TYPE: Record<number, "tram" | "metro" | "bus"> = {
  0: "tram",
  1: "metro",
  3: "bus",
};

export type { Vehicle } from "./types.ts";

type StopDelay = { index: number; delay: number };

let cache: { at: number; delays: Map<string, StopDelay[]> } | null = null;
let inFlight: Promise<Map<string, StopDelay[]>> | null = null;

/** The upstream feed regenerates about every 30 s; polling faster just burns bytes. */
const FEED_TTL_MS = 20_000;

async function fetchDelays(): Promise<Map<string, StopDelay[]>> {
  const { schedule } = await loadSchedule();
  const response = await fetch(FEED_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`feed responded ${response.status}`);

  const buffer = new Uint8Array(await response.arrayBuffer());
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

  // The feed repeats the same trip id across several entities — one trip can
  // appear four times — so updates are merged per trip rather than appended,
  // otherwise a trip is drawn once per duplicate at the same coordinates.
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

      // stop_sequence is 1-based in GTFS; fall back to matching the stop id
      // when the sequence does not line up with our array.
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

  // Collapse concurrent callers onto one upstream request.
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
    // Serve the last good snapshot through a blip rather than emptying the map.
    if (cache) return cache.delays;
    throw error;
  }
}

/**
 * Positions the whole network at `nowMs`.
 *
 * Every trip scheduled for the service day is placed, and real-time delays are
 * layered on where the feed supplies them. Driving off the schedule rather than
 * off the feed is what puts the U-Bahn on the map: the feed omits it entirely,
 * and metro headways are short and regular enough that timetable positions hold
 * up well between stops.
 */
export async function vehiclesAt(nowMs = Date.now()): Promise<Vehicle[]> {
  const [{ schedule, shapes }, delayMap] = await Promise.all([
    loadSchedule(),
    getDelays().catch(() => new Map<string, StopDelay[]>()),
  ]);

  const dayStarts = new Map<string, number>();
  const vehicles: Vehicle[] = [];

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
      const delays = delaysForTrip(trip.t.length, updates ?? []);
      const state = placeTrip(trip, shape, delays, dayStart, nowMs);
      if (!state) continue;

      const route = schedule.routes[trip.r];
      const mode = MODE_BY_ROUTE_TYPE[route?.type ?? -1];
      if (!mode) continue;

      vehicles.push({
        id: tripId,
        line: route?.name ?? trip.r,
        mode,
        towards: trip.h,
        lon: Number(state.lon.toFixed(5)),
        lat: Number(state.lat.toFixed(5)),
        bearing: Math.round(state.bearing),
        delay: state.delay,
        realtime: updates !== undefined,
      });
    }
  }

  return vehicles;
}

export async function feedStats() {
  const delays = await getDelays();
  return { tripsInFeed: delays.size, fetchedAt: cache?.at ?? null };
}
