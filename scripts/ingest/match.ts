/**
 * Wiener Linien DIVA ids for Vienna are `60200000 + n`, where `n` is the stop
 * number in the Austrian national id used by GTFS (`at:49:<n>:0:<platform>`).
 * Verified against the full stop list: of 1997 Vienna DIVAs, 1745 resolve and
 * 1679 of those agree on the stop name character for character.
 */
const DIVA_OFFSET = 60_200_000;
const GTFS_REGION = "49";

export function divaToGtfsNumber(diva: number): number {
  return diva - DIVA_OFFSET;
}

export function gtfsGroupKey(region: string, number: number): string {
  return `${region}:${number}`;
}

/** `at:49:1320:0:2` -> `{ region: "49", number: 1320, platform: "2" }` */
export function parseGtfsStopId(
  stopId: string,
): { region: string; number: number; platform: string } | null {
  const match = /^at:(\d+):(\d+):(\d+):(.+)$/.exec(stopId);
  if (!match) return null;
  return {
    region: match[1],
    number: Number(match[2]),
    platform: match[4],
  };
}

export function viennaGroupKeyForDiva(diva: number): string {
  return gtfsGroupKey(GTFS_REGION, divaToGtfsNumber(diva));
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bstr\b/g, "strasse"],
  [/\bg\b/g, "gasse"],
  [/\bpl\b/g, "platz"],
  [/\bbhf\b/g, "bahnhof"],
];

/**
 * Normalises a stop name for comparison. The two sources disagree cosmetically
 * a lot — "Bösendorfer Str., Karlsplatz" vs "Bösendorferstraße/Karlsplatz" —
 * so separators and abbreviations are folded away before comparing.
 */
export function normaliseName(name: string): string {
  let value = name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");

  value = value
    .replace(/[.,/()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of ABBREVIATIONS) {
    value = value.replace(pattern, replacement);
  }

  return value.replace(/[^a-z0-9]/g, "");
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceMetres(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat) / 2;
  const dLon = toRad(b.lon - a.lon) / 2;
  const h =
    Math.sin(dLat) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Vienna's bounding box, generously padded. Used to spot corrupt coordinates. */
export function isPlausiblyVienna(point: {
  lat: number;
  lon: number;
}): boolean {
  return (
    point.lat > 47.9 && point.lat < 48.4 && point.lon > 16.0 && point.lon < 16.7
  );
}

export type MatchConfidence = "name" | "distance" | "rejected";

export function classifyMatch(
  wl: { name: string; lat: number; lon: number },
  gtfs: { name: string; lat: number; lon: number },
  maxDistanceM = 250,
): { confidence: MatchConfidence; distanceM: number | null } {
  const nameMatches = normaliseName(wl.name) === normaliseName(gtfs.name);
  const comparable = isPlausiblyVienna(wl) && isPlausiblyVienna(gtfs);
  const distanceM = comparable ? distanceMetres(wl, gtfs) : null;

  if (nameMatches) return { confidence: "name", distanceM };
  if (distanceM !== null && distanceM <= maxDistanceM) {
    return { confidence: "distance", distanceM };
  }
  return { confidence: "rejected", distanceM };
}
