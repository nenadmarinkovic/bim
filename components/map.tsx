"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { pushConfig } from "./basemap-config";
import { endJob, startJob } from "./busy";
import { markMapReady } from "./map-ready";
import { MapControls } from "./map-controls";
import { MapMenu } from "./map-menu";
import { MapSettings, useMapSettings } from "./map-settings";
import { enablePlaces, setPlaceVisibility } from "./places";
import {
  addExitLayers,
  exitStationName,
  exitsFor,
  loadExits,
  setExitTheme,
  showExitsFor,
} from "./exits";
import { buildPlacePopup } from "./place-popup";
import { enableStops, type Station, type StopSelection } from "./stops";
import { StationSearch } from "./station-search";
import { MapAttribution } from "./map-attribution";
import { installStopIcons } from "./stop-icons";
import { fountainImageId, installFountainIcons } from "./fountain-icons";
import { TOILET_IMAGE, installToiletIcon } from "./toilet-icons";
import { buildStopPopup, rowColour, rowKey } from "./stop-popup";
import type { BoardRow } from "@/lib/vehicles/board";
import { PlaceChat, type ChatPlace } from "./place-chat";
import { buildVehiclePopup } from "./vehicle-popup";
import { useLocale } from "./locale-provider";
import { fill, type Dictionary, type Locale } from "@/lib/i18n";
import {
  addRouteLayers,
  clearRoute,
  showRoute,
  type TripRoute,
} from "./vehicle-route";
import { vehicleColour } from "@/lib/vehicles/colors";
import type { Vehicle } from "@/lib/vehicles/types";
import {
  BIKES_CASING_LAYER,
  BIKES_LAYER,
  BIKES_SOFT_LAYER,
  BIKES_SOURCE,
  FOUNTAINS_LAYER,
  FOUNTAINS_SOURCE,
  ROADWORKS_LABEL_LAYER,
  ROADWORKS_LINE_LAYER,
  ROADWORKS_POINT_LAYER,
  ROADWORKS_SOURCE,
  TOILETS_LAYER,
  TOILETS_SOURCE,
  ZONES_FILL_LAYER,
  ZONES_LABEL_LAYER,
  ZONES_LINE_LAYER,
  ZONES_SOURCE,
  DISTRICTS_FILL_LAYER,
  DISTRICTS_LABEL_LAYER,
  DISTRICTS_LINE_LAYER,
  DISTRICTS_SOURCE,
  STOPS_BADGE_LAYER,
  STOPS_LAYER,
  STOPS_SOURCE,
} from "@/lib/vehicles/layer-ids";
import {
  CAMERA,
  EMBED_CAMERA,
  MAX_PITCH,
  MAX_ZOOM,
  MIN_ZOOM,
  NETWORK_BOUNDS,
  STEPHANSDOM,
  EMBED_CENTRE,
  pitchCeiling,
} from "@/lib/map-camera";
import { POLL_MS } from "./use-vehicles";
import { useVehiclesContext, useViewportReporter } from "./vehicles-provider";
import {
  SPRITE_TO_3D_ZOOM,
  VEHICLES_3D_SOURCE,
  VEHICLES_SOURCE,
  addVehicleLayers,
  revealVehicles,
  bindVehicleSelection,
  setVehicleTheme,
} from "./vehicle-layer";
import {
  reconcile,
  sample,
  toFeatureCollection,
  type Tween,
} from "@/lib/vehicles/animate";
import { toExtrusionCollection } from "@/lib/vehicles/footprint";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const FOLLOW_PITCH = 72;
const FOLLOW_MIN_ZOOM = 17.2;

const STYLE = "mapbox://styles/mapbox/standard";

type Cull = { west: number; south: number; east: number; north: number };

function viewportBounds(instance: mapboxgl.Map): Cull | undefined {
  const view = instance.getBounds();
  if (!view) return undefined;
  const sw = view.getSouthWest();
  const ne = view.getNorthEast();

  if (ne.lng - sw.lng < 1e-3 || ne.lat - sw.lat < 1e-3) return undefined;
  const padLon = (ne.lng - sw.lng) * 0.25;
  const padLat = (ne.lat - sw.lat) * 0.25;
  return {
    west: sw.lng - padLon,
    south: sw.lat - padLat,
    east: ne.lng + padLon,
    north: ne.lat + padLat,
  };
}

const bboxParam = (c: Cull) =>
  [c.west, c.south, c.east, c.north].map((n) => n.toFixed(4)).join(",");

const CAMERA_KEY = "bim:camera";

type SavedCamera = {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
};

