import { vehiclesAt } from "../lib/vehicles/feed.ts";

/** Breaks the current placement down by line, which is the readable sanity check. */
async function main() {
  const now = Date.now();
  console.log(
    "vienna local:",
    new Intl.DateTimeFormat("de-AT", {
      timeZone: "Europe/Vienna",
      dateStyle: "full",
      timeStyle: "short",
    }).format(now),
  );

  const vehicles = await vehiclesAt(now);
  const byLine = new Map<string, { n: number; mode: string; rt: number }>();
  for (const v of vehicles) {
    const entry = byLine.get(v.line) ?? { n: 0, mode: v.mode, rt: 0 };
    entry.n++;
    if (v.realtime) entry.rt++;
    byLine.set(v.line, entry);
  }

  const metro = [...byLine.entries()].filter(([, v]) => v.mode === "metro");
  console.log(`\nmetro lines (${metro.length}):`);
  for (const [line, v] of metro.sort()) {
    console.log(`  ${line.padEnd(4)} ${String(v.n).padStart(3)} trains   realtime ${v.rt}`);
  }

  const trams = [...byLine.entries()]
    .filter(([, v]) => v.mode === "tram")
    .sort((a, b) => b[1].n - a[1].n);
  console.log(`\ntram lines (${trams.length}), busiest:`);
  for (const [line, v] of trams.slice(0, 10)) {
    console.log(`  ${line.padEnd(6)} ${String(v.n).padStart(3)}   realtime ${v.rt}`);
  }

  const buses = [...byLine.entries()].filter(([, v]) => v.mode === "bus");
  console.log(`\nbus lines: ${buses.length}, vehicles ${buses.reduce((s, [, v]) => s + v.n, 0)}`);

  const rt = vehicles.filter((v) => v.realtime).length;
  console.log(
    `\ntotal ${vehicles.length} vehicles — ${rt} with realtime delay, ${vehicles.length - rt} schedule-only`,
  );
}

await main();
