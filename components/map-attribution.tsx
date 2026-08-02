"use client";

import { useState } from "react";
import { InfoIcon } from "@phosphor-icons/react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDict } from "./locale-provider";
import { cn } from "@/lib/utils";

const SOURCES = [
  { label: "Wiener Linien", href: "https://www.wienerlinien.at/" },
  { label: "ÖBB", href: "https://data.oebb.at" },
  { label: "Stadt Wien", href: "https://data.wien.gv.at" },
  {
    label: "GTFS Wien",
    href: "https://wiener-linien-gtfs-rt.zuugle-services.com/",
  },
  { label: "© Mapbox", href: "https://www.mapbox.com/about/maps/" },
  { label: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
];

const FEEDBACK = "https://apps.mapbox.com/feedback/";

export function MapAttribution({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const dict = useDict();

  return (
    <div
      className={cn(
        // Beside the button where there is width for it; stacked above it on a
        // phone, where a row of six sources would push the button off-screen.
        "pointer-events-auto flex flex-col items-end justify-end gap-2 sm:flex-row sm:items-center",
        className,
      )}
    >
      {open && (
        <div className="glass flex max-w-[min(34rem,calc(100vw-5.5rem))] flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5 rounded-2xl px-3.5 py-1.5 text-[0.6875rem] text-foreground duration-200 animate-in fade-in-0 slide-in-from-bottom-2 sm:rounded-full sm:slide-in-from-bottom-0 sm:slide-in-from-right-3">
          {SOURCES.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noreferrer noopener"
              className="whitespace-nowrap underline-offset-2 transition-opacity hover:underline hover:opacity-70"
            >
              {source.label}
            </a>
          ))}
          <a
            href={FEEDBACK}
            target="_blank"
            rel="noreferrer noopener"
            className="whitespace-nowrap underline-offset-2 transition-opacity hover:underline hover:opacity-70"
          >
            {dict.map.improve}
          </a>
        </div>
      )}

      <Tooltip>
        <TooltipTrigger
          aria-label={dict.map.dataSources}
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="glass flex size-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10 active:bg-foreground/15"
        >
          <InfoIcon size={16} weight="regular" />
        </TooltipTrigger>
        <TooltipContent side="top">{dict.map.dataSources}</TooltipContent>
      </Tooltip>
    </div>
  );
}
