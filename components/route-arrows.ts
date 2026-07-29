import type { FeatureCollection, Point } from "geojson";
import type mapboxgl from "mapbox-gl";

export const ARROW_SOURCE = "vehicle-route-arrows";
export const ARROW_LAYER = "vehicle-route-arrows";
export const ARROW_IMAGE = "bim-route-arrow";

const EMPTY: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

const SPACING_PX = 62;
const PERIOD_MS = 1500;
const MAX_ARROWS = 400;
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
let generation = 0;

let calm: MediaQueryList | null = null;

const still = () => {
  if (typeof window === "undefined") return false;
  calm ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return calm.matches;
};

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
    | mapboxgl.GeoJSONSource
    | undefined;
  if (!source || !measured) return;

  const centre = map.getCenter();
  const perPixel =
    (40075016.686 * Math.abs(Math.cos(rad(centre.lat)))) /
    2 ** (map.getZoom() + 9);
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
    | mapboxgl.GeoJSONSource
    | undefined;
  source?.setData(EMPTY);

  setArrowsVisible(map, false);
}

function setArrowsVisible(map: mapboxgl.Map, on: boolean) {
  if (!map.getLayer(ARROW_LAYER)) return;
  map.setLayoutProperty(ARROW_LAYER, "visibility", on ? "visible" : "none");
}
