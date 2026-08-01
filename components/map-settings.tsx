"use client";

import { useCallback, useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { SWITCH_TRACK } from "@/components/ui/switch-classes";
import { ThemeToggle } from "@/components/theme-toggle";
import { VEHICLES_LABEL_LAYER } from "@/components/vehicle-layer";
import {
  DISTRICTS_FILL_LAYER,
  DISTRICTS_LABEL_LAYER,
  DISTRICTS_LINE_LAYER,
  STOPS_BADGE_LAYER,
  STOPS_LAYER,
} from "@/lib/vehicles/layer-ids";
import { useDict } from "./locale-provider";
import { LocaleSwitch } from "./locale-switch";
import { cn } from "@/lib/utils";

const ROW = "flex min-h-9 items-center justify-between gap-4";

const LABEL =
  "text-[0.8125rem] leading-none font-medium text-foreground select-none";

const LAYER_OPTIONS = [
  { key: "lines", layers: [VEHICLES_LABEL_LAYER] },
  { key: "stops", layers: [STOPS_LAYER, STOPS_BADGE_LAYER] },
] as const;

export function MapSettings({
  getMap,
  onPlacesChange,
  className,
}: {
  getMap: () => mapboxgl.Map | null;
  onPlacesChange: (on: boolean) => void;
  className?: string;
}) {
  const id = useId();
  const dict = useDict();
  const [visible, setVisible] = useState<Record<string, boolean>>({
    lines: true,
    stops: true,
  });
  const [places, setPlaces] = useState(false);
  const [streets, setStreets] = useState(false);
  const [districts, setDistricts] = useState(false);

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

  return (
    <div
      className={cn(
        "glass pointer-events-auto flex w-56 flex-col rounded-2xl px-3.5 py-1.5",
        className,
      )}
    >
      {LAYER_OPTIONS.map((option) => (
        <div key={option.key} className={ROW}>
          <Label
            htmlFor={`${id}-${option.key}`}
            className={cn(LABEL, "cursor-pointer")}
          >
            {dict.settings[option.key]}
          </Label>
          <Switch
            id={`${id}-${option.key}`}
            size="sm"
            className={SWITCH_TRACK}
            checked={visible[option.key]}
            onCheckedChange={(on) => {
              setVisible((current) => ({ ...current, [option.key]: on }));
              apply(option.layers, on);
            }}
          />
        </div>
      ))}

      <div className={ROW}>
        <Label htmlFor={`${id}-places`} className={cn(LABEL, "cursor-pointer")}>
          {dict.settings.places}
        </Label>
        <Switch
          id={`${id}-places`}
          size="sm"
          className={SWITCH_TRACK}
          checked={places}
          onCheckedChange={(on) => {
            setPlaces(on);
            onPlacesChange(on);
          }}
        />
      </div>

      <div className={ROW}>
        <Label
          htmlFor={`${id}-streets`}
          className={cn(LABEL, "cursor-pointer")}
        >
          {dict.settings.streets}
        </Label>
        <Switch
          id={`${id}-streets`}
          size="sm"
          className={SWITCH_TRACK}
          checked={streets}
          onCheckedChange={(on) => {
            setStreets(on);
            applyConfig("showRoadLabels", on);
          }}
        />
      </div>

      <div className={ROW}>
        <Label
          htmlFor={`${id}-districts`}
          className={cn(LABEL, "cursor-pointer")}
        >
          {dict.settings.districts}
        </Label>
        <Switch
          id={`${id}-districts`}
          size="sm"
          className={SWITCH_TRACK}
          checked={districts}
          onCheckedChange={(on) => {
            setDistricts(on);
            apply(
              [
                DISTRICTS_FILL_LAYER,
                DISTRICTS_LINE_LAYER,
                DISTRICTS_LABEL_LAYER,
              ],
              on,
            );
          }}
        />
      </div>

      <Separator className="my-2 bg-foreground/10" />

      <div className={ROW}>
        <span className={LABEL}>{dict.settings.theme}</span>
        <ThemeToggle />
      </div>

      <div className={ROW}>
        <span className={LABEL}>{dict.settings.language}</span>
        <LocaleSwitch />
      </div>
    </div>
  );
}
