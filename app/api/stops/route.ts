import { readFile } from "node:fs/promises";
import path from "node:path";

type StationRecord = {
  diva: number;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
};

type StationsFile = { generatedAt: string; stations: StationRecord[] };

let cached: string | null = null;

// Missing artifact is normal on a fresh checkout, not an error.
async function loadGeoJson(): Promise<string | null> {
  if (cached) return cached;

  let raw: string;
  try {
    raw = await readFile(
      path.join(process.cwd(), "data", "stations.json"),
      "utf8",
    );
  } catch {
    return null;
  }

  const { stations } = JSON.parse(raw) as StationsFile;
  cached = JSON.stringify({
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      id: station.diva,
      geometry: { type: "Point", coordinates: [station.lon, station.lat] },
      properties: {
        diva: station.diva,
        name: station.name,
        // Styling matches on one kind; the popup names them all.
        kind: station.modes[0] ?? "bus",
        // Never empty: the icon image is looked up by this exact string.
        modes: (station.modes.length ? station.modes : ["bus"]).join(","),
      },
    })),
  });

  return cached;
}

export async function GET() {
  const geojson = await loadGeoJson();

  if (!geojson) {
    return Response.json(
      { error: "station index not built — run `npm run ingest`" },
      { status: 503 },
    );
  }

  return new Response(geojson, {
    headers: {
      "content-type": "application/geo+json",
      "cache-control": "public, max-age=3600",
    },
  });
}
