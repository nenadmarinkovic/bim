// Wiener Linien writes the same stop three ways depending on the feed: the
// monitor abbreviates ("Bhf. Meidling S U"), GTFS spells it out and prefixes
// the city ("Wien Bahnhof Meidling"). Comparisons need one spelling.
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bstr\b/g, "strasse"],
  [/\bg\b/g, "gasse"],
  [/\bpl\b/g, "platz"],
  [/\bbhf\b/g, "bahnhof"],
];

export function normaliseName(name: string): string {
  let value = name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");

  value = value
    .replace(/[.,/()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of ABBREVIATIONS) {
    value = value.replace(pattern, replacement);
  }

  return value.replace(/[^a-z0-9]/g, "");
}

// GTFS headsigns carry a city prefix the boards never show.
export const stripCity = (name: string) => name.replace(/^\s*wien\s+/i, "");

// Wiener Linien marks an interchange inside the stop name — "Karlsplatz U",
// "Floridsdorf S U" — where every other source just names the place. The
// markers always trail, so nothing but them comes off.
export const stripModeMarkers = (name: string) =>
  name.replace(/(\s+[SU])+\s*$/i, "").trim();
