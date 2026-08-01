import { mkdir, writeFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { readCsv } from "./csv.ts";
import {
  CACHE_DIR,
  DATA_DIR,
  GTFS_ZIP,
  WL_FILES,
  fetchCached,
  fetchCachedAny,
  oebbZips,
} from "./sources.ts";
import { extractEntries } from "./unzip.ts";
import { buildTrips, previousServiceDate, serviceDate } from "./trips.ts";
import { buildUndergroundRanges, fetchWays } from "./underground.ts";
import { buildExits } from "./exits.ts";
import { buildSbahn, type RailStop } from "./sbahn.ts";
import { fetchDistricts, tintDistricts } from "./districts.ts";
import { normaliseName, stripCity } from "../../lib/vehicles/names.ts";
import {
  classifyMatch,
  distanceMetres,
  gtfsGroupKey,
  isPlausiblyVienna,
  parseGtfsStopId,
  viennaGroupKeyForDiva,
  type MatchConfidence,
} from "./match.ts";

type GtfsStop = {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  platform: string;
};

type StopRecord = {
  stopId: number;
  diva: number;
  name: string;
  lat: number;
  lon: number;
  coordSource: "gtfs" | "wl";
  gtfsStopIds: string[];
  confidence: MatchConfidence | "unmatched";
};

// Wiener Linien's own classification of every line, collapsed to what a
// passenger distinguishes at a stop.
const MODE_BY_TRANSPORT: Record<string, StationMode> = {
  ptMetro: "metro",
  ptTrainS: "train",
  ptTram: "tram",
  ptTramWLB: "tram",
  ptBusCity: "bus",
  ptBusNight: "bus",
  ptRufBus: "bus",
};

// Ordered: a station is named after the biggest thing that calls at it.
const MODE_RANK: StationMode[] = ["metro", "train", "tram", "bus"];

type StationMode = "metro" | "train" | "tram" | "bus";

type StationRecord = {
  diva: number;
  name: string;
  lat: number;
  lon: number;
  stopIds: number[];
  gtfsStopIds: string[];
  modes: StationMode[];
  // ÖBB platform ids at this station, for the S-Bahn departures the Wiener
  // Linien monitor knows nothing about.
  railStopIds: string[];
};

async function download() {
  console.log("sources");
  const wl: Record<keyof typeof WL_FILES, string> = {} as never;
  for (const [name, url] of Object.entries(WL_FILES)) {
    wl[name as keyof typeof WL_FILES] = await fetchCached(url, `${name}.csv`);
  }
  const zip = await fetchCached(GTFS_ZIP, "wl-gtfs.zip");
  const oebb = await fetchCachedAny(oebbZips(), "oebb-gtfs.zip");
  return { wl, zip, oebb };
}

async function readGtfsStops(file: string) {
  const byGroup = new Map<string, GtfsStop[]>();
  let unparsable = 0;

  for await (const row of readCsv(file)) {
    const parsed = parseGtfsStopId(row.stop_id);
    if (!parsed) {
      unparsable++;
      continue;
    }

    const stop: GtfsStop = {
      stopId: row.stop_id,
      name: row.stop_name,
      lat: Number(row.stop_lat),
      lon: Number(row.stop_lon),
      platform: parsed.platform,
    };

    const key = gtfsGroupKey(parsed.region, parsed.number);
    const group = byGroup.get(key);
    if (group) group.push(stop);
    else byGroup.set(key, [stop]);
  }

  return { byGroup, unparsable };
}

function centroid(stops: GtfsStop[]): { lat: number; lon: number } {
  const usable = stops.filter((s) => isPlausiblyVienna(s));
  const sample = usable.length ? usable : stops;
  const lat = sample.reduce((sum, s) => sum + s.lat, 0) / sample.length;
  const lon = sample.reduce((sum, s) => sum + s.lon, 0) / sample.length;
  return { lat, lon };
}

type PendingStop = {
  stopId: number;
  diva: number;
  name: string;
  wlPoint: { lat: number; lon: number };
  group: GtfsStop[];
  gtfsPoint: { lat: number; lon: number };
  confidence: MatchConfidence;
};

function placeStop(
  member: PendingStop,
  suspect: { stopId: number; name: string }[],
): StopRecord {
  const usable = isPlausiblyVienna(member.wlPoint);
  if (!usable) suspect.push({ stopId: member.stopId, name: member.name });

  const point = usable ? member.wlPoint : member.gtfsPoint;

  return {
    stopId: member.stopId,
    diva: member.diva,
    name: member.name,
    lat: Number(point.lat.toFixed(6)),
    lon: Number(point.lon.toFixed(6)),
    coordSource: usable ? "wl" : "gtfs",
    gtfsStopIds: member.group.map((s) => s.stopId).sort(),
    confidence: member.confidence,
  };
}

// The map draws one dot per station, so a station needs a single point. The
// centroid of its platforms is not it — that lands in the block between them,
// off the tracks and inside buildings. Picking the platform closest to the
// centroid keeps the dot on a place a tram actually stops.
function stationPoint(platforms: { lat: number; lon: number }[]) {
  const centre = {
    lat: platforms.reduce((sum, p) => sum + p.lat, 0) / platforms.length,
    lon: platforms.reduce((sum, p) => sum + p.lon, 0) / platforms.length,
  };

  let pick = platforms[0];
  let metres = Infinity;
  for (const platform of platforms) {
    const away = distanceMetres(centre, platform);
    if (away < metres) {
      metres = away;
      pick = platform;
    }
  }
  return pick;
}

function buildStation(members: PendingStop[]): StationRecord {
  const modelled = members[0].group.filter(isPlausiblyVienna);
  const fallback = members
    .map((m) => m.wlPoint)
    .filter((p) => isPlausiblyVienna(p));

  const pool = modelled.length
    ? modelled
    : fallback.length
      ? fallback
      : [members[0].gtfsPoint];

  const point = stationPoint(pool);

  return {
    diva: members[0].diva,
    name: members[0].name,
    lat: Number(point.lat.toFixed(6)),
    lon: Number(point.lon.toFixed(6)),
    stopIds: members.map((m) => m.stopId).sort((a, b) => a - b),
    gtfsStopIds: members[0].group.map((s) => s.stopId).sort(),
    modes: [],
    railStopIds: [],
  };
}

type LineForModes = {
  transport: string;
  patterns: Record<string, { stopIds: number[] }>;
};

const RAIL_JOIN_METRES = 250;

function samePlace(station: string, rail: string): boolean {
  const a = normaliseName(station);
  const b = normaliseName(stripCity(rail));
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

function attachRail(stations: StationRecord[], rail: RailStop[]): number {
  let joined = 0;

  for (const station of stations) {
    const near = rail.filter(
      (stop) =>
        distanceMetres(station, stop) <= RAIL_JOIN_METRES &&
        samePlace(station.name, stop.name),
    );
    if (!near.length) continue;

    station.railStopIds = near.map((stop) => stop.id).sort();
    if (!station.modes.includes("train")) {
      station.modes = MODE_RANK.filter(
        (mode) => mode === "train" || station.modes.includes(mode),
      );
    }
    joined++;
  }

  return joined;
}

function attachModes(stations: StationRecord[], lines: LineForModes[]) {
  const atStop = new Map<number, Set<StationMode>>();

  for (const line of lines) {
    const mode = MODE_BY_TRANSPORT[line.transport];
    if (!mode) continue;
    for (const pattern of Object.values(line.patterns ?? {})) {
      for (const stopId of pattern.stopIds ?? []) {
        const found = atStop.get(stopId);
        if (found) found.add(mode);
        else atStop.set(stopId, new Set([mode]));
      }
    }
  }

  let unclassified = 0;
  for (const station of stations) {
    const modes = new Set<StationMode>();
    for (const stopId of station.stopIds) {
      for (const mode of atStop.get(stopId) ?? []) modes.add(mode);
    }

    // Wiener Linien lists the ten S-Bahn lines but not the stops they call at —
    // ÖBB runs them — so the only signal left is the name, where a standalone
    // "S" marks the interchange. The same trick is wrong for "U": stops like
    // "Oper, Karlsplatz U" are trams named after the station they sit outside,
    // and for those the line data already knows the truth.
    if (/(^|\s)S(\s|$)/.test(station.name)) modes.add("train");

    station.modes = MODE_RANK.filter((mode) => modes.has(mode));
    if (!station.modes.length) unclassified++;
  }

  return unclassified;
}

async function buildStopIndex(
  haltepunkte: string,
  gtfsStops: Map<string, GtfsStop[]>,
) {
  const pending: PendingStop[] = [];
  const rejected: { stopId: number; wl: string; gtfs: string }[] = [];
  const unmatched: { stopId: number; diva: number; name: string }[] = [];
  const suspectWlCoords: { stopId: number; name: string }[] = [];

  const placeholder = new Set<number>();
  const outsideVienna = new Set<number>();

  for await (const row of readCsv(haltepunkte, ";")) {
    const stopId = Number(row.StopID);
    const diva = Number(row.DIVA);
    const name = row.StopText.trim();
    const wlPoint = { lat: Number(row.Latitude), lon: Number(row.Longitude) };

    if (!row.DIVA || !Number(row.Longitude) || !Number(row.Latitude)) {
      placeholder.add(stopId);
      continue;
    }

    if (row.MunicipalityID !== "49000001") {
      outsideVienna.add(stopId);
      continue;
    }

    const group = gtfsStops.get(viennaGroupKeyForDiva(diva));
    if (!group?.length) {
      unmatched.push({ stopId, diva, name });
      continue;
    }

    const gtfsPoint = centroid(group);
    const verdict = classifyMatch(
      { name, ...wlPoint },
      { name: group[0].name, ...gtfsPoint },
    );

    if (verdict.confidence === "rejected") {
      rejected.push({ stopId, wl: name, gtfs: group[0].name });
      continue;
    }

    pending.push({
      stopId,
      diva,
      name,
      wlPoint,
      group,
      gtfsPoint,
      confidence: verdict.confidence,
    });
  }

  const stops = pending.map((member) => placeStop(member, suspectWlCoords));

  // A DIVA is one station; its StopIDs are the platforms within it. Which
  // platform a StopID occupies cannot be recovered — Wiener Linien's own
  // coordinates point at the wrong ones — so the map draws the station and the
  // board reads every platform at once.
  const byStation = new Map<number, PendingStop[]>();
  for (const stop of pending) {
    const members = byStation.get(stop.diva);
    if (members) members.push(stop);
    else byStation.set(stop.diva, [stop]);
  }

  const stations = [...byStation.values()]
    .map(buildStation)
    .sort((a, b) => a.diva - b.diva);

  return {
    stops,
    stations,
    rejected,
    unmatched,
    suspectWlCoords,
    placeholder,
    outsideVienna,
  };
}

async function buildLines(linien: string, fahrwege: string) {
  const lines = new Map<
    number,
    {
      lineId: number;
      name: string;
      transport: string;
      realtime: boolean;
      patterns: Record<string, { direction: string; stopIds: number[] }>;
    }
  >();

  for await (const row of readCsv(linien, ";")) {
    lines.set(Number(row.LineID), {
      lineId: Number(row.LineID),
      name: row.LineText,
      transport: row.MeansOfTransport,
      realtime: row.Realtime === "1",
      patterns: {},
    });
  }

  const sequences = new Map<string, { seq: number; stopId: number }[]>();
  const patternMeta = new Map<string, { lineId: number; direction: string }>();

  for await (const row of readCsv(fahrwege, ";")) {
    const key = `${row.LineID}:${row.PatternID}`;
    const entry = sequences.get(key);
    const point = { seq: Number(row.StopSeqCount), stopId: Number(row.StopID) };
    if (entry) entry.push(point);
    else {
      sequences.set(key, [point]);
      patternMeta.set(key, {
        lineId: Number(row.LineID),
        direction: row.Direction,
      });
    }
  }

  for (const [key, points] of sequences) {
    const meta = patternMeta.get(key)!;
    const line = lines.get(meta.lineId);
    if (!line) continue;
    points.sort((a, b) => a.seq - b.seq);
    line.patterns[key.split(":")[1]] = {
      direction: meta.direction,
      stopIds: points.map((p) => p.stopId),
    };
  }

  return [...lines.values()];
}

async function buildShapes(file: string) {
  const shapes = new Map<
    string,
    { seq: number; lon: number; lat: number; dist: number }[]
  >();

  for await (const row of readCsv(file)) {
    const point = {
      seq: Number(row.shape_pt_sequence),
      lon: Number(row.shape_pt_lon),
      lat: Number(row.shape_pt_lat),
      dist: Number(row.shape_dist_traveled),
    };
    const entry = shapes.get(row.shape_id);
    if (entry) entry.push(point);
    else shapes.set(row.shape_id, [point]);
  }

  const out: Record<string, { c: number[]; d: number[] }> = {};
  let points = 0;
  for (const [id, list] of shapes) {
    list.sort((a, b) => a.seq - b.seq);
    const c: number[] = [];
    const d: number[] = [];
    for (const p of list) {
      c.push(Number(p.lon.toFixed(6)), Number(p.lat.toFixed(6)));
      d.push(Number(p.dist.toFixed(1)));
    }
    out[id] = { c, d };
    points += list.length;
  }

  return { shapes: out, points };
}

async function writeArtifact(name: string, value: unknown) {
  const target = path.join(DATA_DIR, name);
  // Renamed into place so a run that dies midway leaves the old artifact, not a truncated one.
  const staging = `${target}.writing`;
  await writeFile(staging, JSON.stringify(value));
  await rename(staging, target);
  const { size } = await stat(target);
  console.log(`  ${name} (${(size / 1e6).toFixed(1)} MB)`);
}

async function main() {
  const { wl, zip, oebb } = await download();

  console.log("\nextracting gtfs");
  const gtfs = await extractEntries(
    zip,
    [
      "stops.txt",
      "routes.txt",
      "shapes.txt",
      "trips.txt",
      "stop_times.txt",
      "calendar.txt",
      "calendar_dates.txt",
    ],
    path.join(CACHE_DIR, "gtfs"),
  );
  console.log("  stops, routes, shapes, trips, stop_times, calendar");

  console.log("\njoining");
  const { byGroup, unparsable } = await readGtfsStops(gtfs["stops.txt"]);
  const result = await buildStopIndex(wl.haltepunkte, byGroup);
  const lines = await buildLines(wl.linien, wl.fahrwegverlaeufe);
  const unclassified = attachModes(result.stations, lines);
  const { shapes, points } = await buildShapes(gtfs["shapes.txt"]);

  const date = serviceDate();
  const previous = previousServiceDate(date);
  console.log(
    `\nschedule for ${date} (+ after-midnight runs from ${previous})`,
  );
  const schedule = await buildTrips(gtfs, date, previous);

  // The S-Bahn is ÖBB's and arrives with no realtime behind it, so these trips
  // carry no delay anchors and the map marks them timetable-only of its own
  // accord — the same treatment the unmeasured tram lines already get.
  console.log("\nS-Bahn (ÖBB)");
  const sbahn = await buildSbahn(oebb, date, previous);
  Object.assign(schedule.routes, sbahn.routes);
  Object.assign(schedule.trips, sbahn.trips);
  Object.assign(shapes, sbahn.shapes);
  for (const run of sbahn.runs) {
    const existing = schedule.runs.find((one) => one.date === run.date);
    if (existing) existing.tripIds.push(...run.tripIds);
    else schedule.runs.push(run);
  }
  const railStations = attachRail(result.stations, sbahn.stops);
  console.log(
    `  ${sbahn.lines.length} lines: ${sbahn.lines.join(", ")}\n` +
      `  ${sbahn.tripCount} trips, ${sbahn.shapePoints} shape points\n` +
      `  ${sbahn.stops.length} platforms joined to ${railStations} stations`,
  );

  const tripCount = Object.keys(schedule.trips).length;
  const shapeMissing = Object.values(schedule.trips).filter(
    (t) => !shapes[t.s],
  ).length;
  for (const run of schedule.runs) {
    console.log(`  ${run.date}: ${run.tripIds.length} trips`);
  }
  console.log(`  ${tripCount} total, ${shapeMissing} without shape geometry`);

  const matched = result.stops.length;
  const total = matched + result.unmatched.length + result.rejected.length;
  const byName = result.stops.filter((s) => s.confidence === "name").length;
  const reachable = new Set(result.stops.map((s) => s.stopId));
  const routedStops = new Set<number>();
  for (const line of lines) {
    for (const pattern of Object.values(line.patterns)) {
      for (const stopId of pattern.stopIds) routedStops.add(stopId);
    }
  }

  const locatable = [...routedStops].filter(
    (id) => !result.placeholder.has(id) && !result.outsideVienna.has(id),
  );
  const routedUnmatched = locatable.filter((id) => !reachable.has(id));

  await mkdir(DATA_DIR, { recursive: true });
  console.log("\nartifacts");
  await writeArtifact("stops.json", {
    generatedAt: new Date().toISOString(),
    stops: result.stops,
  });
  const districts = await fetchDistricts();
  const tints = tintDistricts(districts);
  await writeArtifact("districts.json", {
    generatedAt: new Date().toISOString(),
    type: "FeatureCollection",
    features: districts,
  });

  await writeArtifact("stations.json", {
    generatedAt: new Date().toISOString(),
    stations: result.stations,
  });
  await writeArtifact("lines.json", {
    generatedAt: new Date().toISOString(),
    lines,
  });
  await writeArtifact("shapes.json", shapes);
  console.log("\nunderground sections");
  const metroShapes = new Set<string>();
  for (const trip of Object.values(schedule.trips)) {
    if (schedule.routes[trip.r]?.type === 1) metroShapes.add(trip.s);
  }
  const ways = await fetchWays();
  const underground = buildUndergroundRanges(shapes, metroShapes, ways);
  console.log(`  osm subway ways ${ways.length}`);
  console.log(
    `  metro shapes ${metroShapes.size}, with tunnel ${underground.stats.shapes}`,
  );
  console.log(
    `  points matched ${underground.stats.pointsMatched}, unmatched ${underground.stats.pointsUnmatched}`,
  );
  console.log(
    `  tunnel ${underground.stats.undergroundKm} km of ${underground.stats.totalKm} km metro shape`,
  );

  await writeArtifact("underground.json", underground.ranges);

  console.log("\nstation exits");
  const exits = await buildExits();
  console.log(
    `  ${exits.stats.exits} named doors at ${exits.stats.stationsCovered} of ` +
      `${exits.stats.subwayStations} stations: ${exits.stats.free} step-free, ` +
      `${exits.stats.steps} with steps, ${exits.stats.limited} limited, ` +
      `${exits.stats.unknown} unrecorded\n` +
      `  ${exits.stats.unnamed} unnamed dropped`,
  );
  await writeArtifact("exits.json", {
    generatedAt: new Date().toISOString(),
    type: "FeatureCollection",
    features: exits.features,
  });

  await writeArtifact("schedule.json", {
    date,
    generatedAt: new Date().toISOString(),
    routes: schedule.routes,
    trips: schedule.trips,
    runs: schedule.runs,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    stops: {
      viennaStopIds: total,
      matched,
      matchedByName: byName,
      matchedByDistance: matched - byName,
      unmatched: result.unmatched.length,
      rejected: result.rejected.length,
      matchRate: Number(((matched / total) * 100).toFixed(1)),
      stations: result.stations.length,
    },
    coverage: {
      stopIdsUsedByLines: routedStops.size,
      locatable: locatable.length,
      routedPlaceholders: [...routedStops].filter((id) =>
        result.placeholder.has(id),
      ).length,
      routedOutsideVienna: [...routedStops].filter((id) =>
        result.outsideVienna.has(id),
      ).length,
      routedButUnmatched: routedUnmatched.length,
      routedMatchRate: Number(
        (
          ((locatable.length - routedUnmatched.length) / locatable.length) *
          100
        ).toFixed(1),
      ),
    },
    lines: {
      total: lines.length,
      realtime: lines.filter((l) => l.realtime).length,
      patterns: lines.reduce((n, l) => n + Object.keys(l.patterns).length, 0),
    },
    shapes: { total: Object.keys(shapes).length, points },
    underground: underground.stats,
    exits: exits.stats,
    schedule: {
      date,
      trips: tripCount,
      tripsWithoutShape: shapeMissing,
      tripsWithoutShapeId: schedule.skippedNoShape,
      routes: Object.keys(schedule.routes).length,
    },
    anomalies: {
      placeholderStopIds: result.placeholder.size,
      outsideViennaStopIds: result.outsideVienna.size,
      unparsableGtfsStopIds: unparsable,
      suspectWlCoordinates: result.suspectWlCoords,
      rejectedMatches: result.rejected,
    },
    unmatchedSample: result.unmatched.slice(0, 25),
  };
  await writeArtifact("ingest-report.json", report);

  console.log("\nstops");
  console.log(`  ${matched}/${total} matched (${report.stops.matchRate}%)`);
  console.log(`    by name     ${byName}`);
  console.log(`    by distance ${matched - byName}`);
  console.log(`    unmatched   ${result.unmatched.length}`);
  console.log(`    stations    ${result.stations.length}`);
  console.log(`    districts   ${districts.length} (${tints} tints)`);
  console.log(`    no mode     ${unclassified}`);
  console.log(`    rejected    ${result.rejected.length}`);
  console.log("\ncoverage of stops actually served by a line");
  console.log(
    `  ${locatable.length - routedUnmatched.length}/${locatable.length} locatable (${report.coverage.routedMatchRate}%)`,
  );
  console.log(
    `  excluded: ${report.coverage.routedPlaceholders} placeholders, ${report.coverage.routedOutsideVienna} outside Vienna`,
  );
  console.log("\nlines");
  console.log(`  ${lines.length} lines, ${report.lines.patterns} patterns`);
  console.log(
    `\nshapes\n  ${Object.keys(shapes).length} shapes, ${points} points`,
  );

  if (result.rejected.length) {
    console.log(
      "\nrejected matches (numeric join, contradicting name and position)",
    );
    for (const r of result.rejected.slice(0, 10)) {
      console.log(`  ${r.stopId}  wl="${r.wl}"  gtfs="${r.gtfs}"`);
    }
  }
  if (result.suspectWlCoords.length) {
    console.log("\ncorrupt Wiener Linien coordinates (GTFS used instead)");
    for (const s of result.suspectWlCoords)
      console.log(`  ${s.stopId}  ${s.name}`);
  }
}

await main();
