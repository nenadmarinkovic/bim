"use client";

import { useCallback, useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { VEHICLES_LABEL_LAYER } from "@/components/vehicle-layer";
import { STOPS_LAYER } from "@/lib/vehicles/layer-ids";
import { cn } from "@/lib/utils";

const SWITCH_TRACK =
  "data-unchecked:bg-foreground/25 dark:data-unchecked:bg-foreground/25";

const LAYER_OPTIONS = [
  { key: "lines", label: "Line numbers", layer: VEHICLES_LABEL_LAYER },
  { key: "stops", label: "Stops", layer: STOPS_LAYER },
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
  const [visible, setVisible] = useState<Record<string, boolean>>({
    lines: true,
    stops: true,
  });
  const [places, setPlaces] = useState(false);
  const [streets, setStreets] = useState(false);

  const apply = useCallback(
    (layer: string, on: boolean) => {
      const map = getMap();
      if (!map?.getLayer(layer)) return;
      map.setLayoutProperty(layer, "visibility", on ? "visible" : "none");
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
        "glass pointer-events-auto flex flex-col gap-2.5 rounded-2xl px-3.5 py-3",
        className,
      )}
    >
      {LAYER_OPTIONS.map((option) => (
        <div
          key={option.key}
          className="flex items-center justify-between gap-6"
        >
          <Label
            htmlFor={`${id}-${option.key}`}
            className="cursor-pointer text-xs text-foreground"
          >
            {option.label}
          </Label>
          <Switch
            id={`${id}-${option.key}`}
            size="sm"
            className={SWITCH_TRACK}
            checked={visible[option.key]}
            onCheckedChange={(on) => {
              setVisible((current) => ({ ...current, [option.key]: on }));
              apply(option.layer, on);
            }}
          />
        </div>
      ))}

      <div className="flex items-center justify-between gap-6">
        <Label
          htmlFor={`${id}-places`}
          className="cursor-pointer text-xs text-foreground"
        >
          Places
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

      <div className="flex items-center justify-between gap-6">
        <Label
          htmlFor={`${id}-streets`}
          className="cursor-pointer text-xs text-foreground"
        >
          Streets
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

      <div className="mt-0.5 flex items-center justify-between gap-6 border-t border-foreground/10 pt-2.5">
        <span className="flex items-center text-xs leading-none font-medium text-foreground select-none">
          Theme
        </span>
        <ThemeToggle />
      </div>
    </div>
  );
}
