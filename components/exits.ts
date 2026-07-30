import type mapboxgl from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";

import { normaliseName, stripModeMarkers } from "@/lib/vehicles/names";
import { EXITS_LAYER, EXITS_SOURCE } from "@/lib/vehicles/layer-ids";
import { exitImageId, installExitIcons } from "./exit-icons";

// Four answers, because OSM gives four: a door recorded as having steps is not
// the same as one nobody has looked at.
export type ExitAccess = "free" | "steps" | "limited" | "unknown";

export type ExitProperties = {
  station: string;
  name?: string;
  access: ExitAccess;
};

export type Exit = {
  name?: string;
  access: ExitAccess;
  lngLat: [number, number];
};

// Fifteen labels around one square is a lot of map to cover, so they are asked
// for a station at a time rather than left on.
const MIN_ZOOM = 15.2;

type StationExits = {
  // The name the features carry, which is OSM's, not Wiener Linien's.
  station: string;
  exits: Exit[];
};

let request: Promise<Map<string, StationExits>> | null = null;
const loaded = new Map<string, StationExits>();

// OSM names the place, Wiener Linien names the interchange — "Karlsplatz"
// against "Karlsplatz U" — so both sides are reduced to the place.
const stationKey = (name: string) => normaliseName(stripModeMarkers(name));

function index(collection: FeatureCollection<Point, ExitProperties>) {
  for (const feature of collection.features) {
    const { station, name, access } = feature.properties;
    const key = stationKey(station);
    let entry = loaded.get(key);
    if (!entry) {
      entry = { station, exits: [] };
      loaded.set(key, entry);
    }

    // A name repeats where one exit has several stairways onto the same street,
    // and one step-free way in makes the exit step-free. Unnamed doors are never
    // merged: nothing distinguishes them, so each stands on its own.
    const found = name
      ? entry.exits.find((exit) => exit.name === name)
      : undefined;
    if (found) {
      if (access === "free") found.access = "free";
      continue;
    }

    entry.exits.push({
      name,
      access,
      lngLat: feature.geometry.coordinates as [number, number],
    });
  }

  for (const entry of loaded.values()) {
    // Step-free first: "can I get out here at all" comes before "which is
    // nearest".
    entry.exits.sort(
      (a, b) =>
        Number(b.access === "free") - Number(a.access === "free") ||
        (a.name ?? "").localeCompare(b.name ?? "", "de"),
    );
  }

  return loaded;
}

export function loadExits(): Promise<Map<string, StationExits>> {
  request ??= fetch("/api/exits")
    .then((response) => (response.ok ? response.json() : null))
    .then((body) =>
      body ? index(body as FeatureCollection<Point, ExitProperties>) : loaded,
    )
    .catch(() => loaded);
  return request;
}

export const exitsFor = (name: string): Exit[] =>
  loaded.get(stationKey(name))?.exits ?? [];

type Palette = { label: string; halo: string };

// The markers are self-coloured images, so only the names follow the theme.
const PALETTE: Record<"light" | "dark", Palette> = {
  light: { label: "#2b3238", halo: "#ffffff" },
  dark: { label: "#e3e8ed", halo: "#12161b" },
};

// mapbox-gl's expression types never narrow from an array literal, so the cast
// happens once here rather than at every layer and filter that uses one.
const expression = (value: unknown) => value as never;

// Nothing matches until a station asks for its own doors. Written as an
// assertion rather than a never-true comparison: mapbox reads `["==", 1, 0]` as
// its legacy filter form, where the first argument has to be a property name.
const NONE = expression(["boolean", false]);

const stationIs = (station: string) =>
  expression(["==", ["get", "station"], station]);

// `limited` takes the steps glyph: partly accessible means something is in the
// way, which is what the glyph says. Only a door nobody has recorded gets the
// bare disc, because that is the only one where nothing is known.
const iconFor = expression([
  "match",
  ["get", "access"],
  "free",
  exitImageId("free"),
  "steps",
  exitImageId("steps"),
  "limited",
  exitImageId("steps"),
  exitImageId("unknown"),
]);

export async function addExitLayers(map: mapboxgl.Map) {
  if (map.getSource(EXITS_SOURCE)) return;

  const p = PALETTE.light;

  map.addSource(EXITS_SOURCE, { type: "geojson", data: "/api/exits" });

  await installExitIcons(map);

  map.addLayer({
    id: EXITS_LAYER,
    type: "symbol",
    source: EXITS_SOURCE,
    slot: "top",
    minzoom: MIN_ZOOM,
    filter: NONE,
    layout: {
      "icon-image": iconFor,
      // Multiples of an eighteen pixel badge, not of the bitmap behind it.
      "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.85, 19, 1.3],
      // Two doors onto the same street sit metres apart, and hiding either
      // leaves the rider guessing which end to walk to.
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "text-field": ["get", "name"],
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 15, 10.5, 19, 13],
      "text-anchor": "top",
      "text-offset": [0, 1.05],
      "text-max-width": 9,
      "text-padding": 4,
      // The name may give way in a crowd; the door itself never does.
      "text-optional": true,
    },
    paint: {
      "text-color": p.label,
      "text-halo-color": p.halo,
      "text-halo-width": 1.4,
      "text-emissive-strength": 1,
    },
  });
}

// One station's doors at a time; null clears them.
export function showExitsFor(map: mapboxgl.Map, station: string | null) {
  if (!map.getLayer(EXITS_LAYER)) return;
  map.setFilter(EXITS_LAYER, station ? stationIs(station) : NONE);
}

// Wiener Linien's name for a station is not the one the doors carry, so the
// filter is given the name recorded alongside them.
export const exitStationName = (name: string): string | null =>
  loaded.get(stationKey(name))?.station ?? null;

export function setExitTheme(map: mapboxgl.Map, dark: boolean) {
  const p = PALETTE[dark ? "dark" : "light"];
  if (!map.getLayer(EXITS_LAYER)) return;
  map.setPaintProperty(EXITS_LAYER, "text-color", p.label);
  map.setPaintProperty(EXITS_LAYER, "text-halo-color", p.halo);
}
