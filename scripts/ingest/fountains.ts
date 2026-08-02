import { fetchWfs, round } from "./wfs.ts";

// Stadt Wien files every piece of public waterworks in one layer — ornamental
// basins, paddling fountains, the summer mist sprayers — and only some of it is
// water you can drink. Vienna's tap water comes off an alpine spring and the
// city is rightly proud of it, but a Zierbrunnen is scenery, so the ornamental
// ones are dropped rather than drawn as somewhere to fill a bottle.
const LAYER = "TRINKBRUNNENOGD";

const DRINKABLE = new Set([
  "Trinkbrunnen",
  "Trinkbrunnen mit Tränke",
  "Trinkhydrant",
  "Trinkhydrant mit Tränke",
  "Mobiler Trinkbrunnen mit Sprühnebelfunktion",
  "Hundetrinkbrunnen",
]);

type Source = { BASIS_TYP_TXT: string | null };

export type FountainFeature = {
  type: "Feature";
  properties: {
    kind: string;
    // "mit Tränke": a bowl at ground level, which on a hot day is the
    // difference between walking the dog and carrying it.
    trough: boolean;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
};

export async function fetchFountains(): Promise<{
  features: FountainFeature[];
  dropped: number;
}> {
  const features = await fetchWfs<Source>(LAYER);

  const kept: FountainFeature[] = [];
  let dropped = 0;

  for (const feature of features) {
    const kind = feature.properties.BASIS_TYP_TXT ?? "";
    if (!DRINKABLE.has(kind) || feature.geometry?.type !== "Point") {
      dropped++;
      continue;
    }

    const [lon, lat] = feature.geometry.coordinates as [number, number];
    kept.push({
      type: "Feature",
      properties: { kind, trough: kind.includes("Tränke") },
      geometry: { type: "Point", coordinates: [round(lon), round(lat)] },
    });
  }

  return { features: kept, dropped };
}
