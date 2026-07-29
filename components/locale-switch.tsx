"use client";

import { usePathname } from "next/navigation";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale } from "./locale-provider";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABEL, isLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const YEAR = 60 * 60 * 24 * 365;

export function LocaleSwitch({ className }: { className?: string }) {
  const { locale } = useLocale();
  const pathname = usePathname();

  return (
    <ToggleGroup
      size="sm"
      variant="outline"
      spacing={0}
      value={[locale]}
      onValueChange={(value) => {
        const next = value[0];
        if (!next || !isLocale(next) || next === locale) return;

        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${YEAR}; samesite=lax`;

        const rest = pathname.split("/").slice(2).join("/");
        window.location.assign(`/${next}${rest ? `/${rest}` : ""}`);
      }}
      aria-label="Language"
      className={cn("shrink-0", className)}
    >
      {LOCALES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          aria-label={LOCALE_LABEL[option]}
          className="px-2 text-[0.6875rem] font-medium"
        >
          {LOCALE_LABEL[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
