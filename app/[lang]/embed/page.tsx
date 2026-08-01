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

      {/* Held back off a timer rather than the map's own load event: nothing
          here may sit over the canvas, and an element that does — even a nearly
          transparent one — lets the browser stop painting it, which stalls the
          frame loop mapbox loads on. The name arriving a beat late is the
          cheaper trade than a map that never finishes. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 px-4 pt-4">
        <div className="glass animate-in fade-in fill-mode-both pointer-events-auto flex max-w-full items-center gap-3 rounded-full px-4 py-2 duration-700 [animation-delay:700ms]">
          <h1 className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight text-foreground">
            <Logo className="h-3 w-auto shrink-0" />
            Bim
          </h1>
          <span className="h-5 w-px shrink-0 bg-foreground/20" />
          <span className="shrink-0 text-sm font-medium text-foreground">
            {dict.header.tagline}
          </span>
        </div>

        <VehicleCount className="glass pointer-events-auto rounded-full px-3 py-1 text-xs font-medium text-foreground" />
      </header>

      <EmbedTheme parents={parents} />
    </div>
  );
}
