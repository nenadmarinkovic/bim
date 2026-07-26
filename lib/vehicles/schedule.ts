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
  /** Trip ids per service day — today, plus yesterday's after-midnight runs. */
  runs: { date: string; tripIds: string[] }[];
};

export class MissingArtifactError extends Error {}

/**
 * Both artifacts are large (schedule ~14 MB, shapes ~26 MB) and are read once
 * into module scope. Next reloads modules on edit in development, so the load
 * is memoised on a promise to keep concurrent requests from racing it.
 */
let loading: Promise<{ schedule: Schedule; shapes: Record<string, Shape> }> | null =
  null;

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
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
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

/**
 * Epoch milliseconds of local midnight starting the given `YYYYMMDD` service
 * day. GTFS times are offsets from this instant, and because Vienna observes
 * DST the offset has to be resolved at the target date rather than assumed —
 * two passes converge even across a transition.
 */
export function serviceDayStart(date: string): number {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  const naive = Date.UTC(y, m - 1, d);
  let guess = naive;
  for (let i = 0; i < 2; i++) guess = naive - offsetMs(guess);
  return guess;
}
