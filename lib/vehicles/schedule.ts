import { readFile } from "node:fs/promises";
import path from "node:path";

export type TripRecord = {
  r: string;
  s: string;
  h: string;
  t: number[];
  d: number[];
  p: string[];
  w?: number[];
};

export type RouteRecord = { name: string; type: number };

export type Shape = { c: number[]; d: number[] };

export type Schedule = {
  date: string;
  generatedAt: string;
  routes: Record<string, RouteRecord>;
  trips: Record<string, TripRecord>;
  runs: { date: string; tripIds: string[] }[];
};

export class MissingArtifactError extends Error {}

export class StaleArtifactError extends Error {}

export type UndergroundRanges = Record<string, [number, number][]>;

let loading: Promise<{
  schedule: Schedule;
  shapes: Record<string, Shape>;
  underground: UndergroundRanges;
  coverageEndMs: number;
}> | null = null;

async function readArtifact<T>(name: string): Promise<T> {
  const file = path.join(process.cwd(), "data", name);
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (cause) {
    throw new MissingArtifactError(
      `data/${name} is missing — run \`npm run ingest\``,
      { cause },
    );
  }
}

function coverageEnd(schedule: Schedule): number {
  let end = 0;
  for (const run of schedule.runs) {
    const dayStart = serviceDayStart(run.date);
    for (const tripId of run.tripIds) {
      const times = schedule.trips[tripId]?.t;
      if (!times?.length) continue;
      const last = dayStart + times[times.length - 1] * 1000;
      if (last > end) end = last;
    }
  }
  return end;
}

export function loadSchedule() {
  loading ??= (async () => {
    const [schedule, shapes, underground] = await Promise.all([
      readArtifact<Schedule>("schedule.json"),
      readArtifact<Record<string, Shape>>("shapes.json"),
      // Optional: the map still works without tunnel data.
      readArtifact<UndergroundRanges>("underground.json").catch(() => ({})),
    ]);
    return {
      schedule,
      shapes,
      underground,
      coverageEndMs: coverageEnd(schedule),
    };
  })();
  return loading;
}

export type StopRecord = {
  stopId: number;
  name: string;
  lat: number;
  lon: number;
  gtfsStopIds: string[];
};

let stopsLoading: Promise<StopRecord[]> | null = null;

export function loadStops(): Promise<StopRecord[]> {
  stopsLoading ??= readArtifact<{ stops: StopRecord[] }>("stops.json").then(
    (file) => file.stops,
  );
  return stopsLoading;
}

// One entry per DIVA, holding every platform StopID beneath it.
export type StationMode = "metro" | "train" | "tram" | "bus";

export type StationRecord = {
  diva: number;
  name: string;
  lat: number;
  lon: number;
  stopIds: number[];
  gtfsStopIds: string[];
  modes: StationMode[];
  railStopIds: string[];
};

let stationsLoading: Promise<StationRecord[]> | null = null;

export function loadStations(): Promise<StationRecord[]> {
  stationsLoading ??= readArtifact<{ stations: StationRecord[] }>(
    "stations.json",
  ).then((file) => file.stations);
  return stationsLoading;
}

type LineRecord = {
  name: string;
  patterns: Record<string, { stopIds: number[] }>;
};

let platformsLoading: Promise<PlatformIndex> | null = null;

export type PlatformIndex = {
  candidates: Map<string, number[]>;
  linesAt: Map<number, Set<string>>;
};

export function loadPlatforms(): Promise<PlatformIndex> {
  platformsLoading ??= (async () => {
    const [stops, lines] = await Promise.all([
      loadStops(),
      readArtifact<{ lines: LineRecord[] }>("lines.json").then((f) => f.lines),
    ]);

    const candidates = new Map<string, number[]>();
    for (const stop of stops) {
      for (const gtfsId of stop.gtfsStopIds) {
        const list = candidates.get(gtfsId);
        if (list) list.push(stop.stopId);
        else candidates.set(gtfsId, [stop.stopId]);
      }
    }

    const linesAt = new Map<number, Set<string>>();
    for (const line of lines) {
      for (const pattern of Object.values(line.patterns ?? {})) {
        for (const stopId of pattern.stopIds ?? []) {
          const set = linesAt.get(stopId);
          if (set) set.add(line.name);
          else linesAt.set(stopId, new Set([line.name]));
        }
      }
    }

    return { candidates, linesAt };
  })();
  return platformsLoading;
}

export function platformFor(
  index: PlatformIndex,
  gtfsStopId: string,
  line: string,
): number | undefined {
  const options = index.candidates.get(gtfsStopId);
  if (!options?.length) return undefined;
  return (
    options.find((stopId) => index.linesAt.get(stopId)?.has(line)) ?? options[0]
  );
}

const VIENNA = "Europe/Vienna";

function offsetMs(epochMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIENNA,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(epochMs);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - epochMs;
}

// Must agree with serviceDate() in scripts/ingest/trips.ts.
export function currentServiceDate(nowMs = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIENNA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nowMs);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

export function serviceDayStart(date: string): number {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  const naive = Date.UTC(y, m - 1, d);
  let guess = naive;
  for (let i = 0; i < 2; i++) guess = naive - offsetMs(guess);
  return guess;
}
