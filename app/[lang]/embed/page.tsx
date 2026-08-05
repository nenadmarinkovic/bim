import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmbedTheme } from "@/components/embed-theme";
import { Logo } from "@/components/logo";
import { MapView } from "@/components/map";
import { VehicleCount } from "@/components/vehicle-count";
import { embedParents } from "@/lib/embed";
import { getDictionary, isLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Embed({ params }: PageProps<"/[lang]/embed">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const parents = embedParents();
  const dict = getDictionary(lang);

  return (
    <div className="relative h-full w-full">
      <MapView embed parents={parents} />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-4 md:items-center">
        <div className="glass animate-in fade-in fill-mode-both pointer-events-auto flex max-w-[calc(100%-3.25rem)] items-center gap-2 rounded-full px-3 py-1.5 duration-700 [animation-delay:700ms] sm:gap-2.5 md:max-w-full lg:gap-3 lg:px-4 lg:py-2">
          <h1 className="flex shrink-0 items-center gap-2.5 text-base font-bold tracking-tight text-foreground lg:text-lg">
            <Logo className="h-3 w-auto shrink-0" />
            Bim
          </h1>
          <span className="h-4 w-px shrink-0 bg-foreground/20 sm:h-5" />
          <span className="min-w-0 truncate text-xs font-medium text-foreground sm:text-sm">
            {dict.header.tagline}
          </span>
        </div>

        <VehicleCount className="glass pointer-events-auto max-w-full truncate rounded-full px-3 py-1 text-xs font-medium text-foreground" />
      </header>

      <EmbedTheme parents={parents} />
    </div>
  );
}
