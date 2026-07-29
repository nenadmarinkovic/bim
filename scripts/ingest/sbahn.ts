import path from "node:path";
import { open } from "yauzl-promise";

import { readCsv, readCsvStream } from "./csv.ts";
import { CACHE_DIR } from "./sources.ts";
import { extractEntries } from "./unzip.ts";
import { buildTrips, type RouteRecord, type TripRecord } from "./trips.ts";

// ÖBB publishes the whole country. Everything outside this box is someone
// else's S-Bahn — Salzburg and Graz number their lines S1, S2, S3 as well.
const VIENNA = { west: 16.1, south: 47.95, east: 16.65, north: 48.4 };

const inVienna = (lat: number, lon: number) =>
  lat >= VIENNA.south &&
  lat <= VIENNA.north &&
  lon >= VIENNA.west &&
  lon <= VIENNA.east;

// Ids are merged into the Wiener Linien schedule, where nothing guarantees the
// two operators never picked the same string.
const tag = (id: string) => `oebb:${id}`;

const SBAHN_NAME = /^S\d{1,2}$/;
const RAIL = 2;

export type RailStop = { id: string; name: string; lat: number; lon: number };

export type SbahnBuild = {
  stops: RailStop[];
  routes: Record<string, RouteRecord>;
  trips: Record<string, TripRecord>;
  runs: { date: string; tripIds: string[] }[];
  shapes: Record<string, { c: number[]; d: number[] }>;
  lines: string[];
  tripCount: number;
  shapePoints: number;
};

async function viennaStops(file: string): Promise<Map<string, RailStop>> {
  const keep = new Map<string, RailStop>();
  for await (const row of readCsv(file)) {
    const lat = Number(row.stop_lat);
    const lon = Number(row.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!inVienna(lat, lon)) continue;
    keep.set(row.stop_id, {
      id: row.stop_id,
      name: row.stop_name,
      lat,
      lon,
    });
  }
  return keep;
}

// Only the shapes still referenced, read straight out of the archive. The file
// is 666 MB uncompressed and the fifteen lines here need a sliver of it.
async function shapesFor(
  zipPath: string,
  wanted: Set<string>,
): Promise<{
  shapes: Record<string, { c: number[]; d: number[] }>;
  points: number;
}> {
  const collected = new Map<
    string,
    { seq: number; lon: number; lat: number; dist: number }[]
  >();

  const zip = await open(zipPath);
  try {
    for await (const entry of zip) {
      if (path.basename(entry.filename) !== "shapes.txt") continue;

      const stream = await entry.openReadStream();
      for await (const row of readCsvStream(stream)) {
        if (!wanted.has(row.shape_id)) continue;
        const list = collected.get(row.shape_id);
        const point = {
          seq: Number(row.shape_pt_sequence),
          lon: Number(row.shape_pt_lon),
          lat: Number(row.shape_pt_lat),
          dist: Number(row.shape_dist_traveled),
        };
        if (list) list.push(point);
        else collected.set(row.shape_id, [point]);
      }
      break;
    }
  } finally {
    await zip.close();
  }

  const shapes: Record<string, { c: number[]; d: number[] }> = {};
  let points = 0;

  for (const [id, list] of collected) {
    list.sort((a, b) => a.seq - b.seq);
    const c: number[] = [];
    const d: number[] = [];
    for (const point of list) {
      c.push(Number(point.lon.toFixed(6)), Number(point.lat.toFixed(6)));
      d.push(Number(point.dist.toFixed(1)));
    }
    shapes[tag(id)] = { c, d };
    points += list.length;
  }

  return { shapes, points };
}

export async function buildSbahn(
  zipPath: string,
  date: string,
  previousDate: string,
): Promise<SbahnBuild> {
  const gtfs = await extractEntries(
    zipPath,
    [
      "stops.txt",
      "routes.txt",
      "trips.txt",
      "stop_times.txt",
      "calendar.txt",
      "calendar_dates.txt",
    ],
    path.join(CACHE_DIR, "oebb"),
  );

  const [stops, built] = await Promise.all([
    viennaStops(gtfs["stops.txt"]!),
    buildTrips(gtfs, date, previousDate),
  ]);

  const wantedRoutes = new Set<string>();
  const lines = new Set<string>();
  for (const [id, route] of Object.entries(built.routes)) {
    if (route.type !== RAIL || !SBAHN_NAME.test(route.name)) continue;
    wantedRoutes.add(id);
  }

  // A line only counts if it actually calls in Vienna: S1 exists in Salzburg
  // and in Steiermark too, under different route ids and the same name.
  const trips: Record<string, TripRecord> = {};
  const shapeIds = new Set<string>();
  const keptIds = new Set<string>();

  // Only the platforms these trains actually call at, so the station join has
  // nothing to match against but real S-Bahn stops.
  const called = new Set<string>();

  for (const [tripId, trip] of Object.entries(built.trips)) {
    if (!wantedRoutes.has(trip.r)) continue;
    if (!trip.p.some((stop) => stops.has(stop))) continue;

    for (const stop of trip.p) if (stops.has(stop)) called.add(stop);
    keptIds.add(tripId);
    shapeIds.add(trip.s);
    lines.add(built.routes[trip.r]!.name);
    trips[tag(tripId)] = { ...trip, r: tag(trip.r), s: tag(trip.s) };
  }

  const routes: Record<string, RouteRecord> = {};
  for (const id of wantedRoutes) {
    if (!lines.has(built.routes[id]!.name)) continue;
    routes[tag(id)] = built.routes[id]!;
  }

  const { shapes, points } = await shapesFor(zipPath, shapeIds);

  const runs = built.runs.map((run) => ({
    date: run.date,
    tripIds: run.tripIds.filter((id) => keptIds.has(id)).map(tag),
  }));

  return {
    stops: [...called].map((id) => stops.get(id)!),
    routes,
    trips,
    runs,
    shapes,
    lines: [...lines].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
    tripCount: Object.keys(trips).length,
    shapePoints: points,
  };
}
