import { remember, remembered } from "./store";

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const MODEL = "mistral-small-latest";
const TIMEOUT_MS = 10000;
const DECLINE = "UNKNOWN";

const LANGUAGES: Record<string, string> = { en: "English", de: "German" };

export const isSupportedLanguage = (lang: string) => lang in LANGUAGES;

const cacheKey = (name: string, kind: string, lang: string) =>
  `${lang}|${name}|${kind}`.toLowerCase();

/** Cache lookup with no chance of billing, so the route can serve known places
 *  without spending a caller's rate-limit allowance. */
export async function cachedDescription(
  name: string,
  kind: string,
  lang: string,
): Promise<string | undefined> {
  if (!isSupportedLanguage(lang)) return undefined;
  return remembered(cacheKey(name, kind, lang));
}

function systemPrompt(language: string): string {
  return [
    "You write short factual descriptions of places in Vienna, Austria,",
    "for a map application.",
    "Write the way an encyclopedia opens an article: state plainly what the",
    "place is, in neutral third person.",
    `Reply with exactly two sentences in ${language}, under 45 words in total.`,
    "Never say where the place is. No districts, no street names, no nearby",
    "landmarks, no compass directions, and not the word Vienna itself — the",
    "map has already shown all of that.",
    "The first sentence states what kind of place it is.",
    "The second gives something the map cannot show: when it was built, who",
    "built or founded it, what stood there before, or what it is known for.",
    "Do not describe what visitors do there or address the reader.",
    "No promotional adjectives such as vibrant, iconic, charming or bustling.",
    "Do not restate the name as a definition.",
    "Give a date, a name or a number only if you are certain of it. If you are",
    "unsure, widen to the century or the era, or leave it out — never guess a",
    "specific year.",
    'Example of the required style, in English: "The Secession Building is an exhibition hall built for artists who broke away from the conservative Künstlerhaus. Its gilded openwork dome of laurel leaves is nicknamed the golden cabbage."',
    // A stricter bar here ("not confident about this specific place") made it
    // refuse nearly everything outside the guidebook.
    `Only if you have no idea what this place is, reply with exactly: ${DECLINE}.`,
    "Otherwise describe it at whatever level of generality you are sure of.",
  ].join(" ");
}

export async function describePlace(
  name: string,
  kind: string,
  lang: string,
): Promise<string | null> {
  const language = LANGUAGES[lang];
  if (!language) return null;

  const key = cacheKey(name, kind, lang);

  const hit = await remembered(key);
  if (hit !== undefined) return hit;

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  let text: string;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 140,
        messages: [
          { role: "system", content: systemPrompt(language) },
          {
            role: "user",
            content: `Place: "${name}" (${kind}), Vienna, Austria.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    text = body.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return null;
  }

  if (!text || text.toUpperCase().includes(DECLINE)) return null;

  // Answers only. Declining is not deterministic, so caching one would leave
  // the place permanently blank however often it is clicked.
  await remember(key, text);

  return text;
}
