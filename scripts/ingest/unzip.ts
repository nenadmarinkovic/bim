import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { open } from "yauzl-promise";

export async function extractEntries(
  zipPath: string,
  names: string[],
  destDir: string,
): Promise<Record<string, string>> {
  await mkdir(destDir, { recursive: true });

  // Matched and written by basename: the ÖBB archive nests everything under a
  // GTFS_Fahrplan_2026/ directory, the Wiener Linien one does not.
  const wanted = new Set(names);
  const written: Record<string, string> = {};
  const zip = await open(zipPath);

  try {
    for await (const entry of zip) {
      const name = path.basename(entry.filename);
      if (!wanted.has(name)) continue;

      const target = path.join(destDir, name);
      const readStream = await entry.openReadStream();
      await pipeline(readStream, createWriteStream(target));
      written[name] = target;
    }
  } finally {
    await zip.close();
  }

  const missing = names.filter((name) => !written[name]);
  if (missing.length) {
    throw new Error(`zip is missing expected entries: ${missing.join(", ")}`);
  }

  return written;
}
