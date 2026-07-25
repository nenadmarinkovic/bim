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

  const wanted = new Set(names);
  const written: Record<string, string> = {};
  const zip = await open(zipPath);

  try {
    for await (const entry of zip) {
      if (!wanted.has(entry.filename)) continue;

      const target = path.join(destDir, entry.filename);
      const readStream = await entry.openReadStream();
      await pipeline(readStream, createWriteStream(target));
      written[entry.filename] = target;
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
