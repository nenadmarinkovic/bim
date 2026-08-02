import { fetchWfs, round, withoutDistrict } from "./wfs.ts";

// Vienna's pedestrian zones, from Stadt Wien's WFS. Most are not absolute: the
// Zeitraum says when the zone is in force, and outside it the street is a
// street again. That text is kept as published — it is the legal wording, and
// the exceptions on it are Viennese enough to be worth reading in full.
const LAYER = "FUSSGEHERZONEOGD";

type Source = {
  ADRESSE: string;
  ZEITRAUM: string | null;
  AUSN_TEXT: string | null;
};

export type ZoneFeature = {
  type: "Feature";
  properties: {
    name: string;
    // Absent where the zone holds around the clock.
    hours?: string;
    exceptions?: string;
  };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

type Ring = [number, number][];

function thin(ring: Ring): Ring {
  const out: Ring = [];
  for (const [lon, lat] of ring) {
    const point: [number, number] = [round(lon), round(lat)];
    const last = out[out.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    out.push(point);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    out.push([first[0], first[1]]);
  }
  return out;
}

const thinPolygon = (rings: Ring[]) => rings.map(thin);

// "(werkt.) von 6-10.30h" is the common case and reads as a restriction; a zone
// that holds always says so in a dozen different ways, none worth repeating.
const ALWAYS = /^\s*(st(ä|ae)ndig|immer|dauernd|0-24|durchgehend)\s*$/i;

const clean = (value: string | null): string | undefined => {
  const text = value?.trim();
  return text && !ALWAYS.test(text) ? text : undefined;
};

export async function fetchPedestrianZones(): Promise<ZoneFeature[]> {
  const features = await fetchWfs<Source>(LAYER);

  return features
    .filter((feature) => feature.geometry)
    .map((feature) => {
      const geometry = feature.geometry!;
      const coordinates =
        geometry.type === "MultiPolygon"
          ? (geometry.coordinates as Ring[][]).map(thinPolygon)
          : thinPolygon(geometry.coordinates as Ring[]);

      return {
        type: "Feature" as const,
        properties: {
          // Two of the 298 name a house-number range as well. On a polygon that
          // is already sitting on the block in question, the street is enough.
          name: withoutDistrict(feature.properties.ADRESSE ?? "").replace(
            /\s*ON\.\s.*$/,
            "",
          ),
          hours: clean(feature.properties.ZEITRAUM),
          exceptions: clean(feature.properties.AUSN_TEXT),
        },
        geometry: {
          type: geometry.type as "Polygon" | "MultiPolygon",
          coordinates,
        },
      };
    })
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, "de"));
}
