import { cachedDescription, isSupportedLanguage } from "@/lib/places/mistral";
import { DAY_MS, GLOBAL, clientKey, retryAfter } from "@/lib/places/rate-limit";
import { cachedSpeech, speak } from "@/lib/places/speech";
import { cleanKind, cleanName } from "@/lib/places/text";

const MAX_NAME = 120;
const MAX_KIND = 60;
const MAX_PER_WINDOW = 5;
const GLOBAL_PER_MINUTE = 20;
const GLOBAL_PER_DAY = 200;

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

  const name = cleanName(params.get("name") ?? "", MAX_NAME);
  const kind = cleanKind(params.get("kind") ?? "", MAX_KIND) || "place";
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

  const text = await cachedDescription(name, kind, lang);
  if (!text) {
    return Response.json({ error: "nothing to read" }, { status: 404 });
  }

  const wait =
    retryAfter("audio", clientKey(request), MAX_PER_WINDOW) ||
    retryAfter("audio:all", GLOBAL, GLOBAL_PER_MINUTE) ||
    retryAfter("audio:day", GLOBAL, GLOBAL_PER_DAY, DAY_MS);
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
