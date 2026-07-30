"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { MapControls } from "./map-controls";
import { MapSettings } from "./map-settings";
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
  MAX_PITCH,
  NETWORK_BOUNDS,
  STEPHANSDOM,
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

// Switching language is a route change, which remounts the map. Without this
// the switch would throw the rider back to Stephansdom mid-look.
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
  if (!map.isStyleLoaded()) return false;

  map.setConfigProperty("basemap", "lightPreset", dark ? "night" : "day");

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

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const { locale, dictionary } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [chatPlace, setChatPlace] = useState<ChatPlace | null>(null);
  const { data, error: vehicleError } = useVehiclesContext();
  const reportViewport = useViewportReporter();
  const tweens = useRef<Map<string, Tween>>(new Map());
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
  const routeTrip = useRef<string | null>(null);
  // Which station has asked for its doors; they stay until asked again.
  const exitsOpen = useRef<string | null>(null);
  const disablePlaces = useRef<(() => void) | null>(null);
  const stopPlaceVisibility = useRef<(() => void) | null>(null);
  const theme = useRef(resolvedTheme);
  const dict = useRef(dictionary);
  const lang = useRef<Locale>(locale);

  useEffect(() => {
    theme.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    dict.current = dictionary;
    lang.current = locale;
  }, [dictionary, locale]);

  useEffect(() => {
    if (!TOKEN || !container.current || map.current) return;

    mapboxgl.accessToken = TOKEN;

    const resumed = readCamera();

    const instance = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: resumed?.center ?? [STEPHANSDOM.lng, STEPHANSDOM.lat],
      zoom: resumed?.zoom ?? CAMERA.zoom,
      pitch: resumed?.pitch ?? CAMERA.pitch,
      bearing: resumed?.bearing ?? CAMERA.bearing,
      minZoom: 9,
      maxZoom: 18,
      maxPitch: MAX_PITCH,
      maxBounds: NETWORK_BOUNDS,
      attributionControl: false,
      config: {
        basemap: {
          theme: "faded",
          lightPreset: lightPresetFor(theme.current),
          show3dObjects: true,
          showPointOfInterestLabels: false,
          showLandmarkIcons: false,
          showLandmarkIconLabels: false,
          showTransitLabels: false,
          showRoadLabels: false,
          showPlaceLabels: true,
          roadsBrightness: 0.22,
        },
      },
    });

    const initial = viewportBounds(instance);
    if (initial) reportViewport(bboxParam(initial));

    instance.on("moveend", () => saveCamera(instance));

    const addLayers = () => {
      // Images first: a symbol layer whose icon is missing logs on every tile.
      void installStopIcons(instance).then(() => addStopsLayer(instance));
      addDistrictLayers(instance);
      void addExitLayers(instance);
      // A popup built before this lands would be missing its exits, so the open
      // one is drawn again once they are known.
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
      setError(event.error?.message ?? "Mapbox failed to load.");
    });

    map.current = instance;

    return () => {
      disableStops.current?.();
      disableStops.current = null;
      disablePlaces.current?.();
      disablePlaces.current = null;
      stopPlaceVisibility.current?.();
      stopPlaceVisibility.current = null;
      instance.remove();
      map.current = null;
    };
  }, [reportViewport]);

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
    if (!instance || !resolvedTheme) return;
    const dark = resolvedTheme === "dark";

    // Line badges are drawn from the same palette as the vehicles.
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
    tweens.current = reconcile(
      tweens.current,
      data.vehicles,
      performance.now(),
      POLL_MS,
    );

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
    const MIN_FRAME_MS = 50;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastDraw < MIN_FRAME_MS) return;
      lastDraw = now;

      const instance = map.current;
      if (!instance) return;

      const cull = viewportBounds(instance);

      if (cull) reportViewport(bboxParam(cull));

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
          instance.jumpTo({
            center: [at.lon, at.lat],
            bearing: at.bearing,
            pitch: FOLLOW_PITCH,
            zoom: Math.max(instance.getZoom(), FOLLOW_MIN_ZOOM),
          });
        }
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
              // Reads refs only, so it stays out of effect dependencies.
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

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
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
      <div className="pointer-events-none absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
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
      </div>
      <MapControls
        getMap={() => map.current}
        className="absolute right-4 bottom-16 z-10"
      />
      <MapAttribution className="absolute right-4 bottom-4 z-10" />
      <MapSettings
        getMap={() => map.current}
        onPlacesChange={setPlacesEnabled}
        className="absolute bottom-16 left-4 z-10"
      />
      {(error || vehicleError) && (
        // Centred: at the bottom left it sat under the Mapbox logo and read as
        // part of the furniture rather than as something having gone wrong.
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
