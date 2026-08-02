// Vienna's cycling network, from Stadt Wien's WFS. The city publishes every
// stretch it has signed or painted for bicycles — 15,000 segments, each carrying
// its own legal category — and the categories are what matter: a kerb-separated
// path and a permission to ride against a one-way are both "Radweg" on paper and
// nothing alike on a bike.
const WFS =
  "https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:RADWEGEOGD&srsName=EPSG:4326&outputFormat=json";

const PRECISION = 5;

// About two metres. The published geometry follows the kerb to the centimetre,
// which on a screen is a straight line drawn with fifty points.
const SIMPLIFY_METRES = 2;

type Point = [number, number];
type Line = Point[];

// What the rider actually gets, which is not how the city files it: the official
// MERKMAL puts a pedestrian zone and a kerb-separated path in the same bucket.
export type BikeClass = "path" | "lane" | "calm" | "crossing";

const CLASS_BY_KIND: Record<string, BikeClass> = {
  // Its own way, off the carriageway.
  "Baulicher Radweg": "path",
  "Getrennter Geh- und Radweg": "path",
  "Gemischter Geh- und Radweg": "path",
  "Fahrradstraße": "path",
  // Paint on a road shared with cars.
  Radfahrstreifen: "lane",
  Mehrzweckstreifen: "lane",
  "Radfahren auf Busspur": "lane",
  // Permission rather than infrastructure: you may ride here, mixed in with
  // whoever else is using it.
  "Radfahren gegen die Einbahn": "calm",
  "Verkehrsberuhigter Bereich": "calm",
  "Radfahren in Wohnstraße": "calm",
  "Radfahren in Fußgängerzone": "calm",
  Radroute: "calm",
  "Radfahren im Gelände": "calm",
  // The stub across an intersection. Drawn faintly — on its own it is noise, but
  // without it the network falls apart at every junction.
  "Radfahrerüberfahrt": "crossing",
};

type Source = {
  features: {
    properties: { MERKMAL: string; SUBMERKMAL: string };
    geometry: { type: string; coordinates: unknown } | null;
  }[];
};

export type BikeFeature = {
  type: "Feature";
  properties: { class: BikeClass };
  geometry: { type: "MultiLineString"; coordinates: Line[] };
};

const round = (value: number) => Number(value.toFixed(PRECISION));

// Metres per degree at Vienna's latitude, near enough for a tolerance.
const LAT_M = 111_320;
const LON_M = 74_400;

