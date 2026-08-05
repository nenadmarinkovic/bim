const ENDPOINT = "https://data.wien.gv.at/daten/geo";

const LAYERS = ["BAUSTELLENLINOGD", "BAUSTELLENPKTOGD"] as const;

const TTL_MS = 30 * 60 * 1000;

const PRECISION = 5;

type Source = {
  BEZEICHNUNG: string | null;
  BEHINDERUNGSART: string | null;
  PRESSETEXT: string | null;
  OBJEKT_BEGINN: string | null;
  OBJEKT_ENDE: string | null;
  ANTRAGSTELLER: string | null;
};

type SourceFeature = {
  properties: Source;
  geometry: { type: string; coordinates: unknown } | null;
};

export type Roadwork = {
  type: "Feature";
  properties: {
    where: string;
    kind: string;
    label: string;
    until: string | null;
    detail: string | null;
    transit: boolean;
  };
  geometry: { type: string; coordinates: unknown };
};

const round = (value: number): number => Number(value.toFixed(PRECISION));

function roundCoordinates(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] === "number") {
    return [round(value[0] as number), round(value[1] as number)];
  }
  return value.map(roundCoordinates);
}

function parseDay(value: string | null): number | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const shortDay = (at: number, now: number) => {
  const day = new Date(at);
  const stamp = `${day.getUTCDate()}.${day.getUTCMonth() + 1}.`;
  const year = day.getUTCFullYear();
  return year === new Date(now).getUTCFullYear() ? stamp : `${stamp}${year}`;
};

const TRANSIT = /wiener linien|gleisbau|schienen/i;

async function fetchLayer(layer: string): Promise<SourceFeature[]> {
  const query = new URLSearchParams({
    service: "WFS",
    request: "GetFeature",
    version: "1.1.0",
    typeName: `ogdwien:${layer}`,
    srsName: "EPSG:4326",
    outputFormat: "json",
  });

  const response = await fetch(`${ENDPOINT}?${query}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${layer} responded ${response.status}`);

  const body = (await response.json()) as { features: SourceFeature[] };
  return body.features ?? [];
}

function convert(feature: SourceFeature, now: number): Roadwork | null {
  if (!feature.geometry) return null;

  const { BEZEICHNUNG, BEHINDERUNGSART, PRESSETEXT, ANTRAGSTELLER } =
    feature.properties;

  const from = parseDay(feature.properties.OBJEKT_BEGINN);
  const until = parseDay(feature.properties.OBJEKT_ENDE);

  if (until !== null && until + 86_400_000 <= now) return null;
  if (from !== null && from > now + 86_400_000) return null;

  const kind = BEHINDERUNGSART?.trim() || "Baustelle";

  return {
    type: "Feature",
    properties: {
      where: BEZEICHNUNG?.trim() ?? "",
      kind,
      label: until === null ? kind : `${kind} → ${shortDay(until, now)}`,
      until: feature.properties.OBJEKT_ENDE?.slice(0, 10) ?? null,
      detail:
        PRESSETEXT?.replace(/([a-zäöüß])([A-ZÄÖÜ])/g, "$1 $2").trim() ?? null,
      transit: TRANSIT.test(`${ANTRAGSTELLER ?? ""} ${kind}`),
    },
    geometry: {
      type: feature.geometry.type,
      coordinates: roundCoordinates(feature.geometry.coordinates),
    },
  };
}

let cached: { at: number; body: string } | null = null;
let inFlight: Promise<string> | null = null;

async function build(now: number): Promise<string> {
  const batches = await Promise.all(LAYERS.map(fetchLayer));

  const features = batches
    .flat()
    .map((feature) => convert(feature, now))
    .filter((feature): feature is Roadwork => feature !== null)

    .sort(
      (a, b) =>
        Number(a.geometry.type === "Point") -
        Number(b.geometry.type === "Point"),
    );

  return JSON.stringify({ type: "FeatureCollection", features });
}

export async function roadworks(now = Date.now()): Promise<string> {
  if (cached && now - cached.at < TTL_MS) return cached.body;

  inFlight ??= build(now)
    .then((body) => {
      cached = { at: now, body };
      return body;
    })
    .catch((error) => {
      if (cached) return cached.body;
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
