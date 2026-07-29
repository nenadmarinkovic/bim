export const LOCALES = ["en", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "bim-locale";

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
  de: "DE",
};

// Strings carrying {placeholders}. Missing keys render as the template rather
// than throwing, so a gap in a translation is visible without breaking a popup.
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

export type Plural = { one: string; other: string };

export const plural = (forms: Plural, n: number, values?: Record<string, string | number>) =>
  fill(n === 1 ? forms.one : forms.other, { n, ...values });
