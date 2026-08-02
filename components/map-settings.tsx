"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SWITCH_TRACK } from "@/components/ui/switch-classes";
import { ThemeToggle } from "@/components/theme-toggle";
import { VEHICLES_LABEL_LAYER } from "@/components/vehicle-layer";
import {
  BIKES_CASING_LAYER,
  BIKES_LAYER,
  BIKES_SOFT_LAYER,
  DISTRICTS_FILL_LAYER,
  DISTRICTS_LABEL_LAYER,
  DISTRICTS_LINE_LAYER,
  STOPS_BADGE_LAYER,
  STOPS_LAYER,
} from "@/lib/vehicles/layer-ids";
import { useDict } from "./locale-provider";
import { listenToParents, postToParents } from "./embed-channel";
import { LocaleSwitch } from "./locale-switch";
import { cn } from "@/lib/utils";

// A row is a thumb-sized target on a phone and tightens to the pointer-sized
// one once there is a pointer to aim with.
const ROW = "flex min-h-11 items-center justify-between gap-4 md:min-h-10";

const LABEL = "text-sm leading-none font-medium text-foreground select-none";

const GROUP =
  "mt-3 mb-1 text-[0.625rem] font-semibold tracking-[0.09em] text-foreground/40 uppercase select-none";

const LAYER_OPTIONS = [
  { key: "lines", layers: [VEHICLES_LABEL_LAYER] },
  { key: "stops", layers: [STOPS_LAYER, STOPS_BADGE_LAYER] },
] as const;

const EMPTY: string[] = [];

export type SettingsView = {
  key: string;
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
};

// The panel is drawn twice — as the desktop card and inside the phone's menu
// sheet — so the state lives here, above both, and the map calls happen once.
export function useMapSettings({
  getMap,
  onPlacesChange,
  embed = false,
  parents = EMPTY,
}: {
  getMap: () => mapboxgl.Map | null;
  onPlacesChange: (on: boolean) => void;
  embed?: boolean;
  parents?: string[];
}): SettingsView[] {
  const dict = useDict();
  const [visible, setVisible] = useState<Record<string, boolean>>({
    lines: true,
    stops: true,
  });
  const [places, setPlaces] = useState(embed);
  const [streets, setStreets] = useState(false);
  const [districts, setDistricts] = useState(false);
  const [bikes, setBikes] = useState(false);

  const apply = useCallback(
    (layers: readonly string[], on: boolean) => {
      const map = getMap();
      if (!map) return;
      for (const layer of layers) {
        if (!map.getLayer(layer)) continue;
        map.setLayoutProperty(layer, "visibility", on ? "visible" : "none");
      }
    },
    [getMap],
  );

  const applyConfig = useCallback(
    (property: string, value: boolean) => {
      const map = getMap();
      if (!map) return;
      let attempts = 0;
      const push = () => {
        if (!map.isStyleLoaded()) {
          if (attempts++ < 120) requestAnimationFrame(push);
          return;
        }
        map.setConfigProperty("basemap", property, value);
      };
      push();
    },
    [getMap],
  );

  const views: SettingsView[] = [
    ...LAYER_OPTIONS.map((option) => ({
      key: option.key as string,
      label: dict.settings[option.key],
      hint: dict.settings[`${option.key}Hint`],
      on: visible[option.key],
      onChange: (on: boolean) => {
        setVisible((current) => ({ ...current, [option.key]: on }));
        apply(option.layers, on);
      },
    })),
    {
      key: "places",
      label: dict.settings.places,
      hint: dict.settings.placesHint,
      on: places,
      onChange: (on: boolean) => {
        setPlaces(on);
        onPlacesChange(on);
      },
    },
    {
      key: "streets",
      label: dict.settings.streets,
      hint: dict.settings.streetsHint,
      on: streets,
      onChange: (on: boolean) => {
        setStreets(on);
        applyConfig("showRoadLabels", on);
      },
    },
    {
      key: "districts",
      label: dict.settings.districts,
      hint: dict.settings.districtsHint,
      on: districts,
      onChange: (on: boolean) => {
        setDistricts(on);
        apply(
          [DISTRICTS_FILL_LAYER, DISTRICTS_LINE_LAYER, DISTRICTS_LABEL_LAYER],
          on,
        );
      },
    },
    {
      key: "bikes",
      label: dict.settings.bikes,
      hint: dict.settings.bikesHint,
      on: bikes,
      onChange: (on: boolean) => {
        setBikes(on);
        apply([BIKES_CASING_LAYER, BIKES_SOFT_LAYER, BIKES_LAYER], on);
      },
    },
  ];

  // Embedded, the panel is the host page's to draw: it publishes what it has —
  // keys, labels, hints and current state, already in the frame's language —
  // and takes the toggles back over the same channel. The state and the map
  // calls stay here, so a layer added below turns up in the host for free.
  const latest = useRef(views);
  useEffect(() => {
    latest.current = views;
  });

  useEffect(() => {
    if (!embed) return;
    return listenToParents(parents, (data) => {
      if (data.type !== "control" || typeof data.on !== "boolean") return;
      latest.current.find((view) => view.key === data.key)?.onChange(data.on);
    });
  }, [embed, parents]);

  const published = JSON.stringify(
    views.map((view) => ({
      key: view.key,
      label: view.label,
      hint: view.hint,
      on: view.on,
    })),
  );

  useEffect(() => {
    if (!embed) return;
    postToParents(parents, {
      type: "controls",
      controls: JSON.parse(published),
    });
  }, [embed, parents, published]);

  return views;
}

