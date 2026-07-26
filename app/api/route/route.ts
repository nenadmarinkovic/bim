import { loadSchedule, MissingArtifactError } from "@/lib/vehicles/schedule";

/**
 * The path a single trip runs, as a coordinate list.
 *
 * The shape a trip references often extends past the trip itself — a short
 * working shares geometry with the full line — so it is trimmed to the
 * distance range the trip actually covers, using the same
 * `shape_dist_traveled` values that position the vehicle.
 */
export async function GET(request: Request) {
  const tripId = new URL(request.url).searchParams.get("trip");
  if (!tripId) {
    return Response.json({ error: "trip is required" }, { status: 400 });
  }

  try {
    const { schedule, shapes } = await loadSchedule();
    const trip = schedule.trips[tripId];
    if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

    const shape = shapes[trip.s];
    if (!shape) return Response.json({ error: "no geometry" }, { status: 404 });

    const from = trip.d[0];
    const to = trip.d[trip.d.length - 1];

    const line: [number, number][] = [];
    for (let i = 0; i < shape.d.length; i++) {
      if (shape.d[i] < from || shape.d[i] > to) continue;
      line.push([shape.c[i * 2], shape.c[i * 2 + 1]]);
    }
    if (line.length < 2) {
      return Response.json({ error: "no geometry" }, { status: 404 });
    }

    return Response.json(
      {
        tripId,
        line,
        start: line[0],
        end: line[line.length - 1],
        towards: trip.h,
      },
      { headers: { "cache-control": "public, max-age=3600" } },
    );
  } catch (error) {
    if (error instanceof MissingArtifactError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
