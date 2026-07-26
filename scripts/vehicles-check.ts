import { vehiclesAt, feedStats } from "../lib/vehicles/feed.ts";
import { isPlausiblyVienna, distanceMetres } from "./ingest/match.ts";

/**
 * Exercises the position engine against the live feed and reports whether the
 * output is physically sensible: inside Vienna, spread across modes, and moving
 * at speeds a tram or bus could actually manage between two samples.
 */
async function main() {
  const stats = await feedStats();
  console.log(`feed: ${stats.tripsInFeed} trips matched to today's schedule`);

  const t0 = Date.now();
  const first = await vehiclesAt(t0);
  console.log(`placed: ${first.length} vehicles in ${Date.now() - t0} ms`);

  const byMode = new Map<string, number>();
  let outside = 0;
  for (const v of first) {
    byMode.set(v.mode, (byMode.get(v.mode) ?? 0) + 1);
    if (!isPlausiblyVienna(v)) outside++;
  }
  console.log("by mode:", Object.fromEntries(byMode));
  console.log(`outside Vienna bbox: ${outside}`);

  const delays = first.map((v) => v.delay).sort((a, b) => a - b);
  if (delays.length) {
    const at = (q: number) => delays[Math.floor(delays.length * q)];
    console.log(
      `delay p10 ${at(0.1)}s  median ${at(0.5)}s  p90 ${at(0.9)}s  max ${delays[delays.length - 1]}s`,
    );
  }

  // Re-place the same feed snapshot 30 s later. Nothing upstream changes, so any
  // movement is purely the interpolation advancing along the shape.
  const gapS = 30;
  const later = await vehiclesAt(t0 + gapS * 1000);
  const laterById = new Map(later.map((v) => [v.id, v]));

  const speeds: number[] = [];
  let moved = 0;
  for (const v of first) {
    const l = laterById.get(v.id);
    if (!l) continue;
    const metres = distanceMetres(v, l);
    if (metres > 0.5) moved++;
    speeds.push((metres / gapS) * 3.6);
  }
  speeds.sort((a, b) => a - b);
  const q = (p: number) => speeds[Math.floor(speeds.length * p)] ?? 0;

  console.log(`\nover ${gapS}s of simulated time:`);
  console.log(`  moved: ${moved}/${speeds.length}`);
  console.log(
    `  km/h  median ${q(0.5).toFixed(1)}  p90 ${q(0.9).toFixed(1)}  max ${(speeds.at(-1) ?? 0).toFixed(1)}`,
  );

  const implausible = speeds.filter((s) => s > 120).length;
  console.log(`  above 120 km/h: ${implausible}`);

  const sample = first.slice(0, 5);
  console.log("\nsample vehicles:");
  for (const v of sample) {
    console.log(
      `  ${v.mode.padEnd(5)} ${v.line.padEnd(5)} -> ${v.towards.slice(0, 28).padEnd(28)} ${v.lat.toFixed(4)},${v.lon.toFixed(4)} ${v.bearing}deg ${v.delay >= 0 ? "+" : ""}${v.delay}s`,
    );
  }

  if (outside > 0 || implausible > speeds.length * 0.01) process.exitCode = 1;
}

await main();
