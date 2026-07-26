import type { FeatureCollection, Point } from "geojson";
import type mapboxgl from "mapbox-gl";
import type { Vehicle } from "@/lib/vehicles/types";

export const VEHICLES_SOURCE = "vehicles";
export const VEHICLES_LAYER = "vehicles-dots";
export const VEHICLES_LABEL_LAYER = "vehicles-labels";

// Brighter in dark: the same red and blue that read well on the faded day
// basemap go muddy against the night one.
function colorByMode(dark: boolean): mapboxgl.ExpressionSpecification {
  return [
    "match",
    ["get", "mode"],
    "metro",
    dark ? "#ff5c50" : "#e2231a",
    "tram",
    dark ? "#ff5c50" : "#e2231a",
    "bus",
    dark ? "#5aa9ff" : "#1c74d4",
    dark ? "#9aa3bd" : "#888888",
  ];
}

const EMPTY: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

// Idempotent: a style swap drops every source, so this re-runs on style.load.
export function addVehicleLayers(map: mapboxgl.Map, dark: boolean) {
  if (map.getSource(VEHICLES_SOURCE)) return;

  map.addSource(VEHICLES_SOURCE, { type: "geojson", data: EMPTY });

  map.addLayer({
    id: VEHICLES_LAYER,
    type: "circle",
    source: VEHICLES_SOURCE,
    slot: "top",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        2.5,
        13,
        5,
        16,
        8,
      ],
      "circle-color": colorByMode(dark),
      "circle-color-transition": { duration: 180 },
      // Opacity carries confidence — see Certainty.
      "circle-opacity": [
        "match",
        ["get", "certainty"],
        "measured",
        1,
        "interpolated",
        0.7,
        0.4,
      ],
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.5,
        16,
        1.5,
      ],
      "circle-stroke-color": dark ? "#141a2e" : "#ffffff",
      "circle-stroke-color-transition": { duration: 180 },
    },
  });

  map.addLayer({
    id: VEHICLES_LABEL_LAYER,
    type: "symbol",
    source: VEHICLES_SOURCE,
    slot: "top",
    minzoom: 13.5,
    layout: {
      "text-field": ["get", "line"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 9, 16, 12],
      "text-offset": [0, -1.1],
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
    },
    paint: {
      "text-color": dark ? "#ffffff" : "#000000",
      "text-color-transition": { duration: 180 },
      "text-halo-color": dark ? "#141a2e" : "#ffffff",
      "text-halo-color-transition": { duration: 180 },
      "text-halo-width": 1.2,
    },
  });
}

const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

export function describeVehicle(vehicle: Vehicle): string {
  const { delay } = vehicle;
  const lateness =
    delay === 0
      ? "on time"
      : delay > 0
        ? `${Math.round(delay / 60) || "<1"} min late`
        : `${Math.round(-delay / 60) || "<1"} min early`;

  const basis =
    vehicle.certainty === "measured"
      ? "measured at this stop"
      : vehicle.certainty === "interpolated"
        ? `interpolated, ${vehicle.stopsFromReport} stop${vehicle.stopsFromReport === 1 ? "" : "s"} from a measured one`
        : "timetable only — no live data";

  return [
    `<strong>${escape(vehicle.line)}</strong> → ${escape(vehicle.towards)}`,
    `${lateness} · ${basis}`,
  ].join("<br/>");
}

export function bindVehicleSelection(
  map: mapboxgl.Map,
  onSelect: (id: string | null) => void,
) {
  map.on("click", VEHICLES_LAYER, (event) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") {
      // Stops the map-wide handler below from immediately clearing this.
      event.preventDefault();
      onSelect(id);
    }
  });

  map.on("click", (event) => {
    if (!event.defaultPrevented) onSelect(null);
  });

  map.on("mouseenter", VEHICLES_LAYER, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", VEHICLES_LAYER, () => {
    map.getCanvas().style.cursor = "";
  });
}

export function setVehicleTheme(map: mapboxgl.Map, dark: boolean) {
  if (map.getLayer(VEHICLES_LAYER)) {
    map.setPaintProperty(VEHICLES_LAYER, "circle-color", colorByMode(dark));
    map.setPaintProperty(
      VEHICLES_LAYER,
      "circle-stroke-color",
      dark ? "#141a2e" : "#ffffff",
    );
  }
  if (map.getLayer(VEHICLES_LABEL_LAYER)) {
    map.setPaintProperty(
      VEHICLES_LABEL_LAYER,
      "text-color",
      dark ? "#ffffff" : "#000000",
    );
    map.setPaintProperty(
      VEHICLES_LABEL_LAYER,
      "text-halo-color",
      dark ? "#141a2e" : "#ffffff",
    );
  }
}
