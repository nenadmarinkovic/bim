import { readFile } from "node:fs/promises";
import path from "node:path";

import { staticBody } from "./http/compress.ts";

export function geoJsonRoute(file: string, what: string) {
  let cached: string | null = null;

  const send = staticBody({
    "content-type": "application/geo+json",
    "cache-control": "public, max-age=86400",
  });

  return async function GET(request: Request) {
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

    return send(request, cached);
  };
}