function readCamera(): SavedCamera | null {
  try {
    const raw = sessionStorage.getItem(CAMERA_KEY);
    return raw ? (JSON.parse(raw) as SavedCamera) : null;
  } catch {
    return null;
  }
}

function saveCamera(map: mapboxgl.Map) {
  try {
    const centre = map.getCenter();
    sessionStorage.setItem(
      CAMERA_KEY,
      JSON.stringify({
        center: [centre.lng, centre.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      }),
    );
  } catch {}
}

function lightPresetFor(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? "night" : "day";
}

function themeFromDocument(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const KIND_ORDER = [
  "match",
  ["get", "kind"],
  "metro",
  0,
  "train",
  1,
  "tram",
  2,
  3,
] as never;

function applyMapTheme(map: mapboxgl.Map, dark: boolean): boolean {
  if (!pushConfig(map, "lightPreset", dark ? "night" : "day")) return false;

  if (map.getLayer(DISTRICTS_FILL_LAYER)) {
    map.setPaintProperty(
      DISTRICTS_FILL_LAYER,
      "fill-opacity",
      DISTRICT_WASH[dark ? "dark" : "light"],
    );
  }

  const ink = dark ? "#ffff01" : "#0040ff";
  if (map.getLayer(DISTRICTS_LINE_LAYER)) {
    map.setPaintProperty(DISTRICTS_LINE_LAYER, "line-color", ink);
  }
  if (map.getLayer(DISTRICTS_LABEL_LAYER)) {
    map.setPaintProperty(DISTRICTS_LABEL_LAYER, "text-color", ink);
  }

  const halo = dark ? "#12161b" : "#ffffff";

  const bikeInk = BIKE_INK[dark ? "dark" : "light"];
  for (const layer of [BIKES_LAYER, BIKES_SOFT_LAYER]) {
    if (map.getLayer(layer)) map.setPaintProperty(layer, "line-color", bikeInk);
  }
  if (map.getLayer(BIKES_CASING_LAYER)) {
    map.setPaintProperty(
      BIKES_CASING_LAYER,
      "line-color",
      BIKE_CASING[dark ? "dark" : "light"],
    );
  }

  const zoneInk = ZONE_INK[dark ? "dark" : "light"];
  if (map.getLayer(ZONES_FILL_LAYER)) {
    map.setPaintProperty(ZONES_FILL_LAYER, "fill-color", zoneInk);
    map.setPaintProperty(
      ZONES_FILL_LAYER,
      "fill-opacity",
      ZONE_WASH[dark ? "dark" : "light"],
    );
  }
  if (map.getLayer(ZONES_LINE_LAYER)) {
    map.setPaintProperty(ZONES_LINE_LAYER, "line-color", zoneInk);
  }
  if (map.getLayer(ZONES_LABEL_LAYER)) {
    map.setPaintProperty(ZONES_LABEL_LAYER, "text-color", zoneInk);
    map.setPaintProperty(ZONES_LABEL_LAYER, "text-halo-color", halo);
  }

  const worksInk = ROADWORK_INK[dark ? "dark" : "light"];
  if (map.getLayer(ROADWORKS_LINE_LAYER)) {
    map.setPaintProperty(ROADWORKS_LINE_LAYER, "line-color", worksInk);
  }
  if (map.getLayer(ROADWORKS_POINT_LAYER)) {
    map.setPaintProperty(ROADWORKS_POINT_LAYER, "circle-color", worksInk);
    map.setPaintProperty(ROADWORKS_POINT_LAYER, "circle-stroke-color", halo);
  }
  if (map.getLayer(ROADWORKS_LABEL_LAYER)) {
    map.setPaintProperty(ROADWORKS_LABEL_LAYER, "text-color", worksInk);
    map.setPaintProperty(ROADWORKS_LABEL_LAYER, "text-halo-color", halo);
  }

  setExitTheme(map, dark);
  setVehicleTheme(map, dark);
  return true;
}

const DISTRICT_TINTS = ["#6a8caf", "#7fa07a", "#c2925f", "#9b7fa6"] as const;

const DISTRICT_WASH = { light: 0.16, dark: 0.22 } as const;

function addDistrictLayers(map: mapboxgl.Map) {
  if (map.getSource(DISTRICTS_SOURCE)) return;

  map.addSource(DISTRICTS_SOURCE, {
    type: "geojson",
    data: "/api/districts",
  });

  map.addLayer({
    id: DISTRICTS_FILL_LAYER,
    type: "fill",
    source: DISTRICTS_SOURCE,
    slot: "bottom",
    layout: { visibility: "none" },
    paint: {
      "fill-color": [
        "match",
        ["get", "tint"],
        0,
        DISTRICT_TINTS[0],
        1,
        DISTRICT_TINTS[1],
        2,
        DISTRICT_TINTS[2],
        DISTRICT_TINTS[3],
      ],
      "fill-opacity": DISTRICT_WASH.light,
      "fill-emissive-strength": 1,
    },
  });

  map.addLayer({
    id: DISTRICTS_LINE_LAYER,
    type: "line",
    source: DISTRICTS_SOURCE,
    slot: "middle",
    layout: { visibility: "none", "line-cap": "round" },
    paint: {
      "line-color": "#0040ff",
      "line-emissive-strength": 1,
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 15, 0.28],
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 2],
      "line-dasharray": [2, 2],
    },
  });

  map.addLayer({
    id: DISTRICTS_LABEL_LAYER,
    type: "symbol",
    source: DISTRICTS_SOURCE,
    slot: "top",
    layout: {
      visibility: "none",
      "text-field": ["get", "label"],
      "text-font": ["DIN Pro Bold", "Arial Unicode MS Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 14],
      "text-letter-spacing": 0.08,
      "text-transform": "uppercase",
      "text-padding": 12,
      "symbol-placement": "point",
    },
    paint: {
      "text-color": "#0040ff",
      "text-emissive-strength": 1,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.75, 15, 0.4],
      "text-halo-width": 0,
    },
  });
}

