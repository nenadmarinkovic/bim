import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "place-descriptions.json");

const MAX_ENTRIES = 5000;
const FLUSH_DELAY_MS = 5000;

let entries: Map<string, string> | null = null;
let loading: Promise<Map<string, string>> | null = null;
let flush: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

async function load(): Promise<Map<string, string>> {
  if (entries) return entries;
  if (loading) return loading;

  loading = (async () => {
    try {
      const raw = await readFile(FILE, "utf8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      entries = new Map(Object.entries(parsed).slice(-MAX_ENTRIES));
    } catch {
      entries = new Map();
    }
    return entries;
  })();

  return loading;
}

async function persist() {
  flush = null;
  if (!entries || !dirty) return;
  dirty = false;

  const snapshot = Object.fromEntries(entries);
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    const temp = `${FILE}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(snapshot));
    // Renamed into place so a crash mid-write cannot leave a truncated file.
    await rename(temp, FILE);
  } catch {
    dirty = true;
  }
}

export async function remembered(key: string): Promise<string | undefined> {
  return (await load()).get(key);
}

export async function remember(key: string, value: string) {
  const map = await load();

  if (map.size >= MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
  dirty = true;

  if (!flush) flush = setTimeout(() => void persist(), FLUSH_DELAY_MS);
}
