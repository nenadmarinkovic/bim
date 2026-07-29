import {
  loadSchedule,
  loadStations,
  serviceDayStart,
  type StationRecord,
} from "./schedule.ts";
import { stripCity } from "./names.ts";

const MONITOR = "https://www.wienerlinien.at/ogd_realtime/monitor";

// Roughly one call in ten stalls for seconds while the next one for the same
// stop answers immediately, so the stall belongs to the connection rather than
// the stop. Giving up early and asking again beats waiting it out.
const TIMEOUT_MS = 2_500;
const ATTEMPTS = 2;
const TTL_MS = 20_000;

// A station merges every platform, so an interchange needs more room than a
// single kerbside stop did.
const MAX_ROWS = 12;
const MAX_DEPARTURES = 4;
const MAX_CACHED = 400;

export type BoardMode = "tram" | "metro" | "bus" | "train";

export type BoardDeparture = {
  countdown: number;
  delay: number | null;
};

export type BoardRow = {
  line: string;
  mode: BoardMode;
  towards: string;
  departures: BoardDeparture[];
};

export type StopBoard = {
  diva: number;
  name: string;
  rows: BoardRow[];
  at: number;
};

type MonitorDeparture = {
  departureTime?: {
    timePlanned?: string;
    timeReal?: string;
    countdown?: number;
  };
  vehicle?: { towards?: string; type?: string };
};

type MonitorLine = {
  name?: string;
  towards?: string;
  type?: string;
  departures?: { departure?: MonitorDeparture[] };
};

type Monitor = { lines?: MonitorLine[] };

function modeOf(type: string | undefined): BoardMode {
  if (!type) return "bus";
  if (type.startsWith("ptMetro")) return "metro";
  if (type.startsWith("ptTram")) return "tram";
  if (type.startsWith("ptTrain")) return "train";
  return "bus";
}

const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

let index: Promise<Map<number, StationRecord>> | null = null;

function stations(): Promise<Map<number, StationRecord>> {
  index ??= loadStations().then(
    (all) => new Map(all.map((station) => [station.diva, station])),
  );
  return index;
}

export async function station(
  diva: number,
): Promise<StationRecord | undefined> {
  return (await stations()).get(diva);
}

// Wiener Linien's monitor knows nothing about the S-Bahn — ÖBB runs it — so
// those departures come from the timetable instead. No realtime behind them,
// which is why they carry no delay and the board shows them as scheduled.
const RAIL_HORIZON_MS = 90 * 60_000;

type RailDeparture = { line: string; towards: string; at: number };

let railStops: Promise<Map<string, RailDeparture[]>> | null = null;

function railIndex(): Promise<Map<string, RailDeparture[]>> {
  railStops ??= loadSchedule().then(({ schedule }) => {
    const out = new Map<string, RailDeparture[]>();

    for (const run of schedule.runs) {
      const dayStart = serviceDayStart(run.date);

      for (const tripId of run.tripIds) {
        const trip = schedule.trips[tripId];
        const route = trip && schedule.routes[trip.r];
        if (!trip || route?.type !== 2) continue;

        // Every call but the last: you cannot board a train that terminates.
        for (let i = 0; i < trip.p.length - 1; i++) {
          const stop = trip.p[i]!;
          const found = out.get(stop);
          const departure = {
            line: route.name,
            towards: stripCity(trip.h ?? ""),
            at: dayStart + trip.t[i]! * 1000,
          };
          if (found) found.push(departure);
          else out.set(stop, [departure]);
        }
      }
    }

    for (const list of out.values()) list.sort((a, b) => a.at - b.at);
    return out;
  });
  return railStops;
}

