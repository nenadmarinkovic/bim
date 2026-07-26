import { readFile } from "node:fs/promises";
import path from "node:path";

type StopRecord = {
  stopId: number;
  name: string;
  lat: number;
  lon: number;
};

type StopsFile = { generatedAt: string; stops: StopRecord[] };

let cached: string | null = null;

// Missing artifact is normal on a fresh checkout, not an error.
async function loadGeoJson(): Promise<string | null> {
  if (cached) return cached;

  let raw: string;
  try {
    raw = await readFile(path.join(process.cwd(), "data", "stops.json"), "utf8");
  } catch {
    return null;
  }

  const { stops } = JSON.parse(raw) as StopsFile;
  cached = JSON.stringify({
    type: "FeatureCollection",
    features: stops.map((stop) => ({
      type: "Feature",
      id: stop.stopId,
      geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
      properties: { stopId: stop.stopId, name: stop.name },
    })),
  });

  return cached;
}

export async function GET() {
  const geojson = await loadGeoJson();

  if (!geojson) {
    return Response.json(
      { error: "stop index not built — run `npm run ingest`" },
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
