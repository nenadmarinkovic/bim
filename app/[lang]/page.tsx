import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { MapView } from "@/components/map";
// TEMPORARY — see components/safe-area-debug.tsx
import { SafeAreaDebug } from "@/components/safe-area-debug";
import { SiteNav } from "@/components/site-nav";
import { VehicleCount } from "@/components/vehicle-count";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = getDictionary(lang);

  return (
    // Fixed rather than sized off the body: installed on iOS, 100dvh comes back
    // a home indicator short of the screen, and the map stopped above it with a
    // band of page background underneath. inset-0 resolves against the layout
    // viewport, which viewport-fit=cover guarantees covers the whole display,
    // so the map reaches the bottom edge and every control anchored to it is
    // measured from the real edge rather than from 34pt above it.
    <div className="fixed inset-0">
      <MapView />

      {/* TEMPORARY — remove with components/safe-area-debug.tsx */}
      <SafeAreaDebug />

      {/* On a phone the header hugs the left edge, clear of the search and menu
          buttons in the opposite corner, and centres itself once the row has
          the width to sit under nothing. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-4 md:items-center">
        <div className="glass pointer-events-auto flex max-w-[calc(100%-5.25rem)] items-center gap-2 rounded-full px-3 py-1.5 sm:gap-2.5 md:max-w-full lg:gap-3 lg:px-4 lg:py-2">
          <h1 className="flex shrink-0 items-center gap-2.5 text-base font-bold tracking-tight text-foreground lg:text-lg">
            <Logo className="h-3 w-auto shrink-0" />
            Bim
          </h1>
          <span className="h-4 w-px shrink-0 bg-foreground/20 sm:h-5" />
          <span className="min-w-0 truncate text-xs font-medium text-foreground sm:text-sm">
            {dict.header.tagline}
          </span>
          <span className="hidden h-5 w-px shrink-0 bg-foreground/20 md:block" />
          <SiteNav className="hidden md:flex" />
        </div>

        <VehicleCount className="glass pointer-events-auto max-w-full truncate rounded-full px-3 py-1 text-xs font-medium text-foreground" />
      </header>
    </div>
  );
}