async function railRows(station: StationRecord): Promise<BoardRow[]> {
  if (!station.railStopIds.length) return [];

  const index = await railIndex();
  const now = Date.now();
  const rows = new Map<string, BoardRow>();
  const seen = new Set<string>();

  for (const stop of station.railStopIds) {
    for (const departure of index.get(stop) ?? []) {
      if (departure.at < now) continue;
      if (departure.at - now > RAIL_HORIZON_MS) break;

      // The same train is listed once per platform it is scheduled against.
      const identity = `${departure.line}|${departure.towards}|${departure.at}`;
      if (seen.has(identity)) continue;
      seen.add(identity);

      const key = `${departure.line}|${departure.towards}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          line: departure.line,
          mode: "train",
          towards: departure.towards,
          departures: [],
        };
        rows.set(key, row);
      }
      row.departures.push({
        countdown: Math.round((departure.at - now) / 60_000),
        delay: null,
      });
    }
  }

  for (const row of rows.values()) {
    row.departures.sort((a, b) => a.countdown - b.countdown);
    row.departures.length = Math.min(row.departures.length, MAX_DEPARTURES);
  }

  return [...rows.values()];
}

function toRows(monitors: Monitor[]): BoardRow[] {
  const rows = new Map<string, BoardRow>();
  const seen = new Map<string, Set<string>>();

  for (const monitor of monitors) {
    for (const line of monitor.lines ?? []) {
      const name = line.name?.trim();
      if (!name) continue;

      for (const departure of line.departures?.departure ?? []) {
        const time = departure.departureTime;
        const countdown = time?.countdown;
        if (typeof countdown !== "number") continue;

        const towards = tidy(departure.vehicle?.towards || line.towards || "");
        if (!towards) continue;

        const planned = time?.timePlanned;
        const real = time?.timeReal;
        const delay =
          planned && real
            ? Math.round((Date.parse(real) - Date.parse(planned)) / 1000)
            : null;

        const key = `${name}|${towards}`;
        let row = rows.get(key);
        if (!row) {
          row = {
            line: name,
            mode: modeOf(departure.vehicle?.type || line.type),
            towards,
            departures: [],
          };
          rows.set(key, row);
          seen.set(key, new Set());
        }

        const already = seen.get(key)!;
        const identity = planned ?? `~${countdown}`;
        if (already.has(identity)) continue;
        already.add(identity);

        row.departures.push({ countdown, delay });
      }
    }
  }

  for (const row of rows.values()) {
    row.departures.sort((a, b) => a.countdown - b.countdown);
    row.departures.length = Math.min(row.departures.length, MAX_DEPARTURES);
  }

  return [...rows.values()]
    .sort((a, b) => a.departures[0]!.countdown - b.departures[0]!.countdown)
    .slice(0, MAX_ROWS);
}

class MonitorRefused extends Error {}

async function callMonitor(query: string): Promise<Monitor[]> {
  let failure: unknown;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${MONITOR}?${query}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // A 403 is Wiener Linien throttling us. Asking again straight away is
      // exactly the wrong answer; only a stalled connection is worth a retry.
      if (!response.ok) {
        throw new MonitorRefused(`monitor responded ${response.status}`);
      }
      const body = (await response.json()) as {
        data?: { monitors?: Monitor[] };
      };
      return body.data?.monitors ?? [];
    } catch (error) {
      if (error instanceof MonitorRefused) throw error;
      failure = error;
    }
  }

  throw failure;
}

// The monitor takes many stopIds at once, so a station of any size is one call.
async function fetchBoard(station: StationRecord): Promise<StopBoard> {
  const query = station.stopIds.map((id) => `stopId=${id}`).join("&");

  const [monitors, rail] = await Promise.all([
    callMonitor(query),
    railRows(station),
  ]);

  const rows = [...toRows(monitors), ...rail]
    .sort((a, b) => a.departures[0]!.countdown - b.departures[0]!.countdown)
    .slice(0, MAX_ROWS);

  return {
    diva: station.diva,
    name: station.name,
    rows,
    at: Date.now(),
  };
}

type Entry = { at: number; board: Promise<StopBoard> };

const cache = new Map<number, Entry>();

function fresh(diva: number): Promise<StopBoard> | undefined {
  const entry = cache.get(diva);
  if (!entry) return undefined;
  if (Date.now() - entry.at >= TTL_MS) {
    cache.delete(diva);
    return undefined;
  }
  return entry.board;
}

// Served before the rate limit so a board still ticking in someone's popup
// costs them nothing to keep open.
export function cachedBoard(diva: number): Promise<StopBoard> | undefined {
  return fresh(diva);
}

export function loadBoard(target: StationRecord): Promise<StopBoard> {
  const already = fresh(target.diva);
  if (already) return already;

  const board = fetchBoard(target);
  cache.set(target.diva, { at: Date.now(), board });

  // A failed lookup must not sit in the cache for the full window.
  board.catch(() => cache.delete(target.diva));

  if (cache.size > MAX_CACHED) {
    for (const [id, entry] of cache) {
      if (Date.now() - entry.at >= TTL_MS) cache.delete(id);
    }
  }

  return board;
}
