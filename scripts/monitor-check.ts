import { sweepMonitor } from "../lib/vehicles/monitor.ts";
import { vehiclesAt } from "../lib/vehicles/feed.ts";

async function main() {
  const t0 = Date.now();
  const sweep = await sweepMonitor();
  const elapsed = Date.now() - t0;

  console.log(`sweep took ${elapsed} ms`);
  console.log(
    `  requests made   ${sweep.requests} (skipped ${sweep.skippedBatches} batches to stay under the cap)`,
  );
  console.log(`  stops answered  ${sweep.stopsAnswered}`);
  console.log(`  departures      ${sweep.departures}`);
  console.log(`  with timeReal   ${sweep.withRealtime}`);
  console.log(
    `  matched to trip ${sweep.matched} (${((sweep.matched / sweep.withRealtime) * 100).toFixed(1)}% of realtime departures)`,
  );
  console.log(`  trips anchored  ${sweep.anchors.size}`);

  const anchorCounts = [...sweep.anchors.values()].map((a) => a.length);
  anchorCounts.sort((a, b) => a - b);
  console.log(
    `  anchors/trip    median ${anchorCounts[anchorCounts.length >> 1]}  max ${anchorCounts.at(-1)}`,
  );

  const vehicles = await vehiclesAt(Date.now());
  const byCertainty = new Map<string, number>();
  for (const v of vehicles) {
    byCertainty.set(v.certainty, (byCertainty.get(v.certainty) ?? 0) + 1);
  }
  console.log(`\nplaced ${vehicles.length} vehicles`);
  console.log("  certainty:", Object.fromEntries(byCertainty));

  const byLine = new Map<string, { n: number; rt: number }>();
  for (const v of vehicles) {
    if (v.mode !== "tram") continue;
    const e = byLine.get(v.line) ?? { n: 0, rt: 0 };
    e.n++;
    if (v.realtime) e.rt++;
    byLine.set(v.line, e);
  }
  const rows = [...byLine]
    .map(([line, e]) => ({ line, n: e.n, pct: (e.rt / e.n) * 100 }))
    .sort((a, b) => a.pct - b.pct);

  console.log("\nworst tram lines by realtime coverage:");
  for (const r of rows.slice(0, 8)) {
    console.log(
      `  ${r.line.padEnd(5)} ${String(r.n).padStart(3)} vehicles  ${r.pct.toFixed(0).padStart(3)}%`,
    );
  }
  const total = rows.reduce((s, r) => s + r.n, 0);
  const rt = rows.reduce((s, r) => s + (r.n * r.pct) / 100, 0);
  console.log(`  overall trams: ${((rt / total) * 100).toFixed(0)}% realtime`);
}

await main();
