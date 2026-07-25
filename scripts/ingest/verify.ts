import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./sources.ts";
import { distanceMetres } from "./match.ts";

/**
 * Checks the built stop index against the live monitor API. The build joins
 * static files to each other, which only proves internal consistency — this
 * asks the real-time endpoint whether a StopID really resolves to the DIVA and
 * position we recorded for it.
 */
const MONITOR = "https://www.wienerlinien.at/ogd_realtime/monitor";
const BATCH_SIZE = 10;
const SAMPLE_SIZE = Number(process.argv[2] ?? 80);

type StopRecord = {
  stopId: number;
  diva: number;
  name: string;
  lat: number;
  lon: number;
};

type Monitor = {
  locationStop: {
    geometry: { coordinates: [number, number] };
    properties: { name: string; title: string; attributes: { rbl: number } };
  };
};

async function fetchBatch(stopIds: number[]): Promise<Map<number, Monitor>> {
  const query = stopIds.map((id) => `stopId=${id}`).join("&");
  const response = await fetch(`${MONITOR}?${query}`);
  if (!response.ok) throw new Error(`monitor responded ${response.status}`);

  const body = (await response.json()) as { data?: { monitors?: Monitor[] } };
  const found = new Map<number, Monitor>();
  for (const monitor of body.data?.monitors ?? []) {
    found.set(monitor.locationStop.properties.attributes.rbl, monitor);
  }
  return found;
}

async function main() {
  const { stops } = JSON.parse(
    await readFile(path.join(DATA_DIR, "stops.json"), "utf8"),
  ) as { stops: StopRecord[] };

  // Evenly spaced sample rather than random, so runs are reproducible.
  const step = Math.max(1, Math.floor(stops.length / SAMPLE_SIZE));
  const sample = stops.filter((_, i) => i % step === 0).slice(0, SAMPLE_SIZE);

  let checked = 0;
  let divaOk = 0;
  let noDepartures = 0;
  const distances: number[] = [];
  const mismatches: string[] = [];

  for (let i = 0; i < sample.length; i += BATCH_SIZE) {
    const batch = sample.slice(i, i + BATCH_SIZE);
    const found = await fetchBatch(batch.map((s) => s.stopId));

    for (const stop of batch) {
      const monitor = found.get(stop.stopId);
      if (!monitor) {
        // A stop with no departures in the current window returns no monitor.
        noDepartures++;
        continue;
      }

      checked++;
      const props = monitor.locationStop.properties;
      const [lon, lat] = monitor.locationStop.geometry.coordinates;

      if (Number(props.name) === stop.diva) divaOk++;
      else {
        mismatches.push(
          `${stop.stopId} "${stop.name}": built diva ${stop.diva}, api ${props.name}`,
        );
      }

      distances.push(distanceMetres({ lat, lon }, { lat: stop.lat, lon: stop.lon }));
    }
  }

  distances.sort((a, b) => a - b);
  const median = distances[Math.floor(distances.length / 2)] ?? 0;
  const p95 = distances[Math.floor(distances.length * 0.95)] ?? 0;

  console.log(`sampled        ${sample.length}`);
  console.log(`answered       ${checked}`);
  console.log(`no departures  ${noDepartures}`);
  console.log(`diva correct   ${divaOk}/${checked}`);
  console.log(`position median ${median.toFixed(1)} m, p95 ${p95.toFixed(1)} m`);

  if (mismatches.length) {
    console.log("\nmismatches");
    for (const line of mismatches) console.log(`  ${line}`);
    process.exitCode = 1;
  } else {
    console.log("\nno DIVA mismatches");
  }
}

await main();
