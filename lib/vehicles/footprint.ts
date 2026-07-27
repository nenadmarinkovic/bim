import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  DIMENSIONS,
  GLASS,
  ROOF,
  ROOF_THICKNESS,
  undergroundColour,
  vehicleColour,
} from "./colors.ts";
import { alongPath, sample, type Cull, type Tween } from "./animate.ts";

const METRES_PER_DEGREE = 111_320;

function sweptFootprint(
  path: number[],
  pd: number[],
  distance: number,
  length: number,
  width: number,
): Polygon | null {
  const tail = distance - length / 2;
  const nose = distance + length / 2;
  if (nose < pd[0] || tail > pd[pd.length - 1]) return null;

  const centres: { lon: number; lat: number }[] = [];
  const push = (at: number) => {
    const p = alongPath(path, pd, at);
    if (p) centres.push({ lon: p.lon, lat: p.lat });
  };

  push(tail);
  for (let i = 0; i < pd.length; i++) {
    if (pd[i] > tail && pd[i] < nose) {
      centres.push({ lon: path[i * 2], lat: path[i * 2 + 1] });
    }
  }
  push(nose);
  if (centres.length < 2) return null;

  const half = width / 2;
  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i < centres.length; i++) {
    const prev = centres[Math.max(0, i - 1)];
    const next = centres[Math.min(centres.length - 1, i + 1)];
    const lat = centres[i].lat;
    const scale = Math.cos((lat * Math.PI) / 180);

    let dx = (next.lon - prev.lon) * scale;
    let dy = next.lat - prev.lat;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    const offLon = (-dy * half) / (METRES_PER_DEGREE * scale);
    const offLat = (dx * half) / METRES_PER_DEGREE;

    left.push([centres[i].lon + offLon, centres[i].lat + offLat]);
    right.push([centres[i].lon - offLon, centres[i].lat - offLat]);
  }

  const ring = [...left, ...right.reverse()];
  return { type: "Polygon", coordinates: [[...ring, ring[0]]] };
}

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

export function toExtrusionCollection(
  tweens: Map<string, Tween>,
  now: number,
  dark: boolean,
  cull?: Cull,
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];

  for (const tween of tweens.values()) {
    const at = sample(tween, now);
    const { lon, lat, bearing } = at;
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
    const tint = (hex: string) =>
      vehicle.underground ? undergroundColour(hex, dark) : hex;

    const swept =
      vehicle.path && vehicle.pd && at.distance !== undefined
        ? sweptFootprint(
            vehicle.path,
            vehicle.pd,
            at.distance,
            size.length,
            size.width,
          )
        : null;

    features.push({
      type: "Feature",
      geometry: swept ?? footprint(lon, lat, bearing, size.length, size.width),
      properties: {
        id: vehicle.id,
        line: vehicle.line,
        mode: vehicle.mode,
        towards: vehicle.towards,
        delay: vehicle.delay,
        certainty: vehicle.certainty,
        stopsFromReport: vehicle.stopsFromReport,
        zero: 0,
        windowBase: size.windowBase,
        windowTop: size.windowTop,
        height: size.height,
        roofTop: size.height + ROOF_THICKNESS,
        color: tint(vehicleColour(vehicle.mode, vehicle.line, dark)),
        glass: tint(dark ? GLASS.dark : GLASS.light),
        roof: tint(dark ? ROOF.dark : ROOF.light),
      },
    });
  }

  return { type: "FeatureCollection", features };
}
