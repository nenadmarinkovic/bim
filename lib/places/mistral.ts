import { remember, remembered } from "./store";

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const MODEL = "mistral-small-latest";
const TIMEOUT_MS = 10000;
const DECLINE = "UNKNOWN";

const LANGUAGES: Record<string, string> = { en: "English", de: "German" };

export const isSupportedLanguage = (lang: string) => lang in LANGUAGES;

const cacheKey = (name: string, kind: string, lang: string) =>
  `${lang}|${name}|${kind}`.toLowerCase();

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

  await remember(key, text);

  return text;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

const CHAT_TIMEOUT_MS = 20000;
const MAX_TURNS = 12;

function chatSystemPrompt(
  name: string,
  kind: string,
  language: string,
  summary: string,
): string {
  return [
    `You are answering questions about "${name}", a ${kind} in Vienna, Austria,`,
    "for someone looking at it on a map.",
    `Answer in ${language}.`,
    summary ? `The map already showed them this: "${summary}"` : "",
    "Keep answers short — two or three sentences, unless asked for more.",
    "Be concrete: dates, names, numbers, what happened there.",
    "Say plainly when you do not know or are unsure rather than guessing a",
    "specific fact. Widening to a century or an era beats inventing a year.",
    "You only discuss this place and its context — history, architecture, the",
    "people involved, the city around it. If asked for anything else, such as",
    "code, translations, recipes or general knowledge, reply with one sentence",
    `saying you can only talk about ${name}, and do not attempt the task, not`,
    "even partly.",
    "No promotional adjectives such as vibrant, iconic, charming or bustling.",
    "Do not address the reader as a tourist or tell them what to do there.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function chatAboutPlace(
  name: string,
  kind: string,
  lang: string,
  summary: string,
  turns: ChatTurn[],
): Promise<string | null> {
  const language = LANGUAGES[lang];
  if (!language) return null;

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: chatSystemPrompt(name, kind, language, summary),
          },
          ...turns.slice(-MAX_TURNS),
        ],
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
