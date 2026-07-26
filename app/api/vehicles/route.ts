import { vehiclesAt } from "@/lib/vehicles/feed";
import { MissingArtifactError } from "@/lib/vehicles/schedule";
import type { VehiclesResponse } from "@/lib/vehicles/types";

function parseViewport(url: URL) {
  const raw = url.searchParams.get("bbox");
  if (!raw) return undefined;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return undefined;
  }
  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

export async function GET(request: Request) {
  const at = Date.now();

  try {
    const vehicles = await vehiclesAt(at, parseViewport(new URL(request.url)));
    const body: VehiclesResponse = { at, vehicles };
    return Response.json(body, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof MissingArtifactError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
