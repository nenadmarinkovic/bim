"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, SpinnerGapIcon } from "@phosphor-icons/react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { normaliseName } from "@/lib/vehicles/names";
import { badgeMarkup, type StationMode } from "./stop-icons";
import type { Station } from "./stops";

// Enough to scan, few enough to keep the list light. The whole network is 1,726
// stations and cmdk would otherwise mount every one of them.
const LIMIT = 40;

const RECENT_KEY = "bim:recent-stations";
const RECENT_MAX = 5;

type Indexed = Station & { key: string };

async function loadStations(): Promise<Indexed[]> {
  const response = await fetch("/api/stops");
  if (!response.ok) return [];

  const collection = (await response.json()) as {
    features: {
      geometry: { coordinates: [number, number] };
      properties: { diva: number; name: string; modes?: string };
    }[];
  };

  return collection.features.map((feature) => ({
    diva: feature.properties.diva,
    name: feature.properties.name,
    modes: String(feature.properties.modes ?? "")
      .split(",")
      .filter(Boolean),
    lngLat: feature.geometry.coordinates,
    key: normaliseName(feature.properties.name),
  }));
}

function readRecent(): Station[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as Station[]) : [];
  } catch {
    return [];
  }
}

function forgetRecent() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {}
}

function rememberRecent(station: Station): Station[] {
  const kept = [
    station,
    ...readRecent().filter((one) => one.diva !== station.diva),
  ].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(kept));
  } catch {}
  return kept;
}

function Badges({ modes }: { modes: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {modes.map((mode) => (
        <span
          key={mode}
          className="inline-flex leading-none"
          // Our own markup, the same badges the map draws.
          dangerouslySetInnerHTML={{
            __html: badgeMarkup(mode as StationMode, 14),
          }}
        />
      ))}
    </span>
  );
}

// Only the plain case is highlighted: the ranking key expands abbreviations and
// folds diacritics, so its offsets do not map back onto the name being shown.
function Name({ name, query }: { name: string; query: string }) {
  const at = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <span className="truncate">{name}</span>;

  return (
    <span className="truncate">
      {name.slice(0, at)}
      <mark className="bg-transparent font-semibold text-foreground">
        {name.slice(at, at + query.length)}
      </mark>
      {name.slice(at + query.length)}
    </span>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-sans text-[0.625rem] leading-none">
      {children}
    </kbd>
  );
}

export function StationSearch({
  onPick,
}: {
  onPick: (station: Station) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stations, setStations] = useState<Indexed[]>([]);
  const [recent, setRecent] = useState<Station[]>([]);
  const [query, setQuery] = useState("");
  // cmdk always marks one item selected so Enter has a target. Before the list
  // has been touched that reads as a row hovered by nobody, so the styling is
  // held back until an arrow key or the pointer says otherwise.
  const [touched, setTouched] = useState(false);

  // Opening reads the recents: localStorage is a side effect of the gesture,
  // not of rendering.
  const show = useCallback((next: boolean) => {
    if (next) setRecent(readRecent());
    setTouched(false);
    setOpen(next);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const combo = event.ctrlKey || event.metaKey;
      if (!combo || (event.key !== "f" && event.key !== "k")) return;
      event.preventDefault();
      setTouched(false);
      setOpen((was) => {
        if (!was) setRecent(readRecent());
        return !was;
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetched on first open rather than at load: the map already pulls this file
  // for its own source, so by now it is usually a cache hit.
  useEffect(() => {
    if (!open || stations.length) return;
    void loadStations().then(setStations);
  }, [open, stations.length]);

  const matches = useMemo(() => {
    const wanted = normaliseName(query);
    if (!wanted) return [];

    const starts: Indexed[] = [];
    const contains: Indexed[] = [];
    for (const station of stations) {
      if (station.key.startsWith(wanted)) starts.push(station);
      else if (station.key.includes(wanted)) contains.push(station);
      if (starts.length >= LIMIT) break;
    }
    return [...starts, ...contains].slice(0, LIMIT);
  }, [stations, query]);

  const pick = useCallback(
    (station: Station) => {
      setOpen(false);
      setQuery("");
      setRecent(rememberRecent(station));
      onPick(station);
    },
    [onPick],
  );

  const clearRecent = useCallback(() => {
    forgetRecent();
    setRecent([]);
  }, []);

  const searching = query.trim().length > 0;
  const loading = !stations.length;

  return (
    <>
      <button
        type="button"
        onClick={() => show(true)}
        aria-label="Find a station"
        title="Find a station  (⌘F)"
        className="glass pointer-events-auto flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10 active:bg-foreground/15"
      >
        <MagnifyingGlassIcon size={16} weight="bold" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={show}
        title="Find a station"
        description="Search the Wiener Linien network by station name."
        className="glass-sheet"
      >
        {/* This CommandDialog drops its children straight into the dialog, so
            the cmdk root has to be supplied here or the input has no store.
            Filtering is ours: items are keyed by DIVA, which cmdk's own matcher
            would score against instead of the name. */}
        <Command
          shouldFilter={false}
          className="group/cmd bg-transparent"
          data-touched={searching || touched}
          onKeyDown={(event) => {
            if (event.key.startsWith("Arrow")) setTouched(true);
          }}
          onPointerMove={() => setTouched(true)}
        >
          <CommandInput
            placeholder={loading ? "Loading stations…" : "Search stations…"}
            value={query}
            onValueChange={setQuery}
            className="text-[0.9375rem]!"
          />

          <CommandList className="scrollbar-thin max-h-[min(24rem,58vh)] px-1">
            {searching && !matches.length && !loading && (
              <CommandEmpty>
                Nothing matching{" "}
                <span className="font-medium text-foreground">{query}</span>.
              </CommandEmpty>
            )}

            {!searching && recent.length > 0 && (
              <CommandGroup
                heading={
                  <span className="flex items-center justify-between gap-2">
                    Recent
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="cursor-pointer font-normal text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Clear
                    </button>
                  </span>
                }
              >
                {recent.map((station) => (
                  <CommandItem
                    key={station.diva}
                    value={`recent-${station.diva}`}
                    onSelect={() => pick(station)}
                    className="cursor-pointer gap-2.5 py-2 group-data-[touched=false]/cmd:data-selected:bg-transparent"
                  >
                    <Badges modes={station.modes} />
                    <Name name={station.name} query="" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!searching && !recent.length && (
              <p className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                {loading && (
                  <SpinnerGapIcon
                    size={15}
                    weight="bold"
                    className="shrink-0 motion-safe:animate-spin"
                    aria-hidden
                  />
                )}
                {loading ? "Reading the network…" : "Type a station name."}
              </p>
            )}

            {searching && matches.length > 0 && (
              <CommandGroup
                heading={`${matches.length}${
                  matches.length === LIMIT ? "+" : ""
                } station${matches.length === 1 ? "" : "s"}`}
              >
                {matches.map((station) => (
                  <CommandItem
                    key={station.diva}
                    value={String(station.diva)}
                    onSelect={() => pick(station)}
                    className="cursor-pointer gap-2.5 py-2 group-data-[touched=false]/cmd:data-selected:bg-transparent"
                  >
                    <Badges modes={station.modes} />
                    <Name name={station.name} query={query.trim()} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          <div className="flex items-center gap-2 border-t border-foreground/10 px-3 py-2 text-[0.6875rem] text-muted-foreground">
            <Key>↑↓</Key>
            <Key>↵</Key>
            <span>open</span>
            <Key>esc</Key>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
