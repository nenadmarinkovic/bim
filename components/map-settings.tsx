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
  FOUNTAINS_LAYER,
  ROADWORKS_LABEL_LAYER,
  ROADWORKS_LINE_LAYER,
  ROADWORKS_POINT_LAYER,
  STOPS_BADGE_LAYER,
  STOPS_LAYER,
  TOILETS_LAYER,
  ZONES_FILL_LAYER,
  ZONES_LABEL_LAYER,
  ZONES_LINE_LAYER,
} from "@/lib/vehicles/layer-ids";
import { useDict } from "./locale-provider";
import { listenToParents, postToParents } from "./embed-channel";
import { LocaleSwitch } from "./locale-switch";
import { cn } from "@/lib/utils";

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
  const [zones, setZones] = useState(false);
  const [roadworks, setRoadworks] = useState(false);
  const [fountains, setFountains] = useState(false);
  const [toilets, setToilets] = useState(false);

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
    {
      key: "zones",
      label: dict.settings.zones,
      hint: dict.settings.zonesHint,
      on: zones,
      onChange: (on: boolean) => {
        setZones(on);
        apply([ZONES_FILL_LAYER, ZONES_LINE_LAYER, ZONES_LABEL_LAYER], on);
      },
    },
    {
      key: "roadworks",
      label: dict.settings.roadworks,
      hint: dict.settings.roadworksHint,
      on: roadworks,
      onChange: (on: boolean) => {
        setRoadworks(on);
        apply(
          [ROADWORKS_LINE_LAYER, ROADWORKS_POINT_LAYER, ROADWORKS_LABEL_LAYER],
          on,
        );
      },
    },
    {
      key: "fountains",
      label: dict.settings.fountains,
      hint: dict.settings.fountainsHint,
      on: fountains,
      onChange: (on: boolean) => {
        setFountains(on);
        apply([FOUNTAINS_LAYER], on);
      },
    },
    {
      key: "toilets",
      label: dict.settings.toilets,
      hint: dict.settings.toiletsHint,
      on: toilets,
      onChange: (on: boolean) => {
        setToilets(on);
        apply([TOILETS_LAYER], on);
      },
    },
  ];

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
      <div
        className={cn(
          group,
          "flex items-center justify-between gap-2",
          bare ? "mt-1" : "mt-1.5",
        )}
      >
        <span>{dict.settings.groupContext}</span>
        {views.some((view) => view.on) && (
          <button
            type="button"
            onClick={() => {
              for (const view of views) if (view.on) view.onChange(false);
            }}
            className="cursor-pointer tracking-[0.09em] uppercase transition-colors hover:text-foreground/70"
          >
            {dict.settings.clearAll}
          </button>
        )}
      </div>

      {views.map((view) => (
        <div key={view.key} className={row}>
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
