import { readFile } from "node:fs/promises";
import path from "node:path";

export type TripRecord = {
  r: string;
  s: string;
  h: string;
  t: number[];
  d: number[];
  p: string[];
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

let loading: Promise<{
  schedule: Schedule;
  shapes: Record<string, Shape>;
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

export function loadSchedule() {
  loading ??= (async () => {
    const [schedule, shapes] = await Promise.all([
      readArtifact<Schedule>("schedule.json"),
      readArtifact<Record<string, Shape>>("shapes.json"),
    ]);
    return { schedule, shapes };
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

export function serviceDayStart(date: string): number {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  const naive = Date.UTC(y, m - 1, d);
  let guess = naive;
  for (let i = 0; i < 2; i++) guess = naive - offsetMs(guess);
  return guess;
}
