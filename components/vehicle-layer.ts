import type { FeatureCollection, Point, Polygon } from "geojson";
import type mapboxgl from "mapbox-gl";
import type { Vehicle } from "@/lib/vehicles/types";
import {
  METRO_COLOR,
  SPRITES,
  SPRITE_PIXEL_RATIO,
  makeVehicleSprite,
  spriteId,
} from "./vehicle-sprites";

export const VEHICLES_SOURCE = "vehicles";
export const VEHICLES_LAYER = "vehicles-dots";
export const VEHICLES_LABEL_LAYER = "vehicles-labels";
export const VEHICLES_3D_SOURCE = "vehicles-3d";
export const VEHICLES_3D_LAYER = "vehicles-body";
export const VEHICLES_ROOF_LAYER = "vehicles-roof";
export const VEHICLES_GLASS_LAYER = "vehicles-glass";
export const VEHICLES_UPPER_LAYER = "vehicles-upper";
export const VEHICLE_3D_LAYERS = [
  VEHICLES_3D_LAYER,
  VEHICLES_GLASS_LAYER,
  VEHICLES_UPPER_LAYER,
  VEHICLES_ROOF_LAYER,
];

export const SPRITE_TO_3D_ZOOM = 14;

const EMPTY: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_POLYGONS: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

export function addVehicleLayers(map: mapboxgl.Map, dark: boolean) {
  if (map.getSource(VEHICLES_SOURCE)) return;

  map.addSource(VEHICLES_SOURCE, { type: "geojson", data: EMPTY });

  registerSprites(map, dark);

  map.addSource(VEHICLES_3D_SOURCE, { type: "geojson", data: EMPTY_POLYGONS });

  const band = (
    id: string,
    base: string,
    height: string,
    colour: string,
  ): mapboxgl.LayerSpecification => ({
    id,
    type: "fill-extrusion",
    source: VEHICLES_3D_SOURCE,
    slot: "middle",
    minzoom: SPRITE_TO_3D_ZOOM,
    paint: {
      "fill-extrusion-color": ["get", colour],
      "fill-extrusion-base": ["get", base],
      "fill-extrusion-height": ["get", height],
      "fill-extrusion-vertical-gradient": false,
      "fill-extrusion-emissive-strength": dark ? 0.85 : 0.25,
      "fill-extrusion-opacity": 0,
      "fill-extrusion-opacity-transition": { duration: 450 },
    },
  });

  map.addLayer(band(VEHICLES_3D_LAYER, "zero", "windowBase", "color"));
  map.addLayer(band(VEHICLES_GLASS_LAYER, "windowBase", "windowTop", "glass"));
  map.addLayer(band(VEHICLES_UPPER_LAYER, "windowTop", "height", "color"));
  map.addLayer(band(VEHICLES_ROOF_LAYER, "height", "roofTop", "roof"));

  map.addLayer({
    id: VEHICLES_LAYER,
    type: "symbol",
    source: VEHICLES_SOURCE,
    slot: "top",
    maxzoom: SPRITE_TO_3D_ZOOM,
    layout: {
      "icon-image": [
        "match",
        ["get", "mode"],
        "metro",
        [
          "match",
          ["get", "line"],
          ...Object.keys(METRO_COLOR).flatMap((line) => [
            line,
            `vehicle-${line}`,
          ]),
          "vehicle-metro",
        ],
        "tram",
        "vehicle-tram",
        "vehicle-bus",
      ] as unknown as mapboxgl.ExpressionSpecification,
      "icon-rotate": ["get", "bearing"],
      "icon-rotation-alignment": "map",
      "icon-pitch-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.3,
        14,
        0.6,
        17,
        1,
      ],
    },
    paint: {},
  });

  map.addLayer({
    id: VEHICLES_LABEL_LAYER,
    type: "symbol",
    source: VEHICLES_SOURCE,
    slot: "top",
    minzoom: 12.5,
    layout: {
      "text-field": ["get", "line"],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        12.5,
        10,
        15,
        13,
        18,
        16,
      ],
      "text-offset": [0, -1.1],
      "text-letter-spacing": 0.04,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      "text-font": ["DIN Pro Bold", "Arial Unicode MS Regular"],
    },
    paint: {
      "text-color": ["get", "color"],
      "text-halo-width": 0,
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
  map.on("click", [VEHICLES_LAYER, ...VEHICLE_3D_LAYERS], (event) => {
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

  map.on("mouseenter", [VEHICLES_LAYER, ...VEHICLE_3D_LAYERS], () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", [VEHICLES_LAYER, ...VEHICLE_3D_LAYERS], () => {
    map.getCanvas().style.cursor = "";
  });
}

function registerSprites(map: mapboxgl.Map, dark: boolean) {
  for (const { mode, line } of SPRITES) {
    const sprite = makeVehicleSprite(mode, line, dark);
    if (!sprite) continue;
    const id = spriteId(mode, line);
    if (map.hasImage(id)) map.updateImage(id, sprite);
    else map.addImage(id, sprite, { pixelRatio: SPRITE_PIXEL_RATIO });
  }
}

export function revealVehicles(map: mapboxgl.Map) {
  for (const id of VEHICLE_3D_LAYERS) {
    if (map.getLayer(id)) map.setPaintProperty(id, "fill-extrusion-opacity", 1);
  }
}

export function setVehicleTheme(map: mapboxgl.Map, dark: boolean) {
  registerSprites(map, dark);

  for (const id of VEHICLE_3D_LAYERS) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(
      id,
      "fill-extrusion-emissive-strength",
      dark ? 0.85 : 0.25,
    );
  }
}
