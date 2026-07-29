import { en, type Dictionary } from "./en";
import { de } from "./de";
import type { Locale } from "./locales";

const DICTIONARIES: Record<Locale, Dictionary> = { en, de };

export const getDictionary = (locale: Locale): Dictionary =>
  DICTIONARIES[locale];

export type { Dictionary };
export * from "./locales";
