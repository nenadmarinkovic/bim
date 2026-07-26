import type { FeatureCollection, Point } from "geojson";
import type mapboxgl from "mapbox-gl";

export const VEHICLES_SOURCE = "vehicles";
export const VEHICLES_LAYER = "vehicles-dots";
export const VEHICLES_LABEL_LAYER = "vehicles-labels";

/** Mode colours. Vienna's own line liveries would collide with the faded basemap. */
const COLOR_BY_MODE: mapboxgl.ExpressionSpecification = [
  "match",
  ["get", "mode"],
  "metro",
  "#e2231a",
  "tram",
  "#e2231a",
  "bus",
  "#1c74d4",
  "#888888",
];

const EMPTY: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Adds the vehicle layers. Idempotent, because swapping the base style drops
 * every source and layer and this has to be re-run on `style.load`.
 */
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
      "circle-color": COLOR_BY_MODE,
      // A vehicle running on timetable alone is drawn hollower, so the map
      // never implies more certainty than the data supports.
      "circle-opacity": ["case", ["get", "realtime"], 1, 0.45],
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.5,
        16,
        1.5,
      ],
      "circle-stroke-color": dark ? "#000000" : "#ffffff",
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
      "text-halo-color": dark ? "#000000" : "#ffffff",
      "text-halo-width": 1.2,
    },
  });
}

export function setVehicleTheme(map: mapboxgl.Map, dark: boolean) {
  if (!map.getLayer(VEHICLES_LAYER)) return;
  map.setPaintProperty(
    VEHICLES_LAYER,
    "circle-stroke-color",
    dark ? "#000000" : "#ffffff",
  );
  map.setPaintProperty(
    VEHICLES_LABEL_LAYER,
    "text-color",
    dark ? "#ffffff" : "#000000",
  );
  map.setPaintProperty(
    VEHICLES_LABEL_LAYER,
    "text-halo-color",
    dark ? "#000000" : "#ffffff",
  );
}
