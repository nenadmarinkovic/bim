import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  compress,
  negotiate,
  type Encoding,
  type Packed,
} from "@/lib/http/compress";

const FILE = path.join(process.cwd(), "data", "exits.json");

type Entry = { stamp: number; body: string; packed: Map<Encoding, Packed> };

let cached: Entry | null = null;

async function load(): Promise<Entry | null> {
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
      packed: new Map(),
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

  const headers: Record<string, string> = {
    "content-type": "application/geo+json",
    etag,
    "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    vary: "accept-encoding",
  };

  const encoding = negotiate(request);
  if (!encoding) return new Response(found.body, { headers });

  let packed = found.packed.get(encoding);
  if (!packed) {
    packed = await compress(found.body, encoding, "best");
    found.packed.set(encoding, packed);
  }

  return new Response(packed, {
    headers: { ...headers, "content-encoding": encoding },
  });
}
