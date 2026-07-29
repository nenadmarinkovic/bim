import { readFile } from "node:fs/promises";
import path from "node:path";

let cached: string | null = null;

async function loadGeoJson(): Promise<string | null> {
  if (cached) return cached;

  try {
    const raw = await readFile(
      path.join(process.cwd(), "data", "districts.json"),
      "utf8",
    );
    const { features } = JSON.parse(raw) as { features: unknown[] };
    cached = JSON.stringify({ type: "FeatureCollection", features });
  } catch {
    return null;
  }

  return cached;
}

export async function GET() {
  const geojson = await loadGeoJson();

  if (!geojson) {
    return Response.json(
      { error: "district index not built — run `npm run ingest`" },
      { status: 503 },
    );
  }

  return new Response(geojson, {
    headers: {
      "content-type": "application/geo+json",
      "cache-control": "public, max-age=86400",
    },
  });
}
