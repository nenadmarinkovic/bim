"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const VIENNA = { lng: 16.3725, lat: 48.2083 };
const STOPS_SOURCE = "stops";
const STOPS_LAYER = "stops-circles";

const STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

/**
 * Adds the stop layer. Mapbox drops all sources and layers whenever the base
 * style is swapped, so this runs on first load and again after every
 * theme-driven style change.
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
    },
  });
}

export function Map() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);

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
      style: theme.current === "dark" ? STYLES.dark : STYLES.light,
      center: [VIENNA.lng, VIENNA.lat],
      zoom: 11.5,
      minZoom: 9,
      maxZoom: 18,
      attributionControl: false,
    });

    instance.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    instance.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    instance.on("load", () => addStopsLayer(instance, theme.current));
    instance.on("style.load", () => addStopsLayer(instance, theme.current));
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
    const next = resolvedTheme === "dark" ? STYLES.dark : STYLES.light;
    map.current.setStyle(next);
  }, [resolvedTheme]);

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
      {error && (
        <p className="absolute bottom-4 left-4 rounded-md bg-card px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
