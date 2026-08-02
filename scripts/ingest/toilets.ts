import { fetchWfs, round } from "./wfs.ts";

const LAYER = "WCANLAGE2OGD";

// B is step-free, U is everyone, M is a men-only pissoir. Anything else in the
// column is not a toilet the public can walk into.
const KINDS = new Set(["B", "U", "M"]);

const WINTER = "Wintersperre";

type Source = {
  AKTIV_TXT: string | null;
  ICON: string | null;
  EINSCHRAENKUNGEN: string | null;
};

export type ToiletFeature = {
  type: "Feature";
  properties: {
    winter: boolean;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
};

export async function fetchToilets(): Promise<{
  features: ToiletFeature[];
  dropped: number;
  winter: number;
}> {
  const features = await fetchWfs<Source>(LAYER);

  const kept: ToiletFeature[] = [];
  let dropped = 0;
  let winter = 0;

  for (const feature of features) {
    if (
      !KINDS.has(feature.properties.ICON ?? "") ||
      feature.properties.AKTIV_TXT !== "JA" ||
      feature.geometry?.type !== "Point"
    ) {
      dropped++;
      continue;
    }

    const closes = (feature.properties.EINSCHRAENKUNGEN ?? "").includes(WINTER);
    if (closes) winter++;

    const [lon, lat] = feature.geometry.coordinates as [number, number];
    kept.push({
      type: "Feature",
      properties: { winter: closes },
      geometry: { type: "Point", coordinates: [round(lon), round(lat)] },
    });
  }

  return { features: kept, dropped, winter };
}
