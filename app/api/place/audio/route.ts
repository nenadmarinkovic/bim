import { cachedDescription, isSupportedLanguage } from "@/lib/places/mistral";
import { clientKey, retryAfter } from "@/lib/places/rate-limit";
import { cachedSpeech, speak } from "@/lib/places/speech";

const MAX_NAME = 120;
const MAX_KIND = 60;

const clean = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const send = (audio: Buffer) =>
  new Response(new Uint8Array(audio), {
    headers: {
      "content-type": "audio/mpeg",
      "content-length": String(audio.length),
      "cache-control": "public, max-age=604800",
    },
  });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const name = clean(params.get("name") ?? "", MAX_NAME);
  const kind = clean(params.get("kind") ?? "", MAX_KIND) || "place";
  const lang = params.get("lang")?.toLowerCase() ?? "en";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (!isSupportedLanguage(lang)) {
    return Response.json({ error: "unsupported language" }, { status: 400 });
  }

  const key = `${lang}|${name}|${kind}`.toLowerCase();

  const known = await cachedSpeech(key);
  if (known) return send(known);

  // Only ever voices a description the server already wrote. Speaking text
  // supplied by the caller would let anyone spend the whole voice quota.
  const text = await cachedDescription(name, kind, lang);
  if (!text) {
    return Response.json({ error: "nothing to read" }, { status: 404 });
  }

  const wait = retryAfter(clientKey(request));
  if (wait) {
    return Response.json(
      { error: "too many requests" },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  const audio = await speak(key, `${name}. ${text}`);
  if (!audio) {
    return Response.json({ error: "no audio" }, { status: 502 });
  }

  return send(audio);
}