export function MapSettings({
  views,
  bare = false,
  className,
}: {
  views: SettingsView[];
  bare?: boolean;
  className?: string;
}) {
  const id = useId();
  const dict = useDict();

  // In the sheet a row carries its hint as a second line, so it needs the room
  // to breathe and the switch pinned to the label rather than to the pair.
  const row = cn(ROW, bare && "min-h-12 items-start gap-5 py-2");
  const group = cn(GROUP, bare && "mt-5 mb-2");

  return (
    <div
      className={cn(
        "flex flex-col",
        bare
          ? "w-full"
          : "glass scrollbar-thin pointer-events-auto max-h-[calc(100dvh-9.5rem)] w-56 overflow-y-auto rounded-2xl px-4 pt-1.5 pb-3",
        className,
      )}
    >
      <p className={cn(group, bare ? "mt-1" : "mt-1.5")}>
        {dict.settings.groupContext}
      </p>

      {views.map((view) => (
        <div key={view.key} className={row}>
          {/* A tooltip wants a pointer to hover with. In the phone's menu there
              is none, so the hint sits under the label rather than waiting for
              one that never arrives. */}
          {bare ? (
            <label
              htmlFor={`${id}-${view.key}`}
              className={cn(LABEL, "grid min-w-0 gap-1.5 pt-1 leading-snug")}
            >
              {view.label}
              <span className="text-xs font-normal text-muted-foreground">
                {view.hint}
              </span>
            </label>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <label
                    htmlFor={`${id}-${view.key}`}
                    className={cn(LABEL, "cursor-pointer")}
                  />
                }
              >
                {view.label}
              </TooltipTrigger>
              <TooltipContent side="right">{view.hint}</TooltipContent>
            </Tooltip>
          )}
          <Switch
            id={`${id}-${view.key}`}
            size="sm"
            className={cn(SWITCH_TRACK, bare && "mt-1.5 shrink-0")}
            checked={view.on}
            onCheckedChange={view.onChange}
          />
        </div>
      ))}

      <p className={group}>{dict.settings.groupApp}</p>

      <div className={cn(ROW, bare && "min-h-12")}>
        <span className={LABEL}>{dict.settings.theme}</span>
        <ThemeToggle />
      </div>

      <div className={cn(ROW, bare && "min-h-12")}>
        <span className={LABEL}>{dict.settings.language}</span>
        <LocaleSwitch />
      </div>
    </div>
  );
}
