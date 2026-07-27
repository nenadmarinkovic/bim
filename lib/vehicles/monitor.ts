import { loadSchedule, loadStops } from "./schedule.ts";

const MONITOR = "https://www.wienerlinien.at/ogd_realtime/monitor";

const BATCH = 200;

const REQUEST_GAP_MS = 1_500;

const MAX_REQUESTS_PER_SWEEP = 6;

const DAY_SECONDS = 86_400;

const MATCH_TOLERANCE_S = 90;

export type Anchor = { index: number; delay: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Candidate = {
  tripId: string;
  idx: number;
  line: string;
  secs: number;
  towards: string;
};

function normaliseTowards(value: string): string {
  return value
    .toLowerCase()
    .replace(/^wien\s+/, "")
    .replace(/[^a-z0-9äöüß]/g, "");
}

let index: Map<string, Candidate[]> | null = null;

async function stopTimeIndex(): Promise<Map<string, Candidate[]>> {
  if (index) return index;

  const { schedule } = await loadSchedule();
  const built = new Map<string, Candidate[]>();

  for (const [tripId, trip] of Object.entries(schedule.trips)) {
    const line = schedule.routes[trip.r]?.name;
    if (!line) continue;
    for (let i = 0; i < trip.p.length; i++) {
      const key = trip.p[i];
      const list = built.get(key);
      const entry = {
        tripId,
        idx: i,
        line,
        secs: trip.t[i],
        towards: normaliseTowards(trip.h ?? ""),
      };
      if (list) list.push(entry);
      else built.set(key, [entry]);
    }
  }

  index = built;
  return built;
}

function secondsOfDay(iso: string): number | null {
  const m = /T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

type Monitor = {
  locationStop?: { properties?: { attributes?: { rbl?: number } } };
  lines?: {
    name?: string;
    towards?: string;
    departures?: {
      departure?: {
        departureTime?: {
          timePlanned?: string;
          timeReal?: string;
        };
      }[];
    };
  }[];
};

async function fetchBatch(stopIds: number[]): Promise<Monitor[]> {
  const query = stopIds.map((id) => `stopId=${id}`).join("&");
  const response = await fetch(`${MONITOR}?${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`monitor responded ${response.status}`);
  const body = (await response.json()) as { data?: { monitors?: Monitor[] } };
  return body.data?.monitors ?? [];
}

function matchCandidate(
  candidates: Candidate[],
  line: string,
  plannedSecs: number,
  towards: string,
): Candidate | null {
  let best: Candidate | null = null;
  let bestDiff = Infinity;

  // Both platforms carry the same line at similar times; the headsign picks the right run.
  const wanted = normaliseTowards(towards);
  const directed =
    wanted.length > 0 && candidates.some((c) => c.towards === wanted);

  for (const candidate of candidates) {
    if (candidate.line !== line) continue;
    if (directed && candidate.towards !== wanted) continue;
    for (const secs of [plannedSecs, plannedSecs + DAY_SECONDS]) {
      const diff = Math.abs(candidate.secs - secs);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidate;
      }
    }
  }

  return bestDiff <= MATCH_TOLERANCE_S ? best : null;
}

export type MonitorSweep = {
  anchors: Map<string, Anchor[]>;
  stopsAnswered: number;
  departures: number;
  matched: number;
  withRealtime: number;
  requests: number;
  skippedBatches: number;
  at: number;
};

export async function sweepMonitor(
  priorityStopIds?: number[],
): Promise<MonitorSweep> {
  const [stops, candidatesByStop] = await Promise.all([
    loadStops(),
    stopTimeIndex(),
  ]);

  const known = new Set(stops.map((s) => s.stopId));
  const targets = priorityStopIds?.length
    ? [...new Set(priorityStopIds)].filter((id) => known.has(id))
    : stops.map((s) => s.stopId);

  const batches: number[][] = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    batches.push(targets.slice(i, i + BATCH));
  }
  const capped = batches.slice(0, MAX_REQUESTS_PER_SWEEP);

  const gtfsByStopId = new Map(stops.map((s) => [s.stopId, s.gtfsStopIds]));

  const anchors = new Map<string, Map<number, number>>();
  let stopsAnswered = 0;
  let departures = 0;
  let matched = 0;
  let withRealtime = 0;

  let failures = 0;

  for (let b = 0; b < capped.length; b++) {
    if (b > 0) await sleep(REQUEST_GAP_MS);

    let monitors: Monitor[];
    try {
      monitors = await fetchBatch(capped[b]);
    } catch {
      if (++failures >= 3) break;
      await sleep(REQUEST_GAP_MS * 4);
      continue;
    }

    {
      for (const monitor of monitors) {
        const rbl = monitor.locationStop?.properties?.attributes?.rbl;
        if (rbl === undefined) continue;
        stopsAnswered++;

        const gtfsIds = gtfsByStopId.get(rbl);
        if (!gtfsIds?.length) continue;

        const candidates = gtfsIds.flatMap(
          (id) => candidatesByStop.get(id) ?? [],
        );
        if (!candidates.length) continue;

        for (const line of monitor.lines ?? []) {
          const name = line.name;
          if (!name) continue;

          for (const departure of line.departures?.departure ?? []) {
            const planned = departure.departureTime?.timePlanned;
            const real = departure.departureTime?.timeReal;
            if (!planned) continue;
            departures++;
            if (!real) continue;
            withRealtime++;

            const plannedSecs = secondsOfDay(planned);
            const realSecs = secondsOfDay(real);
            if (plannedSecs === null || realSecs === null) continue;

            const hit = matchCandidate(
              candidates,
              name,
              plannedSecs,
              line.towards ?? "",
            );
            if (!hit) continue;
            matched++;

            let delay = realSecs - plannedSecs;
            if (delay > DAY_SECONDS / 2) delay -= DAY_SECONDS;
            if (delay < -DAY_SECONDS / 2) delay += DAY_SECONDS;

            let perTrip = anchors.get(hit.tripId);
            if (!perTrip) {
              perTrip = new Map();
              anchors.set(hit.tripId, perTrip);
            }
            perTrip.set(hit.idx, delay);
          }
        }
      }
    }
  }

  const out = new Map<string, Anchor[]>();
  for (const [tripId, perTrip] of anchors) {
    out.set(
      tripId,
      [...perTrip].map(([idx, delay]) => ({ index: idx, delay })),
    );
  }

  return {
    anchors: out,
    stopsAnswered,
    departures,
    matched,
    withRealtime,
    requests: capped.length,
    skippedBatches: batches.length - capped.length,
    at: Date.now(),
  };
}