const BIKES_SOLID = ["match", ["get", "class"], ["path", "lane"], true, false];

const BIKES_SHARED = [
  "match",
  ["get", "class"],
  ["calm", "crossing"],
  true,
  false,
];

const BIKE_INK = { light: "#00753a", dark: "#3ce084" } as const;

const BIKE_CASING = { light: "#ffffff", dark: "#04150c" } as const;

const bikeFade = (near: number | unknown[]) => [
  "interpolate",
  ["linear"],
  ["zoom"],
  10.5,
  0,
  13,
  near,
];

function addBikeLayers(map: mapboxgl.Map) {
  if (map.getSource(BIKES_SOURCE)) return;

  map.addSource(BIKES_SOURCE, {
    type: "geojson",
    data: "/api/bike-paths",
  });

  map.addLayer({
    id: BIKES_CASING_LAYER,
    type: "line",
    source: BIKES_SOURCE,
    slot: "middle",
    filter: BIKES_SOLID as never,
    layout: {
      visibility: "none",
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": BIKE_CASING.light,
      "line-emissive-strength": 1,
      "line-opacity": bikeFade(0.7) as never,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        2.5,
        16,
        6,
        18,
        9,
      ],
    },
  });

  map.addLayer({
    id: BIKES_SOFT_LAYER,
    type: "line",
    source: BIKES_SOURCE,
    slot: "middle",
    filter: BIKES_SHARED as never,
    layout: {
      visibility: "none",
      "line-cap": "butt",
      "line-join": "round",
    },
    paint: {
      "line-color": BIKE_INK.light,
      "line-emissive-strength": 1,
      "line-opacity": bikeFade(0.55) as never,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1, 16, 2, 18, 3],
      "line-dasharray": [
        "match",
        ["get", "class"],

        "crossing",
        ["literal", [1, 1.5]],
        ["literal", [2.5, 2]],
      ] as never,
    },
  });

  map.addLayer({
    id: BIKES_LAYER,
    type: "line",
    source: BIKES_SOURCE,
    slot: "middle",
    filter: BIKES_SOLID as never,
    layout: {
      visibility: "none",
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": BIKE_INK.light,
      "line-emissive-strength": 1,

      "line-opacity": bikeFade([
        "match",
        ["get", "class"],
        "path",
        1,
        0.8,
      ]) as never,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12,
        ["match", ["get", "class"], "path", 1.2, 0.9],
        16,
        ["match", ["get", "class"], "path", 3, 2.2],
        18,
        ["match", ["get", "class"], "path", 5, 3.6],
      ] as never,
    },
  });
}

const ZONE_INK = { light: "#8a5a12", dark: "#f0b869" } as const;

const ZONE_WASH = { light: 0.17, dark: 0.2 } as const;

