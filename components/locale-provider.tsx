"use client";

import { createContext, useContext } from "react";

import type { Dictionary, Locale } from "@/lib/i18n";

type Value = { locale: Locale; dictionary: Dictionary };

const LocaleContext = createContext<Value | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: Value & { children: React.ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale, dictionary }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): Value {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale outside LocaleProvider");
  return value;
}

export const useDict = (): Dictionary => useLocale().dictionary;
