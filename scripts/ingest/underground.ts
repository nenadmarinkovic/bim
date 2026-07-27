import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR } from "./sources.ts";

// Level is in no transit export, so tunnel/bridge/layer come from OpenStreetMap.
const OVERPASS = "https://overpass-api.de/api/interpreter";
const BBOX = "47.97,16.15,48.33,16.60";

const MATCH_METRES = 30;

const MIN_RUN_METRES = 60;

type Way = { underground: boolean; points: [number, number][] };

async function fetchWays(): Promise<Way[]> {
  const cached = path.join(CACHE_DIR, "osm-subway.json");
  try {
    const raw = await readFile(cached, "utf8");
    return JSON.parse(raw) as Way[];
  } catch {}

  const query = `[out:json][timeout:180];way["railway"="subway"](${BBOX});out geom tags;`;
  // Overpass answers 406 without a User-Agent identifying the caller.
  const response = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "bim-vienna-transit-map/0.1 (ingest)",
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`overpass responded ${response.status}`);

  const body = (await response.json()) as {
    elements: {
      geometry?: { lat: number; lon: number }[];
      tags?: Record<string, string>;
    }[];
  };

  const ways: Way[] = [];
  for (const element of body.elements) {
    if (!element.geometry || element.geometry.length < 2) continue;
    const tags = element.tags ?? {};
    const tunnel = tags.tunnel && tags.tunnel !== "no";
    const bridge = tags.bridge && tags.bridge !== "no";
    const layer = Number(tags.layer ?? 0);
    ways.push({
      underground: Boolean(!bridge && (tunnel || layer < 0)),
      points: element.geometry.map((p) => [p.lon, p.lat] as [number, number]),
    });
  }

  await writeFile(cached, JSON.stringify(ways));
  return ways;
}

const METRES_PER_DEGREE = 111_320;
const CELL = 0.003;

const cellKey = (lon: number, lat: number) =>
  `${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`;

type Segment = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  under: boolean;
};

function buildIndex(ways: Way[]) {
  const grid = new Map<string, Segment[]>();
  for (const way of ways) {
    for (let i = 0; i < way.points.length - 1; i++) {
      const [ax, ay] = way.points[i];
      const [bx, by] = way.points[i + 1];
      const segment: Segment = { ax, ay, bx, by, under: way.underground };
      for (const [x, y] of [
        [ax, ay],
        [bx, by],
      ]) {
        const key = cellKey(x, y);
        const bucket = grid.get(key);
        if (bucket) bucket.push(segment);
        else grid.set(key, [segment]);
      }
    }
  }
  return grid;
}

function distanceToSegment(lon: number, lat: number, s: Segment): number {
  const scale = Math.cos((lat * Math.PI) / 180);
  const px = (lon - s.ax) * scale;
  const py = lat - s.ay;
  const vx = (s.bx - s.ax) * scale;
  const vy = s.by - s.ay;
  const lenSq = vx * vx + vy * vy;
  const t =
    lenSq > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / lenSq)) : 0;
  const dx = px - vx * t;
  const dy = py - vy * t;
  return Math.hypot(dx, dy) * METRES_PER_DEGREE;
}

function nearestFlag(
  grid: Map<string, Segment[]>,
  lon: number,
  lat: number,
): boolean | null {
  let best: number = MATCH_METRES;
  let flag: boolean | null = null;

  const cx = Math.floor(lon / CELL);
  const cy = Math.floor(lat / CELL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = grid.get(`${cx + dx}:${cy + dy}`);
      if (!bucket) continue;
      for (const segment of bucket) {
        const d = distanceToSegment(lon, lat, segment);
        if (d < best) {
          best = d;
          flag = segment.under;
        }
      }
    }
  }
  return flag;
}

export type UndergroundRanges = Record<string, [number, number][]>;

export function buildUndergroundRanges(
  shapes: Record<string, { c: number[]; d: number[] }>,
  shapeIds: Iterable<string>,
  ways: Way[],
): { ranges: UndergroundRanges; stats: Record<string, number> } {
  const grid = buildIndex(ways);
  const ranges: UndergroundRanges = {};
  let matched = 0;
  let unmatched = 0;
  let undergroundMetres = 0;
  let totalMetres = 0;

  for (const shapeId of shapeIds) {
    const shape = shapes[shapeId];
    if (!shape) continue;

    const flags: boolean[] = [];
    let last = false;
    for (let i = 0; i < shape.d.length; i++) {
      const flag = nearestFlag(grid, shape.c[i * 2], shape.c[i * 2 + 1]);
      if (flag === null) unmatched++;
      else matched++;
      last = flag ?? last;
      flags[i] = last;
    }

    const out: [number, number][] = [];
    let start: number | null = null;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] && start === null) start = shape.d[i];
      const ends = !flags[i] || i === flags.length - 1;
      if (ends && start !== null) {
        const finish = shape.d[i];
        if (finish - start >= MIN_RUN_METRES) out.push([start, finish]);
        start = null;
      }
    }

    if (out.length) ranges[shapeId] = out;
    totalMetres += shape.d[shape.d.length - 1] - shape.d[0];
    for (const [from, to] of out) undergroundMetres += to - from;
  }

  return {
    ranges,
    stats: {
      shapes: Object.keys(ranges).length,
      pointsMatched: matched,
      pointsUnmatched: unmatched,
      undergroundKm: Math.round(undergroundMetres / 100) / 10,
      totalKm: Math.round(totalMetres / 100) / 10,
    },
  };
}

export { fetchWays };
