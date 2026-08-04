import { readFile } from "node:fs/promises";
import path from "node:path";

export function geoJsonRoute(file: string, what: string) {
  let cached: string | null = null;

  return async function GET() {
    if (!cached) {
      try {
        const raw = await readFile(
          path.join(process.cwd(), "data", file),
          "utf8",
        );
        const { features } = JSON.parse(raw) as { features: unknown[] };
        cached = JSON.stringify({ type: "FeatureCollection", features });
      } catch {
        return Response.json(
          { error: `${what} not built — run \`npm run ingest\`` },
          { status: 503 },
        );
      }
    }

    return new Response(cached, {
      headers: {
        "content-type": "application/geo+json",
        "cache-control": "public, max-age=86400",
      },
    });
  };
}
