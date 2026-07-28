"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { MapControls } from "./map-controls";
import { MapSettings } from "./map-settings";
import { enablePlaces, setPlaceVisibility } from "./places";
import { buildPlacePopup } from "./place-popup";
import { enableStops, type StopSelection } from "./stops";
import { installStopIcons } from "./stop-icons";
import { buildStopPopup, rowColour, rowKey } from "./stop-popup";
import type { BoardRow } from "@/lib/vehicles/board";
import { PlaceChat, type ChatPlace } from "./place-chat";
import { buildVehiclePopup } from "./vehicle-popup";
import {
  addRouteLayers,
  clearRoute,
  showRoute,
  type TripRoute,
} from "./vehicle-route";
import { vehicleColour } from "@/lib/vehicles/colors";
import type { Vehicle } from "@/lib/vehicles/types";
import {
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

function lightPresetFor(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? "night" : "day";
}

// Rail before road when badges collide: a rider plans around the U-Bahn.
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

  setVehicleTheme(map, dark);
  return true;
}

function addStopsLayer(map: mapboxgl.Map) {
  if (map.getSource(STOPS_SOURCE)) return;

  map.addSource(STOPS_SOURCE, {
    type: "geojson",
    data: "/api/stops",
  });

  // Clicks land here, not on the badge. Symbols that lose a collision are not
  // placed, and an unplaced symbol answers no query — which is how a busy
  // interchange like Reumannplatz became entirely unclickable.
  map.addLayer({
    id: STOPS_LAYER,
    type: "circle",
    source: STOPS_SOURCE,
    slot: "top",
    paint: {
      // Big enough that a badge is always reachable, small enough that clicking
      // beside a station still counts as clicking away from it.
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
      // One image per combination of modes, so a station that has a U-Bahn, a
      // tram and a bus shows all three badges in a row.
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
      // Left to collide: 1,726 stations at city zoom is unreadable otherwise,
      // and the sort key decides who survives.
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
  // One route layer, two popups that can drive it.
  takeRoute: () => void;
};

function renderVehiclePopup(ctx: PopupContext, vehicle: Vehicle) {
  const { map, popup, following, routeTrip, dark, takeRoute } = ctx;

  popup.setDOMContent(
    buildVehiclePopup(vehicle, {
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
    }),
  );
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { resolvedTheme } = useTheme();
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
  const following = useRef<string | null>(null);
  const routeTrip = useRef<string | null>(null);
  const disablePlaces = useRef<(() => void) | null>(null);
  const stopPlaceVisibility = useRef<(() => void) | null>(null);
  const theme = useRef(resolvedTheme);

  useEffect(() => {
    theme.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (!TOKEN || !container.current || map.current) return;

    mapboxgl.accessToken = TOKEN;

    const instance = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: [STEPHANSDOM.lng, STEPHANSDOM.lat],
      zoom: CAMERA.zoom,
      pitch: CAMERA.pitch,
      bearing: CAMERA.bearing,
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

    const addLayers = () => {
      // Images first: a symbol layer whose icon is missing logs on every tile.
      void installStopIcons(instance).then(() => addStopsLayer(instance));
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
      // Whatever the board drew closes with it. Gating this on the tracing flag
      // meant one flag out of step stranded a route — and its arrows — on the
      // map with nothing left able to clear them.
      if (!routeTrip.current) clearRoute(instance);
    });

    const drawStopPopup = (from: StopSelection | null = openStop.current) => {
      const selection = from;
      if (!selection) return;

      let content: HTMLElement;
      try {
        content = buildStopPopup({
          selection,
          dark: theme.current === "dark",
          tracing: tracing.current,
          untraceable: untraceable.current,
          onTrace: (row) => traceRow(instance, row),
        });
      } catch (cause) {
        // A popup that failed to draw keeps whatever it last showed, so a
        // throw here reads as a board that never finishes loading. Say what
        // actually happened instead.
        console.error("stop popup failed to render", cause);
        content = document.createElement("div");
        content.className = "bim-stop-popup";
        content.textContent = `${selection.name} — could not draw the board.`;
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
            // Say so on the row rather than leaving a tap that does nothing.
            untraceable.current.add(key);
            drawStopPopup();
            return;
          }
          // The board and the vehicle popup share one route layer, so taking it
          // has to release whoever was holding it.
          routeTrip.current = null;
          tracing.current = key;
          const dark = theme.current === "dark";
          showRoute(map, route, rowColour(row, dark), dark);
          drawStopPopup();
        })
        .catch(() => {});
    };

    disableStops.current = enableStops(instance, (selection) => {
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
        // addTo() on an already-open popup removes and re-adds it, and the
        // close event fired in between clears the selection about to be drawn.
        if (!popup.isOpen()) popup.addTo(instance);
      }
      drawStopPopup(selection);
    });

    bindVehicleSelection(instance, (id) => {
      selected.current = id;
      if (!id) {
        popup.current?.remove();
        following.current = null;
        // Deselecting a vehicle fires on any click that missed one, so it must
        // only drop the route it owns. Wiping a route the board is tracing left
        // the highlighted row insisting it was still drawn.
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
      disablePlaces.current = enablePlaces(instance, (place) => {
        if (!place) {
          placePopup.current?.remove();
          return;
        }
        placePopup.current
          ?.setLngLat(place.lngLat)
          .setDOMContent(
            buildPlacePopup(place, () =>
              setChatPlace({
                title: place.title,
                kind: place.kind,
                summary: place.detail,
              }),
            ),
          )
          .addTo(instance);
      });
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
          takeRoute: () => {
            // Reads refs only, so it stays out of effect dependencies.
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
          mapboxgl.GeoJSONSource | undefined;
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
          <p className="text-base text-foreground">Mapbox token missing.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add{" "}
            <code className="rounded bg-foreground/6 px-1 py-px font-mono text-xs">
              NEXT_PUBLIC_MAPBOX_TOKEN
            </code>{" "}
            to <code className="font-mono text-xs">.env.local</code> and restart
            the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      <MapControls
        getMap={() => map.current}
        className="absolute right-4 bottom-8 z-10"
      />
      <MapSettings
        getMap={() => map.current}
        onPlacesChange={setPlacesEnabled}
        className="absolute bottom-8 left-4 z-10"
      />
      {(error || vehicleError) && (
        <p className="absolute bottom-4 left-4 rounded-md bg-card px-3 py-2 text-sm text-destructive">
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
