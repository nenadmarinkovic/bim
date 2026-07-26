import { vehiclesAt } from "@/lib/vehicles/feed";
import { MissingArtifactError } from "@/lib/vehicles/schedule";
import type { VehiclesResponse } from "@/lib/vehicles/types";

export async function GET() {
  const at = Date.now();

  try {
    const vehicles = await vehiclesAt(at);
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
