"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { MapControls } from "./map-controls";
import { CAMERA, MAX_PITCH, STEPHANSDOM } from "@/lib/map-camera";
import { POLL_MS } from "./use-vehicles";
import { useVehiclesContext } from "./vehicles-provider";
import {
  VEHICLES_SOURCE,
  addVehicleLayers,
  bindVehicleSelection,
  describeVehicle,
  setVehicleTheme,
} from "./vehicle-layer";
import {
  reconcile,
  sample,
  toFeatureCollection,
  type Tween,
} from "@/lib/vehicles/animate";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const STOPS_SOURCE = "stops";
const STOPS_LAYER = "stops-circles";

// Standard carries 3D buildings natively; `lightPreset` swaps day/night via
// config rather than a style reload, which would drop every layer.
const STYLE = "mapbox://styles/mapbox/standard";

function lightPresetFor(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? "night" : "day";
}

/**
 * Applies the theme to everything the map owns. Returns false when the style
 * is not ready yet, so the caller can retry.
 *
 * Every layer is guarded: `setPaintProperty` throws on a missing layer, and a
 * throw partway through used to leave the rest of the map on the old theme.
 */
function applyMapTheme(map: mapboxgl.Map, dark: boolean): boolean {
  if (!map.isStyleLoaded()) return false;

  map.setConfigProperty("basemap", "lightPreset", dark ? "night" : "day");

  if (map.getLayer(STOPS_LAYER)) {
    map.setPaintProperty(
      STOPS_LAYER,
      "circle-color",
      dark ? "#ffff01" : "#0040ff",
    );
    map.setPaintProperty(
      STOPS_LAYER,
      "circle-stroke-color",
      dark ? "#141a2e" : "#ffffff",
    );
  }

  setVehicleTheme(map, dark);
  return true;
}

function addStopsLayer(map: mapboxgl.Map, resolvedTheme: string | undefined) {
  if (map.getSource(STOPS_SOURCE)) return;

  map.addSource(STOPS_SOURCE, {
    type: "geojson",
    data: "/api/stops",
  });

  map.addLayer({
    id: STOPS_LAYER,
    type: "circle",
    source: STOPS_SOURCE,
    slot: "middle",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        1.2,
        13,
        2.5,
        16,
        5,
      ],
      "circle-color": resolvedTheme === "dark" ? "#ffff01" : "#0040ff",
      "circle-color-transition": { duration: 180 },
      "circle-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        0.35,
        14,
        0.85,
      ],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 13, 0, 16, 1],
      "circle-stroke-color": resolvedTheme === "dark" ? "#141a2e" : "#ffffff",
      "circle-stroke-color-transition": { duration: 180 },
      "circle-pitch-alignment": "map",
    },
  });
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { data, error: vehicleError } = useVehiclesContext();
  const tweens = useRef<Map<string, Tween>>(new Map());
  const popup = useRef<mapboxgl.Popup | null>(null);
  const selected = useRef<string | null>(null);

  // Read via ref so theme changes don't re-run init and tear the map down.
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
      attributionControl: false,
      config: {
        basemap: {
          theme: "faded",
          lightPreset: lightPresetFor(theme.current),
          show3dObjects: true,
          show3dTrees: false,
          // The basemap is context, not content. Everything that competes with
          // the vehicles or the chrome is off; place labels stay for orientation.
          showPointOfInterestLabels: false,
          showTransitLabels: false,
          showRoadLabels: false,
          showPlaceLabels: true,
          roadsBrightness: 0.22,
        },
      },
    });

    const addLayers = () => {
      addStopsLayer(instance, theme.current);
      addVehicleLayers(instance, theme.current === "dark");
      // The map can finish loading before next-themes has resolved, so the
      // layers are re-themed here rather than trusting their initial paint.
      applyMapTheme(instance, theme.current === "dark");
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

    bindVehicleSelection(instance, (id) => {
      selected.current = id;
      if (!id) popup.current?.remove();
    });
    instance.on("error", (event) => {
      setError(event.error?.message ?? "Mapbox failed to load.");
    });

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !resolvedTheme) return;
    const dark = resolvedTheme === "dark";

    // Poll rather than wait on a map event. `style.load` fires once, and
    // `idle` requires clean sources — which never happens here, because the
    // vehicle loop calls setData ~25x/s and keeps them permanently dirty. Both
    // can therefore never fire, leaving the map on the old theme.
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
    tweens.current = reconcile(
      tweens.current,
      data.vehicles,
      performance.now(),
      POLL_MS,
    );

    const id = selected.current;
    if (!id) return;
    const vehicle = data.vehicles.find((v) => v.id === id);
    // Gone from the snapshot means the trip ended, so there is nothing to follow.
    if (!vehicle) {
      popup.current?.remove();
      selected.current = null;
      return;
    }
    popup.current?.setHTML(describeVehicle(vehicle));
  }, [data]);

  // ~25 fps: rebuilding the GeoJSON is the cost, and the difference is
  // invisible at walking pace.
  useEffect(() => {
    if (!TOKEN) return;
    let frame = 0;
    let lastDraw = 0;
    const MIN_FRAME_MS = 40;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastDraw < MIN_FRAME_MS) return;
      lastDraw = now;

      const instance = map.current;
      if (!instance || !instance.getSource(VEHICLES_SOURCE)) return;
      if (!tweens.current.size) return;

      const source = instance.getSource(
        VEHICLES_SOURCE,
      ) as mapboxgl.GeoJSONSource;
      source.setData(toFeatureCollection(tweens.current, now));

      const id = selected.current;
      if (!id) return;
      const tween = tweens.current.get(id);
      if (!tween) return;
      const at = sample(tween, now);
      if (!popup.current?.isOpen()) {
        popup.current?.setHTML(describeVehicle(tween.vehicle)).addTo(instance);
      }
      popup.current?.setLngLat([at.lon, at.lat]);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

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
      {(error || vehicleError) && (
        <p className="absolute bottom-4 left-4 rounded-md bg-card px-3 py-2 text-sm text-destructive">
          {error ?? vehicleError}
        </p>
      )}
    </div>
  );
}
