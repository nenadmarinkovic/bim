import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";
const MODEL = "eleven_multilingual_v2";
const FORMAT = "mp3_44100_128";
const TIMEOUT_MS = 30000;

const DIR = path.join(process.cwd(), "data", "audio");

const fileFor = (key: string) =>
  path.join(DIR, `${createHash("sha1").update(key).digest("hex")}.mp3`);

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

  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(fileFor(key), audio);
  } catch {
    // Playable even if it could not be kept.
  }

  return audio;
}
