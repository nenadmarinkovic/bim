import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR } from "./sources.ts";

// The main instance 504s when busy; tried in order.
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const BBOX = "47.97,16.15,48.33,16.60";

// Karlsplatz spans 365 m; anything tighter drops its Secession exit.
const RADIUS_METRES = 300;

// Four states, not a boolean: `limited` is a real answer, and untagged is not `no`.
export type ExitAccess = "free" | "steps" | "limited" | "unknown";

export type ExitFeature = {
  type: "Feature";
  properties: {
    station: string;
    // Often absent, and kept anyway: Hietzing's only step-free doors are unnamed.
    name?: string;
    access: ExitAccess;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
};

function accessOf(wheelchair: string | undefined): ExitAccess {
  switch (wheelchair) {
    case "yes":
      return "free";
    case "no":
      return "steps";
    case "limited":
      return "limited";
    default:
      return "unknown";
  }
}

type Element = {
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

type Station = { name: string; lon: number; lat: number };

const round = (value: number) => Number(value.toFixed(6));

function nearest(stations: Station[], point: { lon: number; lat: number }) {
  let pick: Station | null = null;
  let best = Infinity;
  for (const station of stations) {
    const scale = Math.cos((((point.lat + station.lat) / 2) * Math.PI) / 180);
    const away =
      Math.hypot((point.lon - station.lon) * scale, point.lat - station.lat) *
      111_320;
    if (away < best) {
      best = away;
      pick = station;
    }
  }
  return pick;
}

const QUERY = `[out:json][timeout:300];
node["station"="subway"](${BBOX})->.s;
.s out tags center;
node(around.s:${RADIUS_METRES})["railway"="subway_entrance"];
out tags center;`;

async function fetchElements(): Promise<Element[]> {
  const file = path.join(CACHE_DIR, "osm-exits.json");
  try {
    return JSON.parse(await readFile(file, "utf8")) as Element[];
  } catch {}

  let elements: Element[] | null = null;
  const failures: string[] = [];

  for (const endpoint of OVERPASS) {
    try {
      // Overpass answers 406 without a User-Agent identifying the caller.
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "bim-vienna-transit-map/0.1 (ingest)",
        },
        body: new URLSearchParams({ data: QUERY }),
      });
      if (!response.ok) {
        failures.push(`${endpoint} responded ${response.status}`);
        continue;
      }
      elements = ((await response.json()) as { elements: Element[] }).elements;
      break;
    } catch (cause) {
      failures.push(`${endpoint} failed: ${(cause as Error).message}`);
    }
  }

  if (!elements) {
    throw new Error(`every overpass mirror refused:\n  ${failures.join("\n  ")}`);
  }
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(elements));
  return elements;
}

export async function buildExits(): Promise<{
  features: ExitFeature[];
  stats: Record<string, number>;
}> {
  const elements = await fetchElements();

  const stations: Station[] = elements
    .filter((el) => el.tags?.station === "subway" && el.tags?.name)
    .map((el) => ({
      name: el.tags!.name!,
      lon: el.lon ?? 0,
      lat: el.lat ?? 0,
    }))
    .filter((s) => s.lon && s.lat);

  if (!stations.length) throw new Error("no station nodes came back");

  const features: ExitFeature[] = [];
  let unnamed = 0;

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (tags.railway !== "subway_entrance") continue;
    if (el.lon === undefined || el.lat === undefined) continue;

    if (!tags.name) unnamed++;

    const station = nearest(stations, { lon: el.lon, lat: el.lat });
    if (!station) continue;

    features.push({
      type: "Feature",
      properties: {
        station: station.name,
        ...(tags.name ? { name: tags.name } : {}),
        access: accessOf(tags.wheelchair),
      },
      geometry: {
        type: "Point",
        coordinates: [round(el.lon), round(el.lat)],
      },
    });
  }

  const stationsCovered = new Set(features.map((f) => f.properties.station));

  const byAccess = { free: 0, steps: 0, limited: 0, unknown: 0 };
  for (const feature of features) byAccess[feature.properties.access]++;

  return {
    features,
    stats: {
      exits: features.length,
      ...byAccess,
      stationsCovered: stationsCovered.size,
      subwayStations: stations.length,
      unnamed,
    },
  };
}