function addZoneLayers(map: mapboxgl.Map) {
  if (map.getSource(ZONES_SOURCE)) return;

  map.addSource(ZONES_SOURCE, {
    type: "geojson",
    data: "/api/pedestrian-zones",
  });

  map.addLayer({
    id: ZONES_FILL_LAYER,
    type: "fill",
    source: ZONES_SOURCE,
    slot: "middle",
    layout: { visibility: "none" },
    paint: {
      "fill-color": ZONE_INK.light,
      "fill-opacity": ZONE_WASH.light,
      "fill-emissive-strength": 1,
    },
  });

  map.addLayer({
    id: ZONES_LINE_LAYER,
    type: "line",
    source: ZONES_SOURCE,
    slot: "middle",
    layout: { visibility: "none", "line-join": "round" },
    paint: {
      "line-color": ZONE_INK.light,
      "line-emissive-strength": 1,
      "line-opacity": 0.7,
      "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.8, 17, 2],
    },
  });

  map.addLayer({
    id: ZONES_LABEL_LAYER,
    type: "symbol",
    source: ZONES_SOURCE,
    slot: "top",
    minzoom: 15,
    layout: {
      visibility: "none",
      "text-field": ["get", "name"],
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 15, 10, 18, 13],
      "text-max-width": 9,
      "text-padding": 6,
    },
    paint: {
      "text-color": ZONE_INK.light,
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.2,
      "text-emissive-strength": 1,
    },
  });
}

const ROADWORK_INK = { light: "#c2410c", dark: "#ff9351" } as const;

const isPoint = ["==", ["geometry-type"], "Point"];

function addRoadworkLayers(map: mapboxgl.Map) {
  if (map.getSource(ROADWORKS_SOURCE)) return;

  map.addSource(ROADWORKS_SOURCE, {
    type: "geojson",
    data: "/api/roadworks",
  });

  map.addLayer({
    id: ROADWORKS_LINE_LAYER,
    type: "line",
    source: ROADWORKS_SOURCE,
    slot: "middle",
    filter: ["!", isPoint] as never,
    layout: { visibility: "none", "line-cap": "butt", "line-join": "round" },
    paint: {
      "line-color": ROADWORK_INK.light,
      "line-emissive-strength": 1,
      "line-opacity": 0.85,
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 16, 7, 18, 11],
      "line-dasharray": [1.4, 0.8],
    },
  });

  map.addLayer({
    id: ROADWORKS_POINT_LAYER,
    type: "circle",
    source: ROADWORKS_SOURCE,
    slot: "top",
    filter: isPoint as never,
    layout: { visibility: "none" },
    paint: {
      "circle-color": ROADWORK_INK.light,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 16, 7],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-emissive-strength": 1,
    },
  });

  map.addLayer({
    id: ROADWORKS_LABEL_LAYER,
    type: "symbol",
    source: ROADWORKS_SOURCE,
    slot: "top",
    minzoom: 13.5,
    layout: {
      visibility: "none",
      "text-field": ["get", "label"],
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10.5, 18, 13],
      "text-anchor": "top",
      "text-offset": [0, 0.7],
      "text-max-width": 10,
      "text-padding": 6,
      "text-optional": true,
    },
    paint: {
      "text-color": ROADWORK_INK.light,
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4,
      "text-emissive-strength": 1,
    },
  });
}

function addFountainLayer(map: mapboxgl.Map) {
  if (map.getSource(FOUNTAINS_SOURCE)) return;

  map.addSource(FOUNTAINS_SOURCE, {
    type: "geojson",
    data: "/api/fountains",
  });

  map.addLayer({
    id: FOUNTAINS_LAYER,
    type: "symbol",
    source: FOUNTAINS_SOURCE,
    slot: "top",
    minzoom: 14,
    layout: {
      visibility: "none",
      "icon-image": [
        "case",
        ["get", "trough"],
        fountainImageId("trough"),
        fountainImageId("plain"),
      ],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 18, 1],
      "icon-allow-overlap": false,
      "icon-padding": 2,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
    },
  });
}

const WINTER_SHUT = [10, 11, 0, 1, 2].includes(new Date().getMonth());

function addToiletLayer(map: mapboxgl.Map) {
  if (map.getSource(TOILETS_SOURCE)) return;

  map.addSource(TOILETS_SOURCE, {
    type: "geojson",
    data: "/api/toilets",
  });

  map.addLayer({
    id: TOILETS_LAYER,
    type: "symbol",
    source: TOILETS_SOURCE,
    slot: "top",
    minzoom: 14,
    layout: {
      visibility: "none",
      "icon-image": TOILET_IMAGE,
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 18, 1],
      "icon-allow-overlap": false,
      "icon-padding": 2,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
    },
    paint: {
      "icon-opacity": WINTER_SHUT
        ? (["case", ["get", "winter"], 0.45, 1] as never)
        : 1,
    },
  });
}