function thin(line: Line): Line {
  const out: Line = [];
  for (const [lon, lat] of line) {
    const point: Point = [round(lon), round(lat)];
    const last = out[out.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    out.push(point);
  }
  return out;
}

// Perpendicular distance from `point` to the line through `start` and `end`,
// in metres.
function deviation(point: Point, start: Point, end: Point): number {
  const px = (point[0] - start[0]) * LON_M;
  const py = (point[1] - start[1]) * LAT_M;
  const ex = (end[0] - start[0]) * LON_M;
  const ey = (end[1] - start[1]) * LAT_M;
  const span = ex * ex + ey * ey;
  if (span === 0) return Math.hypot(px, py);
  // Where the foot of the perpendicular falls along the segment, clamped so a
  // point beyond either end measures to that end.
  const t = Math.max(0, Math.min(1, (px * ex + py * ey) / span));
  return Math.hypot(px - t * ex, py - t * ey);
}

// Ramer-Douglas-Peucker. Keeps the point that strays furthest from the chord and
// recurses on either side of it, so corners survive and the straights collapse.
function simplify(line: Line, tolerance: number): Line {
  if (line.length < 3) return line;

  const start = line[0]!;
  const end = line[line.length - 1]!;
  let worst = 0;
  let at = 0;

  for (let i = 1; i < line.length - 1; i++) {
    const distance = deviation(line[i]!, start, end);
    if (distance > worst) {
      worst = distance;
      at = i;
    }
  }

  if (worst <= tolerance) return [start, end];

  const left = simplify(line.slice(0, at + 1), tolerance);
  const right = simplify(line.slice(at), tolerance);
  return [...left, ...right.slice(1)];
}

const key = (point: Point) => `${point[0]},${point[1]}`;

// The city stores the network as it was surveyed: one long path arrives as
// dozens of segments that meet end to end. Chained back together the dashes run
// evenly and every join stops costing a repeated coordinate.
function chain(lines: Line[]): Line[] {
  const ends = new Map<string, number[]>();
  const index = (point: Point, at: number) => {
    const bucket = ends.get(key(point));
    if (bucket) bucket.push(at);
    else ends.set(key(point), [at]);
  };

  lines.forEach((line, at) => {
    index(line[0]!, at);
    index(line[line.length - 1]!, at);
  });

  const used = new Array<boolean>(lines.length).fill(false);

  // A segment continues the chain only if it is the single unused way onward —
  // at a fork there is no one right answer, so the chain ends there.
  const next = (point: Point, from: number): number | null => {
    const candidates = (ends.get(key(point)) ?? []).filter(
      (at) => at !== from && !used[at],
    );
    return candidates.length === 1 ? candidates[0]! : null;
  };

  const chains: Line[] = [];

  for (let start = 0; start < lines.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const line = [...lines[start]!];

    // Forward from the tail, then backward from the head.
    for (const forward of [true, false]) {
      let from = start;
      for (;;) {
        const tip = forward ? line[line.length - 1]! : line[0]!;
        const at = next(tip, from);
        if (at === null) break;
        used[at] = true;
        const segment = [...lines[at]!];
        // The neighbour may be stored running the other way.
        if (key(segment[0]!) !== key(tip)) segment.reverse();
        if (forward) line.push(...segment.slice(1));
        else line.unshift(...segment.slice(0, -1).reverse());
        from = at;
      }
    }

    chains.push(line);
  }

  return chains;
}

function linesOf(geometry: { type: string; coordinates: unknown }): Line[] {
  if (geometry.type === "LineString") return [geometry.coordinates as Line];
  if (geometry.type === "MultiLineString") return geometry.coordinates as Line[];
  return [];
}

// One feature per class rather than per segment: nothing is clicked and nothing
// is labelled, so 15,000 features of one property each are 15,000 copies of the
// same string.
const ORDER: BikeClass[] = ["calm", "crossing", "lane", "path"];

export async function fetchBikePaths(): Promise<{
  features: BikeFeature[];
  counts: Record<BikeClass, number>;
  unknown: string[];
}> {
  const response = await fetch(WFS);
  if (!response.ok) throw new Error(`bike paths responded ${response.status}`);

  const source = (await response.json()) as Source;

  const byClass = new Map<BikeClass, Line[]>();
  const unknown = new Set<string>();

  for (const feature of source.features) {
    const kind = feature.properties.SUBMERKMAL;
    const bikeClass = CLASS_BY_KIND[kind];
    if (!bikeClass) {
      if (kind) unknown.add(kind);
      continue;
    }
    if (!feature.geometry) continue;

    for (const raw of linesOf(feature.geometry)) {
      const line = thin(raw);
      // A segment shorter than the rounding collapses to a single point.
      if (line.length < 2) continue;
      const bucket = byClass.get(bikeClass);
      if (bucket) bucket.push(line);
      else byClass.set(bikeClass, [line]);
    }
  }

  const features: BikeFeature[] = [];
  const counts = {} as Record<BikeClass, number>;

  // Drawn in this order, so a separated path is never buried under the wash of
  // routes and crossings it crosses.
  for (const bikeClass of ORDER) {
    const lines = byClass.get(bikeClass);
    if (!lines) continue;
    const coordinates = chain(lines).map((line) =>
      simplify(line, SIMPLIFY_METRES),
    );
    counts[bikeClass] = coordinates.length;
    features.push({
      type: "Feature",
      properties: { class: bikeClass },
      geometry: { type: "MultiLineString", coordinates },
    });
  }

  return { features, counts, unknown: [...unknown] };
}
