import type { FeatureCollection, LineString, Point } from "geojson";
import type mapboxgl from "mapbox-gl";

export const ROUTE_SOURCE = "vehicle-route";
export const ROUTE_LINE_LAYER = "vehicle-route-line";
export const ROUTE_ENDS_SOURCE = "vehicle-route-ends";
export const ROUTE_ENDS_LAYER = "vehicle-route-ends";
export const ROUTE_ENDS_LABEL_LAYER = "vehicle-route-ends-label";

const EMPTY_LINE: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};
const EMPTY_POINTS: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

export type TripRoute = {
  tripId: string;
  line: [number, number][];
  start: [number, number];
  end: [number, number];
  origin: string;
  towards: string;
};

export function addRouteLayers(map: mapboxgl.Map) {
  if (map.getSource(ROUTE_SOURCE)) return;

  map.addSource(ROUTE_SOURCE, { type: "geojson", data: EMPTY_LINE });
  map.addSource(ROUTE_ENDS_SOURCE, { type: "geojson", data: EMPTY_POINTS });

  map.addLayer({
    id: ROUTE_LINE_LAYER,
    type: "line",
    source: ROUTE_SOURCE,
    slot: "middle",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 16, 6],
      "line-opacity": 0.9,
    },
  });

  map.addLayer({
    id: ROUTE_ENDS_LAYER,
    type: "circle",
    source: ROUTE_ENDS_SOURCE,
    slot: "top",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 7],
      "circle-color": ["get", "fill"],
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-width": 2.5,
    },
  });

  map.addLayer({
    id: ROUTE_ENDS_LABEL_LAYER,
    type: "symbol",
    source: ROUTE_ENDS_SOURCE,
    slot: "top",
    minzoom: 11,
    layout: {
      "text-field": ["get", "label"],
      "text-size": 11,
      "text-offset": [0, -1.4],
      "text-font": ["DIN Pro Bold", "Arial Unicode MS Regular"],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": ["get", "color"],
      "text-halo-width": 0,
    },
  });
}

export function showRoute(
  map: mapboxgl.Map,
  route: TripRoute,
  color: string,
  endFill: string,
) {
  const line = map.getSource(ROUTE_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  const ends = map.getSource(ROUTE_ENDS_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  if (!line || !ends) return;

  line.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: route.line },
        properties: { color },
      },
    ],
  });

  ends.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: route.start },
        // Naming the far end but not this one leaves half the line a mystery.
        properties: { color, fill: endFill, label: route.origin || "Start" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: route.end },
        properties: { color, fill: endFill, label: route.towards },
      },
    ],
  });
}

export function clearRoute(map: mapboxgl.Map) {
  const line = map.getSource(ROUTE_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  const ends = map.getSource(ROUTE_ENDS_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  line?.setData(EMPTY_LINE);
  ends?.setData(EMPTY_POINTS);
}