function addStopsLayer(map: mapboxgl.Map) {
  if (map.getSource(STOPS_SOURCE)) return;

  map.addSource(STOPS_SOURCE, {
    type: "geojson",
    data: "/api/stops",
  });

  map.addLayer({
    id: STOPS_LAYER,
    type: "circle",
    source: STOPS_SOURCE,
    slot: "top",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        5,
        14,
        7,
        16,
        9,
      ],
      "circle-color": "#000000",
      "circle-opacity": 0,
    },
  });

  map.addLayer({
    id: STOPS_BADGE_LAYER,
    type: "symbol",
    source: STOPS_SOURCE,
    slot: "top",
    layout: {
      "icon-image": ["concat", "bim-stop-", ["get", "modes"]],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.7,
        14,
        1,
        17,
        1.2,
      ],

      "icon-allow-overlap": false,
      "icon-padding": 2,
      "symbol-sort-key": KIND_ORDER,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
    },
  });
}

type PopupContext = {
  map: mapboxgl.Map;
  popup: mapboxgl.Popup;
  following: { current: string | null };
  routeTrip: { current: string | null };
  dark: boolean;
  dict: Dictionary;
  takeRoute: () => void;
};

function renderVehiclePopup(ctx: PopupContext, vehicle: Vehicle) {
  const { map, popup, following, routeTrip, dark, dict, takeRoute } = ctx;

  popup.setDOMContent(
    buildVehiclePopup(
      vehicle,
      {
        routeShown: routeTrip.current === vehicle.id,
        following: following.current === vehicle.id,
        onToggleRoute: () => {
          if (routeTrip.current === vehicle.id) {
            routeTrip.current = null;
            clearRoute(map);
            renderVehiclePopup(ctx, vehicle);
            return;
          }
          fetch(`/api/route?trip=${encodeURIComponent(vehicle.id)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((route: TripRoute | null) => {
              if (!route) return;
              takeRoute();
              routeTrip.current = vehicle.id;
              const base = vehicleColour(vehicle.mode, vehicle.line, dark);
              showRoute(map, route, base, dark);
              renderVehiclePopup(ctx, vehicle);
            })
            .catch(() => {});
        },
        onToggleFollow: () => {
          following.current =
            following.current === vehicle.id ? null : vehicle.id;
          renderVehiclePopup(ctx, vehicle);
        },
      },
      dict,
    ),
  );
}

export function MapView({
  embed = false,
  parents = [],
}: {
  embed?: boolean;
  parents?: string[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const { locale, dictionary } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [chatPlace, setChatPlace] = useState<ChatPlace | null>(null);
  const { data, error: vehicleError } = useVehiclesContext();
  const reportViewport = useViewportReporter();
  const tweens = useRef<Map<string, Tween>>(new Map());
  const animateUntil = useRef(0);
  const drewSettled = useRef<string | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const selected = useRef<string | null>(null);
  const seenData = useRef(false);
  const placePopup = useRef<mapboxgl.Popup | null>(null);
  const stopPopup = useRef<mapboxgl.Popup | null>(null);
  const openStop = useRef<StopSelection | null>(null);
  const tracing = useRef<string | null>(null);
  const redrawStop = useRef<(() => void) | null>(null);
  const untraceable = useRef<Set<string>>(new Set());
  const disableStops = useRef<(() => void) | null>(null);
  const pickStation = useRef<((station: Station) => void) | null>(null);
  const following = useRef<string | null>(null);
  const framed = useRef<string | null>(null);
  const routeTrip = useRef<string | null>(null);
  const exitsOpen = useRef<string | null>(null);
  const disablePlaces = useRef<(() => void) | null>(null);
  const stopPlaceVisibility = useRef<(() => void) | null>(null);
  const theme = useRef(resolvedTheme ?? themeFromDocument());
  const dict = useRef(dictionary);
  const lang = useRef<Locale>(locale);

  // Stable on purpose: the controls hang a geolocation watch off this, and a
  // fresh identity would tear the watch down on every vehicle poll.
  const getMap = useCallback(() => map.current, []);

  useEffect(() => {
    if (resolvedTheme) theme.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    dict.current = dictionary;
    lang.current = locale;
  }, [dictionary, locale]);

  useEffect(() => {
    if (!TOKEN) markMapReady();
  }, []);

  useEffect(() => {
    if (!TOKEN || !container.current || map.current) return;

    mapboxgl.accessToken = TOKEN;

    const resumed = embed ? null : readCamera();
    const opening = embed ? EMBED_CAMERA : CAMERA;
    const centre = embed ? EMBED_CENTRE : STEPHANSDOM;

    const instance = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: resumed?.center ?? [centre.lng, centre.lat],
      zoom: resumed?.zoom ?? opening.zoom,
      pitch: resumed?.pitch ?? opening.pitch,
      bearing: resumed?.bearing ?? opening.bearing,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxPitch: MAX_PITCH,
      maxBounds: NETWORK_BOUNDS,
      attributionControl: false,
      cooperativeGestures:
        embed && window.matchMedia("(pointer: coarse)").matches,
      config: {
        basemap: {
          theme: "faded",
          lightPreset: lightPresetFor(theme.current),
          show3dObjects: true,
          showPointOfInterestLabels: false,
          showLandmarkIcons: false,
          showLandmarkIconLabels: false,
          showTransitLabels: false,
          showRoadLabels: true,
          showPlaceLabels: true,
          roadsBrightness: 0.22,
        },
      },
    });

    const initial = viewportBounds(instance);
    if (initial) reportViewport(bboxParam(initial));

    instance.on("moveend", () => saveCamera(instance));

    let lastZoom = instance.getZoom();
    let cap = MAX_PITCH;
    const capPitch = (next: number) => {
      if (Math.abs(next - cap) < 1) return;
      cap = next;
      instance.setMaxPitch(next);
    };

    instance.on("zoom", () => {
      const zoom = instance.getZoom();
      const outward = zoom < lastZoom;
      lastZoom = zoom;
      if (outward) capPitch(pitchCeiling(zoom));
    });

    instance.on("zoomend", () => capPitch(MAX_PITCH));

    const working = () => startJob("map");
    const settled = () => endJob("map");
    instance.on("movestart", working);
    instance.on("zoomstart", working);
    instance.on("moveend", settled);
    instance.on("zoomend", settled);

    instance.on("load", markMapReady);
    instance.on("idle", markMapReady);

    const addLayers = () => {
      void installStopIcons(instance).then(() => addStopsLayer(instance));
      addDistrictLayers(instance);
      addBikeLayers(instance);
      addZoneLayers(instance);
      addRoadworkLayers(instance);
      void installFountainIcons(instance).then(() =>
        addFountainLayer(instance),
      );
      void installToiletIcon(instance).then(() => addToiletLayer(instance));
      void addExitLayers(instance);

      void loadExits().then(() => redrawStop.current?.());
      addRouteLayers(instance);
      addVehicleLayers(instance, theme.current === "dark");
      applyMapTheme(instance, theme.current === "dark");

      if (seenData.current) revealVehicles(instance);
    };
    instance.on("load", addLayers);
    instance.on("style.load", addLayers);

    popup.current = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 12,
      className: "bim-popup",
      focusAfterOpen: false,
      maxWidth: "268px",
    });
    popup.current.on("close", () => {
      selected.current = null;
    });

    placePopup.current = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 14,
      className: "bim-popup bim-popup-place",
      focusAfterOpen: false,
      maxWidth: "260px",
    });

    stopPopup.current = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 10,
      className: "bim-popup bim-popup-stop",
      focusAfterOpen: false,
      maxWidth: "300px",
    });
    stopPopup.current.on("close", () => {
      openStop.current = null;
      tracing.current = null;

      if (!routeTrip.current) clearRoute(instance);
    });

    const drawStopPopup = (from: StopSelection | null = openStop.current) => {
      const selection = from;
      if (!selection) return;

      let content: HTMLElement;
      try {
        const exits = exitsFor(selection.name);
        content = buildStopPopup({
          selection,
          dark: theme.current === "dark",
          dict: dict.current,
          tracing: tracing.current,
          untraceable: untraceable.current,
          onTrace: (row) => traceRow(instance, row),
          exits,
          exitsShown: exitsOpen.current === selection.name,
          onToggleExits: () => {
            const open = exitsOpen.current === selection.name;
            exitsOpen.current = open ? null : selection.name;
            showExitsFor(
              instance,
              open ? null : exitStationName(selection.name),
            );
            redrawStop.current?.();
          },
        });
      } catch (cause) {
        console.error("stop popup failed to render", cause);
        content = document.createElement("div");
        content.className = "bim-stop-popup";
        content.textContent = fill(dict.current.stop.drawFailed, {
          name: selection.name,
        });
      }

      stopPopup.current?.setDOMContent(content);
    };
    redrawStop.current = drawStopPopup;

    const traceRow = (map: mapboxgl.Map, row: BoardRow) => {
      const key = rowKey(row);
      if (tracing.current === key) {
        tracing.current = null;
        clearRoute(map);
        drawStopPopup();
        return;
      }

      const station = openStop.current?.diva;
      const query = new URLSearchParams({
        line: row.line,
        towards: row.towards,
        ...(station ? { from: String(station) } : {}),
      });

      fetch(`/api/route?${query}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((route: TripRoute | null) => {
          if (openStop.current?.diva !== station) return;
          if (!route) {
            untraceable.current.add(key);
            drawStopPopup();
            return;
          }

          routeTrip.current = null;
          tracing.current = key;
          const dark = theme.current === "dark";
          showRoute(map, route, rowColour(row, dark), dark);
          drawStopPopup();
        })
        .catch(() => {});
    };

    const stops = enableStops(instance, (selection) => {
      const changed = selection?.diva !== openStop.current?.diva;
      openStop.current = selection;

      if (!selection) {
        stopPopup.current?.remove();
        return;
      }
      if (changed && tracing.current) {
        tracing.current = null;
        clearRoute(instance);
      }

      const popup = stopPopup.current;
      if (popup) {
        popup.setLngLat(selection.lngLat);
        if (!popup.isOpen()) popup.addTo(instance);
      }
      drawStopPopup(selection);
    });
    disableStops.current = stops.disable;
    pickStation.current = stops.select;

    bindVehicleSelection(instance, (id) => {
      selected.current = id;
      if (!id) {
        popup.current?.remove();
        following.current = null;
        if (routeTrip.current) {
          routeTrip.current = null;
          clearRoute(instance);
        }
      }
    });
    instance.on("error", (event) => {
      markMapReady();
      setError(event.error?.message ?? "Mapbox failed to load.");
    });

    map.current = instance;

    return () => {
      endJob("map");
      disableStops.current?.();
      disableStops.current = null;
      disablePlaces.current?.();
      disablePlaces.current = null;
      stopPlaceVisibility.current?.();
      stopPlaceVisibility.current = null;
      instance.remove();
      map.current = null;
    };
  }, [embed, reportViewport]);

  const setPlacesEnabled = useCallback((on: boolean) => {
    const instance = map.current;
    if (!instance) return;

    if (!on) {
      disablePlaces.current?.();
      disablePlaces.current = null;
      placePopup.current?.remove();
      stopPlaceVisibility.current?.();
      stopPlaceVisibility.current = setPlaceVisibility(instance, false);
      return;
    }

    if (!disablePlaces.current) {
      disablePlaces.current = enablePlaces(
        instance,
        (place) => {
          if (!place) {
            placePopup.current?.remove();
            return;
          }
          placePopup.current
            ?.setLngLat(place.lngLat)
            .setDOMContent(
              buildPlacePopup(
                place,
                () =>
                  setChatPlace({
                    title: place.title,
                    kind: place.kind,
                    summary: place.detail,
                  }),
                dict.current,
                lang.current,
              ),
            )
            .addTo(instance);
        },
        { dict: dict.current, locale: lang.current },
      );
    }
    stopPlaceVisibility.current?.();
    stopPlaceVisibility.current = setPlaceVisibility(instance, true);
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const enable = () => setPlacesEnabled(true);
    if (instance.isStyleLoaded()) enable();
    else instance.once("load", enable);
  }, [setPlacesEnabled]);

  const settings = useMapSettings({
    getMap: () => map.current,
    onPlacesChange: setPlacesEnabled,
    embed,
    parents,
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !resolvedTheme) return;
    const dark = resolvedTheme === "dark";

    redrawStop.current?.();

    let frame = 0;
    let attempts = 0;
    const tryApply = () => {
      if (applyMapTheme(instance, dark) || attempts++ > 600) return;
      frame = requestAnimationFrame(tryApply);
    };
    tryApply();

    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!data) return;
    seenData.current = true;
    if (map.current) revealVehicles(map.current);
    const now = performance.now();
    tweens.current = reconcile(tweens.current, data.vehicles, now, POLL_MS);
    animateUntil.current = now + POLL_MS;
    drewSettled.current = null;

    const id = selected.current;
    if (!id) return;
    const vehicle = data.vehicles.find((v) => v.id === id);
    if (!vehicle) {
      popup.current?.remove();
      selected.current = null;
      return;
    }
    const instance = map.current;
    if (instance && popup.current) {
      renderVehiclePopup(
        {
          map: instance,
          popup: popup.current,
          following,
          routeTrip,
          dark: theme.current === "dark",
          dict: dict.current,
          takeRoute: () => {
            if (!tracing.current) return;
            tracing.current = null;
            redrawStop.current?.();
          },
        },
        vehicle,
      );
    }
  }, [data]);

  useEffect(() => {
    if (!TOKEN) return;
    let frame = 0;
    let lastDraw = 0;
    const MIN_FRAME_MS = window.matchMedia("(pointer: coarse)").matches
      ? 100
      : 50;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastDraw < MIN_FRAME_MS) return;
      lastDraw = now;

      const instance = map.current;
      if (!instance) return;

      const cull = viewportBounds(instance);
      const bbox = cull ? bboxParam(cull) : "";

      if (cull) reportViewport(bbox);

      const settled = now > animateUntil.current && !following.current;
      if (settled && drewSettled.current === bbox) return;
      drewSettled.current = settled ? bbox : null;

      if (!tweens.current.size || !instance.getSource(VEHICLES_SOURCE)) return;

      const source = instance.getSource(
        VEHICLES_SOURCE,
      ) as mapboxgl.GeoJSONSource;
      source.setData(
        toFeatureCollection(
          tweens.current,
          now,
          theme.current === "dark",
          cull,
        ),
      );

      if (instance.getZoom() >= SPRITE_TO_3D_ZOOM) {
        const extrusions = instance.getSource(VEHICLES_3D_SOURCE) as
          | mapboxgl.GeoJSONSource
          | undefined;
        extrusions?.setData(
          toExtrusionCollection(
            tweens.current,
            now,
            theme.current === "dark",
            cull,
          ),
        );
      }

      const followId = following.current;
      if (followId) {
        const followed = tweens.current.get(followId);
        if (followed) {
          const at = sample(followed, now);

          if (framed.current !== followId) {
            framed.current = followId;
            instance.jumpTo({
              center: [at.lon, at.lat],
              bearing: at.bearing,
              pitch: FOLLOW_PITCH,
              zoom: Math.max(instance.getZoom(), FOLLOW_MIN_ZOOM),
            });
          } else {
            instance.jumpTo({ center: [at.lon, at.lat], bearing: at.bearing });
          }
        }
      } else if (framed.current) {
        framed.current = null;
      }

      const id = selected.current;
      if (!id) return;
      const tween = tweens.current.get(id);
      if (!tween) return;
      const at = sample(tween, now);
      if (!popup.current?.isOpen()) {
        renderVehiclePopup(
          {
            map: instance,
            popup: popup.current!,
            following,
            routeTrip,
            dark: theme.current === "dark",
            dict: dict.current,
            takeRoute: () => {
              if (!tracing.current) return;
              tracing.current = null;
              redrawStop.current?.();
            },
          },
          tween.vehicle,
        );
        popup.current?.addTo(instance);
      }
      popup.current?.setLngLat([at.lon, at.lat]);
    };

    const start = () => {
      if (frame) return;

      lastDraw = 0;
      drewSettled.current = null;
      frame = requestAnimationFrame(draw);
    };

    const stopLoop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onVisibility = () => (document.hidden ? stopLoop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reportViewport]);

  if (!TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-card px-8">
        <div className="max-w-sm text-center">
          <p className="text-base text-foreground">
            {dictionary.map.tokenMissing}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {dictionary.map.tokenAddBefore}
            <code className="rounded bg-foreground/6 px-1 py-px font-mono text-xs">
              NEXT_PUBLIC_MAPBOX_TOKEN
            </code>
            {dictionary.map.tokenAddBetween}
            <code className="font-mono text-xs">.env.local</code>
            {dictionary.map.tokenAddAfter}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="bim-map h-full w-full" />

      <div className="pointer-events-none absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-20 flex items-center gap-2 sm:top-4 sm:right-4">
        <StationSearch
          onPick={(station) => {
            const instance = map.current;
            if (!instance) return;
            instance.flyTo({
              center: station.lngLat,
              zoom: Math.max(instance.getZoom(), 15.5),
              duration: 900,
            });
            pickStation.current?.(station);
          }}
        />
        {!embed && (
          <MapMenu className="md:hidden">
            <MapSettings views={settings} bare />
          </MapMenu>
        )}
      </div>
      <MapControls
        getMap={getMap}
        className="absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+2.75rem)] z-10 sm:right-4 sm:bottom-16"
      />
      <MapAttribution className="absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 sm:right-4 sm:bottom-4" />
      {!embed && (
        <MapSettings
          views={settings}
          className="absolute bottom-16 left-4 z-10 hidden md:flex"
        />
      )}
      {(error || vehicleError) && (
        <p
          role="status"
          className="glass pointer-events-none absolute top-1/2 left-1/2 z-20 max-w-[min(26rem,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-center text-sm text-destructive"
        >
          {error ?? vehicleError}
        </p>
      )}
      <PlaceChat
        key={chatPlace?.title ?? "none"}
        place={chatPlace}
        onClose={() => setChatPlace(null)}
      />
    </div>
  );
}
