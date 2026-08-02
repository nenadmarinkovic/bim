// Stadt Wien publishes ~380 layers through one WFS endpoint. Every one of them
// answers to the same question shape, so the URL is built rather than pasted.
const ENDPOINT = "https://data.wien.gv.at/daten/geo";

// Five decimals is about a metre. The published geometry is surveyed to the
// centimetre, which is precision nobody can see and everybody downloads.
export const PRECISION = 5;

export const round = (value: number) => Number(value.toFixed(PRECISION));

export type WfsFeature<P> = {
  properties: P;
  geometry: { type: string; coordinates: unknown } | null;
};

export async function fetchWfs<P>(layer: string): Promise<WfsFeature<P>[]> {
  const query = new URLSearchParams({
    service: "WFS",
    request: "GetFeature",
    version: "1.1.0",
    typeName: `ogdwien:${layer}`,
    srsName: "EPSG:4326",
    outputFormat: "json",
  });

  const response = await fetch(`${ENDPOINT}?${query}`);
  if (!response.ok) throw new Error(`${layer} responded ${response.status}`);

  const source = (await response.json()) as { features: WfsFeature<P>[] };
  return source.features;
}

// A Viennese address is written "12., Meidlinger Hauptstraße". On a map the
// district is already the ground you are looking at.
export const withoutDistrict = (address: string) =>
  address.replace(/^\d+\.,\s*/, "").trim();
