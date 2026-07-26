import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  DIMENSIONS,
  GLASS,
  ROOF,
  ROOF_THICKNESS,
  vehicleColour,
} from "./colors.ts";
import { sample, type Cull, type Tween } from "./animate.ts";

const METRES_PER_DEGREE = 111_320;

function footprint(
  lon: number,
  lat: number,
  bearing: number,
  length: number,
  width: number,
): Polygon {
  const rad = (bearing * Math.PI) / 180;
  const forwardX = Math.sin(rad);
  const forwardY = Math.cos(rad);
  const rightX = Math.cos(rad);
  const rightY = -Math.sin(rad);

  const halfLength = length / 2;
  const halfWidth = width / 2;
  const lonScale = METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180);

  const corner = (alongSign: number, acrossSign: number): [number, number] => {
    const east =
      forwardX * halfLength * alongSign + rightX * halfWidth * acrossSign;
    const north =
      forwardY * halfLength * alongSign + rightY * halfWidth * acrossSign;
    return [lon + east / lonScale, lat + north / METRES_PER_DEGREE];
  };

  const ring = [corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)];

  return { type: "Polygon", coordinates: [[...ring, ring[0]]] };
}

/** Certainty is carried in the fill alpha, since fill-extrusion opacity is not data-driven. */
const ALPHA: Record<string, number> = {
  measured: 1,
  interpolated: 0.78,
  scheduled: 0.5,
};

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function toExtrusionCollection(
  tweens: Map<string, Tween>,
  now: number,
  dark: boolean,
  cull?: Cull,
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];

  for (const tween of tweens.values()) {
    const { lon, lat, bearing } = sample(tween, now);
    if (
      cull &&
      (lon < cull.west ||
        lon > cull.east ||
        lat < cull.south ||
        lat > cull.north)
    ) {
      continue;
    }
    const { vehicle } = tween;
    const size = DIMENSIONS[vehicle.mode];
    const alpha = ALPHA[vehicle.certainty] ?? 0.5;

    features.push({
      type: "Feature",
      geometry: footprint(lon, lat, bearing, size.length, size.width),
      properties: {
        id: vehicle.id,
        line: vehicle.line,
        mode: vehicle.mode,
        towards: vehicle.towards,
        delay: vehicle.delay,
        certainty: vehicle.certainty,
        stopsFromReport: vehicle.stopsFromReport,
        // Band heights, so body, glazing and roof stack off one footprint.
        zero: 0,
        windowBase: size.windowBase,
        windowTop: size.windowTop,
        height: size.height,
        roofTop: size.height + ROOF_THICKNESS,
        color: withAlpha(
          vehicleColour(vehicle.mode, vehicle.line, dark),
          alpha,
        ),
        glass: withAlpha(dark ? GLASS.dark : GLASS.light, alpha),
        roof: withAlpha(dark ? ROOF.dark : ROOF.light, alpha),
      },
    });
  }

  return { type: "FeatureCollection", features };
}
