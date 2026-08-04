import {
  cachedDescription,
  chatAboutPlace,
  isSupportedLanguage,
  type ChatTurn,
} from "@/lib/places/mistral";
import { DAY_MS, GLOBAL, clientKey, retryAfter } from "@/lib/places/rate-limit";
import { clean, cleanKind, cleanName } from "@/lib/places/text";

const MAX_NAME = 120;
const MAX_KIND = 60;
const MAX_MESSAGE = 500;
const MAX_TURNS = 12;
const MAX_PER_WINDOW = 8;
const GLOBAL_PER_MINUTE = 40;
const GLOBAL_PER_DAY = 1000;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const name = cleanName(body.name, MAX_NAME);
  const kind = cleanKind(body.kind, MAX_KIND) || "place";
  const lang = clean(body.lang, 8).toLowerCase() || "en";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (!isSupportedLanguage(lang)) {
    return Response.json({ error: "unsupported language" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const turns: ChatTurn[] = raw
    .slice(-MAX_TURNS)
    .map((turn) => {
      const entry = turn as Record<string, unknown>;
      const role: ChatTurn["role"] =
        entry.role === "assistant" ? "assistant" : "user";
      return { role, content: clean(entry.content, MAX_MESSAGE) };
    })
    .filter((turn) => turn.content.length > 0);

  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return Response.json({ error: "a question is required" }, { status: 400 });
  }

  const wait =
    retryAfter("chat", clientKey(request), MAX_PER_WINDOW) ||
    retryAfter("chat:all", GLOBAL, GLOBAL_PER_MINUTE) ||
    retryAfter("chat:day", GLOBAL, GLOBAL_PER_DAY, DAY_MS);
  if (wait) {
    return Response.json(
      { error: "Too many questions just now — try again in a moment." },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  const summary = (await cachedDescription(name, kind, lang)) ?? "";

  const answer = await chatAboutPlace(name, kind, lang, summary, turns);
  if (!answer) {
    return Response.json({ error: "no answer" }, { status: 502 });
  }

  return Response.json({ answer });
}
