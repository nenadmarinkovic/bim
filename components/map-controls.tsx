"use client";

import { useEffect, useRef } from "react";
import {
  CircleNotchIcon,
  CompassIcon,
  CrosshairIcon,
  MinusIcon,
  NavigationArrowIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import type mapboxgl from "mapbox-gl";

import { CAMERA, STEPHANSDOM } from "@/lib/map-camera";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDict } from "./locale-provider";
import { useGeolocate } from "./use-geolocate";
import { cn } from "@/lib/utils";

export function MapControls({
  getMap,
  className,
}: {
  getMap: () => mapboxgl.Map | null;
  className?: string;
}) {
  const needle = useRef<SVGSVGElement>(null);
  const dict = useDict();
  const locate = useGeolocate(getMap);

  const following = locate.state === "tracking" || locate.state === "found";
  const failure =
    locate.state === "denied"
      ? dict.map.locateDenied
      : locate.state === "unavailable"
        ? dict.map.locateUnavailable
        : locate.state === "outside"
          ? dict.map.locateOutside
          : null;

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
    <div className={cn("flex flex-col items-end gap-2", className)}>
      {failure && (
        <p
          role="status"
          className="glass pointer-events-none max-w-[min(15rem,70vw)] rounded-2xl px-3 py-1.5 text-right text-xs text-muted-foreground"
        >
          {failure}
        </p>
      )}
      <div className="glass pointer-events-auto flex flex-col overflow-hidden rounded-full">
        <Tooltip>
          <TooltipTrigger
            aria-label={dict.map.zoomIn}
            onClick={() => getMap()?.zoomIn()}
            className={button}
          >
            <PlusIcon size={16} weight="bold" />
          </TooltipTrigger>
          <TooltipContent side="left">{dict.map.zoomIn}</TooltipContent>
        </Tooltip>
        <span className="h-px w-full bg-foreground/10" />
        <Tooltip>
          <TooltipTrigger
            aria-label={dict.map.zoomOut}
            onClick={() => getMap()?.zoomOut()}
            className={button}
          >
            <MinusIcon size={16} weight="bold" />
          </TooltipTrigger>
          <TooltipContent side="left">{dict.map.zoomOut}</TooltipContent>
        </Tooltip>
        <span className="h-px w-full bg-foreground/10" />
        <Tooltip>
          <TooltipTrigger
            aria-label={dict.map.alignNorth}
            onClick={() =>
              getMap()?.easeTo({ bearing: CAMERA.bearing, duration: 500 })
            }
            className={button}
          >
            <CompassIcon size={16} weight="regular" ref={needle} />
          </TooltipTrigger>
          <TooltipContent side="left">{dict.map.alignNorth}</TooltipContent>
        </Tooltip>
        <span className="h-px w-full bg-foreground/10" />
        <Tooltip>
          <TooltipTrigger
            aria-label={dict.map.centre}
            onClick={() =>
              // The whole opening camera, not just where it pointed: pulling out
              // far enough flattens the map and nothing puts the tilt back, so
              // this is the way home to the view the app opens on.
              getMap()?.flyTo({
                center: [STEPHANSDOM.lng, STEPHANSDOM.lat],
                zoom: CAMERA.zoom,
                pitch: CAMERA.pitch,
                bearing: CAMERA.bearing,
                duration: 1200,
              })
            }
            className={button}
          >
            <CrosshairIcon size={16} weight="regular" />
          </TooltipTrigger>
          <TooltipContent side="left">{dict.map.centre}</TooltipContent>
        </Tooltip>
        {/* Absent where the browser has no geolocation to offer — an insecure
            origin, or an embed the host page has not allowed it in. */}
        {locate.supported && (
          <>
            <span className="h-px w-full bg-foreground/10" />
            <Tooltip>
              <TooltipTrigger
                aria-label={following ? dict.map.locateStop : dict.map.locate}
                aria-pressed={following}
                onClick={locate.trigger}
                className={cn(button, following && "text-brand")}
              >
                {locate.state === "locating" ? (
                  <CircleNotchIcon
                    size={16}
                    weight="bold"
                    className="animate-spin"
                  />
                ) : (
                  <NavigationArrowIcon
                    size={16}
                    weight={locate.state === "tracking" ? "fill" : "regular"}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent side="left">
                {following ? dict.map.locateStop : dict.map.locate}
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
