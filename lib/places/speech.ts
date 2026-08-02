import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";
const MODEL = "eleven_multilingual_v2";
const FORMAT = "mp3_44100_128";
const TIMEOUT_MS = 30000;

const DIR = path.join(process.cwd(), "data", "audio");
const LEDGER = path.join(process.cwd(), "data", "speech-budget.json");

const MAX_BYTES = 128 * 1024 * 1024;
const DEFAULT_MONTHLY_CHARS = 9000;

const fileFor = (key: string) =>
  path.join(DIR, `${createHash("sha1").update(key).digest("hex")}.mp3`);

const monthlyChars = () => {
  const configured = Number(process.env.ELEVENLABS_MONTHLY_CHARS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MONTHLY_CHARS;
};

const thisMonth = () => new Date().toISOString().slice(0, 7);

type Ledger = { month: string; chars: number };

let ledger: Ledger | null = null;

async function spent(): Promise<Ledger> {
  if (!ledger) {
    try {
      const parsed = JSON.parse(await readFile(LEDGER, "utf8")) as Ledger;
      ledger =
        typeof parsed?.month === "string" && Number.isFinite(parsed?.chars)
          ? parsed
          : { month: thisMonth(), chars: 0 };
    } catch {
      ledger = { month: thisMonth(), chars: 0 };
    }
  }

  if (ledger.month !== thisMonth()) ledger = { month: thisMonth(), chars: 0 };

  return ledger;
}

async function charge(chars: number) {
  const current = await spent();
  current.chars += chars;

  try {
    await mkdir(path.dirname(LEDGER), { recursive: true });
    await writeFile(LEDGER, JSON.stringify(current));
  } catch {}
}

let bytes: number | null = null;

async function occupied(): Promise<number> {
  if (bytes !== null) return bytes;

  let total = 0;
  try {
    for (const entry of await readdir(DIR)) {
      try {
        total += (await stat(path.join(DIR, entry))).size;
      } catch {}
    }
  } catch {}

  bytes = total;
  return total;
}

export async function cachedSpeech(key: string): Promise<Buffer | null> {
  try {
    return await readFile(fileFor(key));
  } catch {
    return null;
  }
}

export async function speak(key: string, text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const budget = monthlyChars();
  const ledgerNow = await spent();
  if (ledgerNow.chars + text.length > budget) {
    console.info(
      `[speech] ${ledgerNow.chars} of ${budget} characters used this month — not synthesising`,
    );
    return null;
  }

  if ((await occupied()) >= MAX_BYTES) {
    console.info("[speech] audio cache is at its size limit");
    return null;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;

  let audio: Buffer;
  try {
    const response = await fetch(
      `${ENDPOINT}/${voiceId}?output_format=${FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ text, model_id: MODEL }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`elevenlabs ${response.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    audio = Buffer.from(await response.arrayBuffer());
  } catch (cause) {
    console.error("elevenlabs request failed:", cause);
    return null;
  }

  if (!audio.length) return null;

  await charge(text.length);

  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(fileFor(key), audio);
    if (bytes !== null) bytes += audio.length;
  } catch {}

  return audio;
}
