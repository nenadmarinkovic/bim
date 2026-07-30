import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "exits.json");

let cached: { stamp: number; body: string } | null = null;

async function load(): Promise<{ stamp: number; body: string } | null> {
  let stamp: number;
  try {
    stamp = (await stat(FILE)).mtimeMs;
  } catch {
    return null;
  }

  if (cached?.stamp === stamp) return cached;

  try {
    const raw = await readFile(FILE, "utf8");
    const { features } = JSON.parse(raw) as { features: unknown[] };
    cached = {
      stamp,
      body: JSON.stringify({ type: "FeatureCollection", features }),
    };
  } catch {
    return null;
  }

  return cached;
}

export async function GET(request: Request) {
  const found = await load();

  if (!found) {
    return Response.json(
      { error: "station exits not built — run `npm run ingest`" },
      { status: 503 },
    );
  }

  const etag = `W/"exits-${found.stamp}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return new Response(found.body, {
    headers: {
      "content-type": "application/geo+json",
      etag,
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
