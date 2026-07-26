import { describePlace, isSupportedLanguage } from "@/lib/places/mistral";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const name = params.get("name")?.trim() ?? "";
  const kind = params.get("kind")?.trim() || "place";
  const lang = params.get("lang")?.toLowerCase() ?? "en";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (!isSupportedLanguage(lang)) {
    return Response.json({ error: "unsupported language" }, { status: 400 });
  }

  const extract = await describePlace(name, kind, lang);

  if (!extract) {
    return Response.json(
      { error: "no description" },
      { status: 404, headers: { "cache-control": "public, max-age=60" } },
    );
  }

  return Response.json(
    { title: name, extract, lang },
    { headers: { "cache-control": "public, max-age=86400" } },
  );
}
