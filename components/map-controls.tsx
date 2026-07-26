"use client";

import { useEffect, useRef } from "react";
import {
  CompassIcon,
  CrosshairIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import type mapboxgl from "mapbox-gl";

import { CAMERA, STEPHANSDOM } from "@/lib/map-camera";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function MapControls({
  getMap,
  className,
}: {
  getMap: () => mapboxgl.Map | null;
  className?: string;
}) {
  const needle = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let frame = 0;
    let detach: (() => void) | undefined;

    const attach = () => {
      const map = getMap();
      if (!map) {
        frame = requestAnimationFrame(attach);
        return;
      }
      const spin = () => {
        needle.current?.style.setProperty(
          "transform",
          `rotate(${-map.getBearing()}deg)`,
        );
      };
      map.on("rotate", spin);
      spin();
      detach = () => map.off("rotate", spin);
    };

    attach();
    return () => {
      cancelAnimationFrame(frame);
      detach?.();
    };
  }, [getMap]);

  const button =
    "flex size-9 items-center justify-center text-foreground transition-colors hover:bg-foreground/10 active:bg-foreground/15";

  return (
    <div
      className={cn(
        "glass pointer-events-auto flex flex-col overflow-hidden rounded-full",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          aria-label="Zoom in"
          onClick={() => getMap()?.zoomIn()}
          className={button}
        >
          <PlusIcon size={16} weight="bold" />
        </TooltipTrigger>
        <TooltipContent side="left">Zoom in</TooltipContent>
      </Tooltip>
      <span className="h-px w-full bg-foreground/10" />
      <Tooltip>
        <TooltipTrigger
          aria-label="Zoom out"
          onClick={() => getMap()?.zoomOut()}
          className={button}
        >
          <MinusIcon size={16} weight="bold" />
        </TooltipTrigger>
        <TooltipContent side="left">Zoom out</TooltipContent>
      </Tooltip>
      <span className="h-px w-full bg-foreground/10" />
      <Tooltip>
        <TooltipTrigger
          aria-label="Align north"
          onClick={() =>
            getMap()?.easeTo({ bearing: CAMERA.bearing, duration: 500 })
          }
          className={button}
        >
          <CompassIcon size={16} weight="regular" ref={needle} />
        </TooltipTrigger>
        <TooltipContent side="left">Align north</TooltipContent>
      </Tooltip>
      <span className="h-px w-full bg-foreground/10" />
      <Tooltip>
        <TooltipTrigger
          aria-label="Centre on Stephansdom"
          onClick={() =>
            getMap()?.flyTo({
              center: [STEPHANSDOM.lng, STEPHANSDOM.lat],
              zoom: CAMERA.zoom,
              duration: 1200,
            })
          }
          className={button}
        >
          <CrosshairIcon size={16} weight="regular" />
        </TooltipTrigger>
        <TooltipContent side="left">Centre on Stephansdom</TooltipContent>
      </Tooltip>
    </div>
  );
}
