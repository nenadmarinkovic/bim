import { readCsv } from "./csv.ts";

export function parseGtfsTime(value: string): number {
  const [h, m, s] = value.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function serviceDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

export async function activeServices(
  calendar: string,
  calendarDates: string,
  date: string,
): Promise<Set<string>> {
  const dow = new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(4, 6)) - 1,
      Number(date.slice(6, 8)),
    ),
  ).getUTCDay();
  const dayColumn = DAY_NAMES[dow];

  const active = new Set<string>();
  for await (const row of readCsv(calendar)) {
    if (
      row[dayColumn] === "1" &&
      row.start_date <= date &&
      date <= row.end_date
    ) {
      active.add(row.service_id);
    }
  }

  for await (const row of readCsv(calendarDates)) {
    if (row.date !== date) continue;
    if (row.exception_type === "1") active.add(row.service_id);
    else if (row.exception_type === "2") active.delete(row.service_id);
  }

  return active;
}

export type TripRecord = {
  r: string;
  s: string;
  h: string;
  t: number[];
  d: number[];
  p: string[];
  w?: number[];
};

export type RouteRecord = { name: string; type: number };

export async function buildTrips(
  gtfs: Record<string, string>,
  date: string,
  previousDate: string,
): Promise<{
  routes: Record<string, RouteRecord>;
  trips: Record<string, TripRecord>;
  runs: { date: string; tripIds: string[] }[];
  skippedNoShape: number;
}> {
  const [services, previousServices] = await Promise.all([
    activeServices(gtfs["calendar.txt"], gtfs["calendar_dates.txt"], date),
    activeServices(
      gtfs["calendar.txt"],
      gtfs["calendar_dates.txt"],
      previousDate,
    ),
  ]);

  const routes: Record<string, RouteRecord> = {};
  for await (const row of readCsv(gtfs["routes.txt"])) {
    routes[row.route_id] = {
      name: row.route_short_name,
      type: Number(row.route_type),
    };
  }

  const trips: Record<string, TripRecord> = {};
  const today: string[] = [];

  const carryOver: string[] = [];
  let skippedNoShape = 0;

  for await (const row of readCsv(gtfs["trips.txt"])) {
    const runsToday = services.has(row.service_id);
    const ranYesterday = previousServices.has(row.service_id);
    if (!runsToday && !ranYesterday) continue;
    if (!row.shape_id) {
      skippedNoShape++;
      continue;
    }
    trips[row.trip_id] = {
      r: row.route_id,
      s: row.shape_id,
      h: row.trip_headsign,
      t: [],
      d: [],
      p: [],
    };
    if (runsToday) today.push(row.trip_id);
    if (ranYesterday) carryOver.push(row.trip_id);
  }

  const pending = new Map<
    string,
    { seq: number; t: number; d: number; p: string; w: number }[]
  >();
  for await (const row of readCsv(gtfs["stop_times.txt"])) {
    if (!trips[row.trip_id]) continue;
    const entry = pending.get(row.trip_id);
    const departure = parseGtfsTime(row.departure_time || row.arrival_time);
    const arrival = row.arrival_time
      ? parseGtfsTime(row.arrival_time)
      : departure;
    const point = {
      seq: Number(row.stop_sequence),
      t: departure,
      d: Number(row.shape_dist_traveled),
      p: row.stop_id,
      w: Math.max(0, departure - arrival),
    };
    if (entry) entry.push(point);
    else pending.set(row.trip_id, [point]);
  }

  for (const [tripId, points] of pending) {
    points.sort((a, b) => a.seq - b.seq);
    const trip = trips[tripId];
    trip.t = points.map((p) => p.t);
    trip.d = points.map((p) => Number(p.d.toFixed(1)));
    trip.p = points.map((p) => p.p);

    const waits: number[] = [];
    points.forEach((p, i) => {
      if (p.w > 0) waits.push(i, p.w);
    });
    if (waits.length) trip.w = waits;
  }

  for (const [tripId, trip] of Object.entries(trips)) {
    if (trip.t.length < 2) delete trips[tripId];
  }

  const DAY_SECONDS = 86_400;
  const afterMidnight = carryOver.filter((id) => {
    const trip = trips[id];
    return trip && trip.t[trip.t.length - 1] >= DAY_SECONDS;
  });

  const keep = new Set([...today, ...afterMidnight]);
  for (const tripId of Object.keys(trips)) {
    if (!keep.has(tripId)) delete trips[tripId];
  }

  return {
    routes,
    trips,
    runs: [
      { date, tripIds: today.filter((id) => trips[id]) },
      { date: previousDate, tripIds: afterMidnight },
    ],
    skippedNoShape,
  };
}

export function previousServiceDate(date: string): string {
  const d = new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(4, 6)) - 1,
      Number(date.slice(6, 8)),
    ),
  );
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
