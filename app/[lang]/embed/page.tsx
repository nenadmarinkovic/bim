import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmbedTheme } from "@/components/embed-theme";
import { MapView } from "@/components/map";
import { embedParents } from "@/lib/embed";
import { isLocale } from "@/lib/i18n";

// The same map with none of the chrome around it. The title and the nav are the
// host page's job — a second site header nested in an article reads as a browser
// inside a browser — and the layer panel is published over the channel for the
// host to draw in its own language rather than floating over the figure.
//
// It is a route rather than a flag on the map page because reading the flag
// server-side would turn that page dynamic for every reader, embedded or not.

// Same map, same city: left indexable it would compete with the page it is cut
// out of.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Embed({ params }: PageProps<"/[lang]/embed">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const parents = embedParents();

  return (
    <div className="relative h-full w-full">
      <MapView embed parents={parents} />
      <EmbedTheme parents={parents} />
    </div>
  );
}
