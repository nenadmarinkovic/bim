import type mapboxgl from "mapbox-gl";

import { STOPS_BADGE_LAYER, STOPS_LAYER } from "@/lib/vehicles/layer-ids";
import type { StopBoard } from "@/lib/vehicles/board";

export type StopSelection = {
  diva: number;
  name: string;
  modes: string[];
  lngLat: [number, number];
  board: StopBoard | null;
  failed: boolean;
};

const REFRESH_MS = 20_000;

// Without a deadline a stalled request leaves "Reading the board…" on screen
// forever, which reads as a hang rather than a failure.
const REQUEST_TIMEOUT_MS = 8_000;

async function fetchBoard(diva: number): Promise<StopBoard | null> {
  try {
    const response = await fetch(`/api/stop?id=${diva}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as StopBoard;
  } catch {
    return null;
  }
}

// Countdowns go stale, so a board is only worth reusing for about as long as
// the server holds its own copy.
const KEEP_MS = 15_000;

const held = new Map<number, { at: number; board: StopBoard }>();
const running = new Map<number, Promise<StopBoard | null>>();

function ready(diva: number): StopBoard | null {
  const entry = held.get(diva);
  if (!entry) return null;
  if (performance.now() - entry.at >= KEEP_MS) {
    held.delete(diva);
    return null;
  }
  return entry.board;
}

function loadBoard(diva: number): Promise<StopBoard | null> {
  const already = running.get(diva);
  if (already) return already;

  const request = fetchBoard(diva).then((board) => {
    running.delete(diva);
    if (board) held.set(diva, { at: performance.now(), board });
    return board;
  });

  running.set(diva, request);
  return request;
}

// Hovering a dot predicts clicking it, so the board is usually waiting by the
// time the popup opens. Bounded, because the server allows twenty uncached
// lookups a minute and a mouse crossing the map would spend them all.
// Both, and not just the circle: the badges are one image up to four wide, so at
// a station with a U-Bahn, an S-Bahn and a bus the outer icons sit thirty pixels
// from the point the circle covers, and clicking what you can see did nothing.
// The circle still earns its place — it stays hittable when a badge is
// decluttered away, and only rendered features answer a query.
const TARGETS = [STOPS_LAYER, STOPS_BADGE_LAYER];

const DWELL_MS = 160;
const WARM_WINDOW_MS = 60_000;
const WARM_PER_WINDOW = 8;
const warmed: number[] = [];

function mayWarm(): boolean {
  const now = performance.now();
  while (warmed.length && warmed[0]! <= now - WARM_WINDOW_MS) warmed.shift();
  if (warmed.length >= WARM_PER_WINDOW) return false;
  warmed.push(now);
  return true;
}

function stopAt(feature: mapboxgl.GeoJSONFeature) {
  const diva = feature.properties?.diva;
  const name = feature.properties?.name;
  if (typeof diva !== "number" || typeof name !== "string") return null;

  // Vector-tile properties are flat, so the modes travel as one string.
  const modes = String(feature.properties?.modes ?? "")
    .split(",")
    .filter(Boolean);

  const point = feature.geometry as GeoJSON.Point;
  return {
    diva,
    name,
    modes,
    lngLat: [point.coordinates[0]!, point.coordinates[1]!] as [number, number],
  };
}

export type Station = {
  diva: number;
  name: string;
  modes: string[];
  lngLat: [number, number];
};

export type StopHandle = {
  disable: () => void;
  // Opening a station without clicking it, for search.
  select: (station: Station) => void;
};

export function enableStops(
  map: mapboxgl.Map,
  onSelect: (selection: StopSelection | null) => void,
): StopHandle {
  let ticket = 0;
  let refresh = 0;
  let dwell = 0;

  const close = () => {
    ticket++;
    clearInterval(refresh);
    refresh = 0;
    onSelect(null);
  };

  const select = (stop: Station) => {
    const mine = ++ticket;
    clearInterval(refresh);
    clearTimeout(dwell);

    // Warmed by the hover above, or by an earlier visit: no waiting line.
    const known = ready(stop.diva);
    onSelect({ ...stop, board: known, failed: false });

    const show = (board: StopBoard | null) => {
      if (mine !== ticket) return;
      onSelect({ ...stop, board, failed: !board });
    };

    // Joins the hover's request instead of racing it with a second one.
    void loadBoard(stop.diva).then(show);

    refresh = window.setInterval(() => {
      void fetchBoard(stop.diva).then((board) => {
        if (board) held.set(stop.diva, { at: performance.now(), board });
        show(board);
      });
    }, REFRESH_MS);
  };

  const onClick = (
    event: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] },
  ) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const stop = stopAt(feature);
    if (stop) select(stop);
  };

  const onMapClick = (event: mapboxgl.MapMouseEvent) => {
    if (!refresh && ticket === 0) return;
    const layers = TARGETS.filter((layer) => map.getLayer(layer));
    if (!layers.length) return;
    const hits = map.queryRenderedFeatures(event.point, { layers });
    if (!hits.length) close();
  };

  const pointer = (
    event: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] },
  ) => {
    map.getCanvas().style.cursor = "pointer";

    const feature = event.features?.[0];
    const stop = feature ? stopAt(feature) : null;
    if (!stop || ready(stop.diva) || running.has(stop.diva)) return;

    clearTimeout(dwell);
    dwell = window.setTimeout(() => {
      if (mayWarm()) void loadBoard(stop.diva);
    }, DWELL_MS);
  };

  const resetPointer = () => {
    clearTimeout(dwell);
    map.getCanvas().style.cursor = "";
  };

  map.on("click", TARGETS, onClick);
  map.on("click", onMapClick);
  map.on("mouseenter", TARGETS, pointer);
  map.on("mouseleave", TARGETS, resetPointer);

  return {
    select,
    disable: () => {
      ticket++;
      clearInterval(refresh);
      clearTimeout(dwell);
      map.off("click", TARGETS, onClick);
      map.off("click", onMapClick);
      map.off("mouseenter", TARGETS, pointer);
      map.off("mouseleave", TARGETS, resetPointer);
      map.getCanvas().style.cursor = "";
    },
  };
}
