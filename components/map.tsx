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
  setVehicleTheme,
} from "./vehicle-layer";
import { reconcile, toFeatureCollection, type Tween } from "@/lib/vehicles/animate";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const VIENNA = { lng: 16.3725, lat: 48.2083 };
const STOPS_SOURCE = "stops";
const STOPS_LAYER = "stops-circles";

/**
 * Mapbox Standard, which carries 3D buildings, trees and landmarks in the base
 * style rather than needing a separate fill-extrusion layer. Its `faded` theme
 * desaturates the basemap so the network drawn on top stays the loudest thing
 * on screen; `lightPreset` follows the app theme, which is a config change
 * rather than a style swap and so keeps every layer intact.
 */
const STYLE = "mapbox://styles/mapbox/standard";

const CAMERA = { zoom: 13, pitch: 55, bearing: -18 } as const;

function lightPresetFor(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? "night" : "day";
}

/**
 * Adds the stop layer. Swapping the base style drops all sources and layers, so
 * this stays idempotent and is re-run on `style.load` as well as first load.
 */
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
    // Standard exposes named slots; `middle` puts the dots above roads and
    // buildings but below labels, so street names stay readable.
    slot: "middle",
    paint: {
      // Stops stay pin-prick small when zoomed out so the network reads as
      // shape rather than noise, and only become clickable dots up close.
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

  // Hold the current theme in a ref so the init effect can read it without
  // listing it as a dependency and tearing the map down on every toggle. The
  // ref initialiser covers first mount; this effect keeps it current after.
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
      // The compass doubles as a pitch reset, which matters once the camera is
      // tilted and the user has rotated away from north.
      new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
      "bottom-right",
    );

    const addLayers = () => {
      addStopsLayer(instance, theme.current);
      addVehicleLayers(instance, theme.current === "dark");
    };
    instance.on("load", addLayers);
    instance.on("style.load", addLayers);
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

  // Fold each server snapshot into the running tweens. The vehicles keep their
  // currently drawn position as the start point, so a poll never teleports one.
  useEffect(() => {
    if (!data) return;
    tweens.current = reconcile(
      tweens.current,
      data.vehicles,
      performance.now(),
      POLL_MS,
    );
  }, [data]);

  // Redraw loop. Rebuilding the GeoJSON is the cost here, so it runs on a fixed
  // ~25 fps budget rather than every frame — the difference is invisible at
  // walking-pace movement and roughly halves the work at 60 Hz.
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
