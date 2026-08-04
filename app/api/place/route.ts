import {
  cachedDescription,
  describePlace,
  isSupportedLanguage,
} from "@/lib/places/mistral";
import { DAY_MS, GLOBAL, clientKey, retryAfter } from "@/lib/places/rate-limit";
import { cleanKind, cleanName } from "@/lib/places/text";

const MAX_NAME = 120;
const MAX_KIND = 60;

const GLOBAL_PER_MINUTE = 60;
const GLOBAL_PER_DAY = 2000;

const ok = (extract: string, name: string, lang: string) =>
  Response.json(
    { title: name, extract, lang },
    { headers: { "cache-control": "public, max-age=86400" } },
  );

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

  const known = await cachedDescription(name, kind, lang);
  if (known) return ok(known, name, lang);

  const wait =
    retryAfter("place", clientKey(request)) ||
    retryAfter("place:all", GLOBAL, GLOBAL_PER_MINUTE) ||
    retryAfter("place:day", GLOBAL, GLOBAL_PER_DAY, DAY_MS);
  if (wait) {
    return Response.json(
      { error: "too many requests" },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  const extract = await describePlace(name, kind, lang);

  if (!extract) {
    return Response.json(
      { error: "no description" },
      { status: 404, headers: { "cache-control": "public, max-age=60" } },
    );
  }

  return ok(extract, name, lang);
}
