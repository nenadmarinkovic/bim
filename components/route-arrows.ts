import type { FeatureCollection, Point } from "geojson";
import type mapboxgl from "mapbox-gl";

export const ARROW_SOURCE = "vehicle-route-arrows";
export const ARROW_LAYER = "vehicle-route-arrows";
export const ARROW_IMAGE = "bim-route-arrow";

const EMPTY: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

// Constant spacing on screen rather than on the ground: a route across the city
// and a route across a district should look equally busy.
const SPACING_PX = 62;
// One full step every this long, so an arrow slides into where its neighbour
// was and the procession never appears to jump.
const PERIOD_MS = 1500;
// Raised because the cap is what decides how much of a long line gets covered.
const MAX_ARROWS = 400;
// A route shorter than one screen-spacing would otherwise round down to no
// arrows at all, which is how short lines ended up with none.
const MIN_ARROWS = 3;

const EARTH = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

function metres(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]) / 2;
  const dLon = rad(b[0] - a[0]) / 2;
  const h =
    Math.sin(dLat) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon) ** 2;
  return 2 * EARTH * Math.asin(Math.sqrt(h));
}

// Clockwise from north, which is what icon-rotate expects of a map-aligned icon.
function bearing(a: [number, number], b: [number, number]): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

type Measured = {
  points: [number, number][];
  upto: number[];
  total: number;
};

function measure(line: [number, number][]): Measured {
  const upto = [0];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += metres(line[i - 1]!, line[i]!);
    upto.push(total);
  }
  return { points: line, upto, total };
}

// A white chevron, drawn rather than fetched: it is three lines of canvas and
// saves registering an asset for it.
function chevron(): ImageData | null {
  const ratio = 4;
  const size = 11 * ratio;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const pad = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(pad, size - pad);
  ctx.lineTo(size / 2, pad);
  ctx.lineTo(size - pad, size - pad);

  ctx.lineWidth = size * 0.17;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // A dark tracer under the white keeps the arrow readable on a pale line.
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = size * 0.26;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.17;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

export function addArrowLayer(map: mapboxgl.Map) {
  if (map.getSource(ARROW_SOURCE)) return;

  if (!map.hasImage(ARROW_IMAGE)) {
    const image = chevron();
    if (image) map.addImage(ARROW_IMAGE, image, { pixelRatio: 4 });
  }

  map.addSource(ARROW_SOURCE, { type: "geojson", data: EMPTY });

  map.addLayer({
    id: ARROW_LAYER,
    type: "symbol",
    source: ARROW_SOURCE,
    slot: "top",
    layout: {
      "icon-image": ARROW_IMAGE,
      "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.7, 16, 1],
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-emissive-strength": 1,
      "icon-opacity": 0.95,
    },
  });
}

let measured: Measured | null = null;
let frame = 0;
let startedAt = 0;
// Cancelling the pending frame is not enough on its own: a loop that is midway
// through its own callback schedules the next one after the cancel. Every run
// carries a generation, and only the current generation may continue.
let generation = 0;

let calm: MediaQueryList | null = null;

const still = () => {
  if (typeof window === "undefined") return false;
  calm ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return calm.matches;
};

// Both the vertices and the arrow distances are ascending, so one cursor walks
// the whole frame. Searching from the start for each arrow would be a thousand
// vertices times a hundred arrows, sixty times a second.
function at(route: Measured, distance: number, cursor: number) {
  const { points, upto } = route;

  let i = cursor;
  while (i < upto.length - 1 && upto[i]! < distance) i++;

  const before = points[i - 1]!;
  const after = points[i]!;
  const span = upto[i]! - upto[i - 1]!;
  const t = span > 0 ? (distance - upto[i - 1]!) / span : 0;

  return {
    lon: before[0] + (after[0] - before[0]) * t,
    lat: before[1] + (after[1] - before[1]) * t,
    bearing: bearing(before, after),
    cursor: i,
  };
}

function paint(map: mapboxgl.Map, now: number) {
  const source = map.getSource(ARROW_SOURCE) as
    mapboxgl.GeoJSONSource | undefined;
  if (!source || !measured) return;

  // Mapbox GL JS counts zoom against 512px tiles, so the world is 2^(z+9)
  // pixels round. Getting this wrong bunches every arrow into the first
  // hundred metres of the line.
  const centre = map.getCenter();
  const perPixel =
    (40075016.686 * Math.abs(Math.cos(rad(centre.lat)))) /
    2 ** (map.getZoom() + 9);
  // Spread across the whole line rather than running out partway. Capping the
  // count alone left a 19 km route with arrows for its first 9 km and nothing
  // after, which is what looked like routes missing them.
  const wanted = SPACING_PX * perPixel;
  const spacing = Math.max(
    Math.min(
      Math.max(wanted, measured.total / MAX_ARROWS),
      measured.total / MIN_ARROWS,
    ),
    1,
  );

  const phase = still() ? 0 : ((now - startedAt) % PERIOD_MS) / PERIOD_MS;
  const count = Math.min(Math.floor(measured.total / spacing), MAX_ARROWS);

  const features: FeatureCollection<Point>["features"] = [];
  let cursor = 1;
  for (let k = 0; k < count; k++) {
    const distance = (k + phase) * spacing;
    if (distance > measured.total) break;
    const point = at(measured, distance, cursor);
    cursor = point.cursor;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
      properties: { bearing: point.bearing },
    });
  }

  source.setData({ type: "FeatureCollection", features });
}

export function showArrows(map: mapboxgl.Map, line: [number, number][]) {
  stopArrows(map, false);
  if (line.length < 2) return;

  // Idempotent, and cheap: guarantees the source, image and layer are present
  // however the map got here.
  addArrowLayer(map);
  setArrowsVisible(map, true);

  measured = measure(line);
  startedAt = performance.now();

  const mine = ++generation;
  const step = () => {
    if (mine !== generation || !measured) return;
    paint(map, performance.now());
    frame = requestAnimationFrame(step);
  };

  step();
}

export function stopArrows(map: mapboxgl.Map, clear = true) {
  generation++;
  cancelAnimationFrame(frame);
  frame = 0;
  measured = null;
  if (!clear) return;

  const source = map.getSource(ARROW_SOURCE) as
    mapboxgl.GeoJSONSource | undefined;
  source?.setData(EMPTY);

  // Emptying the source should be enough, and in every case I could reproduce
  // it was. Hiding the layer as well means no combination of a missed source,
  // a stray frame or a queued update can leave arrows over a cleared route.
  setArrowsVisible(map, false);
}

function setArrowsVisible(map: mapboxgl.Map, on: boolean) {
  if (!map.getLayer(ARROW_LAYER)) return;
  map.setLayoutProperty(ARROW_LAYER, "visibility", on ? "visible" : "none");
}
