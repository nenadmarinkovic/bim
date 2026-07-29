import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

export const CACHE_DIR = path.join(process.cwd(), ".cache", "ingest");
export const DATA_DIR = path.join(process.cwd(), "data");

const OGD = "https://www.wienerlinien.at/ogd_realtime/doku/ogd";

export const WL_FILES = {
  haltepunkte: `${OGD}/wienerlinien-ogd-haltepunkte.csv`,
  haltestellen: `${OGD}/wienerlinien-ogd-haltestellen.csv`,
  linien: `${OGD}/wienerlinien-ogd-linien.csv`,
  fahrwegverlaeufe: `${OGD}/wienerlinien-ogd-fahrwegverlaeufe.csv`,
} as const;

export const GTFS_ZIP =
  "https://wiener-linien-gtfs-rt.zuugle-services.com/gtfs/wiener-linien-gtfs.zip";

// The S-Bahn is ÖBB's, not Wiener Linien's, and it is a third of how the city
// moves. Timetable only — there is no realtime feed behind this one. CC BY 4.0.
export const OEBB_ZIP =
  "https://static.web.oebb.at/open-data/soll-fahrplan-gtfs/GTFS_Fahrplan_2026.zip";

const MAX_AGE_MS = 12 * 60 * 60 * 1000;

async function isFresh(file: string): Promise<boolean> {
  try {
    const info = await stat(file);
    return Date.now() - info.mtimeMs < MAX_AGE_MS;
  } catch {
    return false;
  }
}

export async function fetchCached(url: string, name: string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const target = path.join(CACHE_DIR, name);

  if (await isFresh(target)) {
    console.log(`  cached  ${name}`);
    return target;
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${url} responded ${response.status}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(target),
  );

  const { size } = await stat(target);
  console.log(`  fetched ${name} (${(size / 1e6).toFixed(1)} MB)`);
  return target;
}
