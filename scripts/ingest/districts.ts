// Vienna's 23 Bezirke, from Stadt Wien's WFS. The published outline is drawn to
// the centimetre, which is a couple of megabytes of precision nobody can see on
// a screen — five decimals is about a metre, and that is already generous.
const WFS =
  "https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:4326&outputFormat=json";

const PRECISION = 5;

type Ring = [number, number][];

type Source = {
  features: {
    properties: { BEZNR: number; NAMEK: string; BEZ_RZ: string };
    geometry: { type: string; coordinates: unknown };
  }[];
};

export type District = {
  type: "Feature";
  properties: {
    number: number;
    name: string;
    roman: string;
    label: string;
    // Which of four tints to fill with. Neighbours never share one, so the
    // boundaries read even where the outline is faint.
    tint: number;
  };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

const TINTS = 4;

function ringPoints(coordinates: unknown, into: Set<string>) {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === "number") {
    into.add(`${coordinates[0]},${coordinates[1]}`);
    return;
  }
  for (const part of coordinates) ringPoints(part, into);
}

// Two districts touch where their outlines run together, which after rounding
// means shared vertices. One shared point is a corner; two is a border.
function adjacency(districts: District[]): Set<number>[] {
  const points = districts.map((district) => {
    const set = new Set<string>();
    ringPoints(district.geometry.coordinates, set);
    return set;
  });

  return districts.map((_, i) => {
    const neighbours = new Set<number>();
    for (let j = 0; j < districts.length; j++) {
      if (i === j) continue;
      let shared = 0;
      for (const point of points[i]!) {
        if (points[j]!.has(point) && ++shared === 2) break;
      }
      if (shared >= 2) neighbours.add(j);
    }
    return neighbours;
  });
}

// Welsh-Powell: colour the most-constrained districts first and each takes the
// lowest tint none of its neighbours has.
function assignTints(districts: District[]) {
  const neighbours = adjacency(districts);
  const tints = new Array<number>(districts.length).fill(-1);

  const order = districts
    .map((_, i) => i)
    .sort((a, b) => neighbours[b]!.size - neighbours[a]!.size);

  for (const i of order) {
    const taken = new Set<number>();
    for (const j of neighbours[i]!) if (tints[j]! >= 0) taken.add(tints[j]!);
    let tint = 0;
    while (taken.has(tint)) tint++;
    tints[i] = tint;
  }

  districts.forEach((district, i) => {
    district.properties.tint = tints[i]! % TINTS;
  });

  return Math.max(...tints) + 1;
}

const round = (value: number) => Number(value.toFixed(PRECISION));

// Consecutive points that land on the same rounded position add nothing but
// bytes once the coordinates have been trimmed.
function thin(ring: Ring): Ring {
  const out: Ring = [];
  for (const [lon, lat] of ring) {
    const point: [number, number] = [round(lon), round(lat)];
    const last = out[out.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    out.push(point);
  }
  // A ring has to close on itself.
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    out.push([first[0], first[1]]);
  }
  return out;
}

const thinPolygon = (rings: Ring[]) => rings.map(thin);

export async function fetchDistricts(): Promise<District[]> {
  const response = await fetch(WFS);
  if (!response.ok) throw new Error(`districts responded ${response.status}`);

  const source = (await response.json()) as Source;

  return source.features
    .map((feature) => {
      const { BEZNR, NAMEK, BEZ_RZ } = feature.properties;
      const geometry =
        feature.geometry.type === "MultiPolygon"
          ? {
              type: "MultiPolygon" as const,
              coordinates: (feature.geometry.coordinates as Ring[][]).map(
                thinPolygon,
              ),
            }
          : {
              type: "Polygon" as const,
              coordinates: thinPolygon(feature.geometry.coordinates as Ring[]),
            };

      return {
        type: "Feature" as const,
        properties: {
          number: BEZNR,
          name: NAMEK,
          roman: BEZ_RZ,
          // What a Viennese address actually says.
          label: `${BEZ_RZ}. ${NAMEK}`,
          tint: 0,
        },
        geometry,
      };
    })
    .sort((a, b) => a.properties.number - b.properties.number);
}

export function tintDistricts(districts: District[]): number {
  return assignTints(districts);
}
