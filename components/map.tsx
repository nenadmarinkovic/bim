"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { POLL_MS } from "./use-vehicles";
import { useVehiclesContext } from "./vehicles-provider";
import {
  VEHICLES_SOURCE,
  addVehicleLayers,
  bindVehiclePopup,
  setVehicleTheme,
} from "./vehicle-layer";
import { reconcile, toFeatureCollection, type Tween } from "@/lib/vehicles/animate";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const VIENNA = { lng: 16.3725, lat: 48.2083 };
const STOPS_SOURCE = "stops";
const STOPS_LAYER = "stops-circles";

// Standard carries 3D buildings natively; `lightPreset` swaps day/night via
// config rather than a style reload, which would drop every layer.
const STYLE = "mapbox://styles/mapbox/standard";

const CAMERA = { zoom: 13, pitch: 55, bearing: -18 } as const;

function lightPresetFor(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? "night" : "day";
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
      "circle-stroke-color": resolvedTheme === "dark" ? "#000000" : "#ffffff",
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
      center: [VIENNA.lng, VIENNA.lat],
      zoom: CAMERA.zoom,
      pitch: CAMERA.pitch,
      bearing: CAMERA.bearing,
      minZoom: 9,
      maxZoom: 18,
      maxPitch: 75,
      attributionControl: false,
      config: {
        basemap: {
          theme: "faded",
          lightPreset: lightPresetFor(theme.current),
          show3dObjects: true,
          showPointOfInterestLabels: false,
        },
      },
    });

    instance.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    instance.addControl(
      new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
      "bottom-right",
    );

    const addLayers = () => {
      addStopsLayer(instance, theme.current);
      addVehicleLayers(instance, theme.current === "dark");
    };
    instance.on("load", addLayers);
    instance.on("style.load", addLayers);

    const popup = new mapboxgl.Popup({
      closeButton: false,
      offset: 12,
      className: "bim-popup",
    });
    bindVehiclePopup(instance, popup);
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
    if (!map.current || !resolvedTheme) return;
    const instance = map.current;

    const apply = () => {
      instance.setConfigProperty(
        "basemap",
        "lightPreset",
        lightPresetFor(resolvedTheme),
      );
      instance.setPaintProperty(
        STOPS_LAYER,
        "circle-color",
        resolvedTheme === "dark" ? "#ffff01" : "#0040ff",
      );
      instance.setPaintProperty(
        STOPS_LAYER,
        "circle-stroke-color",
        resolvedTheme === "dark" ? "#000000" : "#ffffff",
      );
    };

    if (instance.isStyleLoaded()) apply();
    else instance.once("style.load", apply);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!map.current || !resolvedTheme) return;
    setVehicleTheme(map.current, resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    if (!data) return;
    tweens.current = reconcile(
      tweens.current,
      data.vehicles,
      performance.now(),
      POLL_MS,
    );
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
      {(error || vehicleError) && (
        <p className="absolute bottom-4 left-4 rounded-md bg-card px-3 py-2 text-sm text-destructive">
          {error ?? vehicleError}
        </p>
      )}
    </div>
  );
}
