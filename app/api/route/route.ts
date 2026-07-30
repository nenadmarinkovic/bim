import {
  loadSchedule,
  loadStations,
  MissingArtifactError,
  type Schedule,
  type TripRecord,
} from "@/lib/vehicles/schedule";
import { normaliseName, stripCity } from "@/lib/vehicles/names";

let places: Promise<Map<string, string>> | null = null;

function stationNames(): Promise<Map<string, string>> {
  places ??= loadStations().then((stations) => {
    const byPlatform = new Map<string, string>();
    for (const station of stations) {
      for (const id of station.gtfsStopIds) byPlatform.set(id, station.name);
      for (const id of station.railStopIds) byPlatform.set(id, station.name);
    }
    return byPlatform;
  });
  return places;
}

const endsAt = (trip: TripRecord, named: Map<string, string>) =>
  named.get(trip.p[trip.p.length - 1] ?? "") ?? "";

function destinations(trip: TripRecord, named: Map<string, string>): string[] {
  const headsign = trip.h ?? "";
  return [endsAt(trip, named), headsign, stripCity(headsign)].map(
    normaliseName,
  );
}

const MIN_LOOSE = 6;

const loose = (a: string, b: string) =>
  a.length >= MIN_LOOSE &&
  b.length >= MIN_LOOSE &&
  (a.includes(b) || b.includes(a));

function pickTrip(
  schedule: Schedule,
  line: string,
  towards: string,
  serving: Set<string>,
  named: Map<string, string>,
): [string, TripRecord] | null {
  const wantedLine = normaliseName(line);
  const wantedEnd = normaliseName(towards);

  let exact: [string, TripRecord] | null = null;
  let near: [string, TripRecord] | null = null;

  for (const [tripId, trip] of Object.entries(schedule.trips)) {
    if (normaliseName(schedule.routes[trip.r]?.name ?? "") !== wantedLine) {
      continue;
    }
    if (serving.size && !trip.p.some((stop) => serving.has(stop))) continue;

    const ends = destinations(trip, named);
    if (ends.includes(wantedEnd)) {
      if (!exact || trip.p.length > exact[1].p.length) exact = [tripId, trip];
    } else if (ends.some((end) => loose(end, wantedEnd))) {
      if (!near || trip.p.length > near[1].p.length) near = [tripId, trip];
    }
  }

  return exact ?? near;
}

function geometry(
  trip: TripRecord,
  shapes: Record<string, { c: number[]; d: number[] }>,
) {
  const shape = shapes[trip.s];
  if (!shape) return null;

  const from = trip.d[0];
  const to = trip.d[trip.d.length - 1];

  const line: [number, number][] = [];
  for (let i = 0; i < shape.d.length; i++) {
    if (shape.d[i] < from || shape.d[i] > to) continue;
    line.push([shape.c[i * 2], shape.c[i * 2 + 1]]);
  }
  return line.length < 2 ? null : line;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tripId = params.get("trip");
  const line = params.get("line");
  const towards = params.get("towards");

  if (!tripId && !(line && towards)) {
    return Response.json(
      { error: "trip, or line and towards, is required" },
      { status: 400 },
    );
  }

  try {
    const { schedule, shapes } = await loadSchedule();

    const named = await stationNames();

    let found: [string, TripRecord] | null = null;

    if (tripId) {
      const trip = schedule.trips[tripId];
      if (trip) found = [tripId, trip];
    } else {
      const from = Number(params.get("from"));
      const serving = new Set<string>();
      if (Number.isInteger(from) && from > 0) {
        const station = (await loadStations()).find((s) => s.diva === from);
        for (const id of station?.gtfsStopIds ?? []) serving.add(id);
        for (const id of station?.railStopIds ?? []) serving.add(id);
      }
      found = pickTrip(schedule, line!, towards!, serving, named);
    }

    if (!found)
      return Response.json({ error: "unknown trip" }, { status: 404 });

    const [id, trip] = found;
    const shape = geometry(trip, shapes);
    if (!shape) return Response.json({ error: "no geometry" }, { status: 404 });

    return Response.json(
      {
        tripId: id,
        line: shape,
        start: shape[0],
        end: shape[shape.length - 1],
        origin: named.get(trip.p[0] ?? "") ?? "",
        towards: endsAt(trip, named) || stripCity(trip.h ?? ""),
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
