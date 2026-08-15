"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import mapboxgl from "mapbox-gl";

/**
 * Where the locate button stands. `locating` is a fix in flight, `tracking` is
 * the camera following the dot, and `found` is the dot still updating after the
 * map has been panned off it. The last three are the ways it fails, and they
 * clear themselves rather than sticking to the button.
 */
export type LocateState =
  | "idle"
  | "locating"
  | "tracking"
  | "found"
  | "denied"
  | "unavailable"
  | "outside";

// Long enough to read a line of text, short enough that the button does not
// wear the failure once the user has moved on.
const ERROR_LINGER = 6000;

function isFailure(state: LocateState): boolean {
  return state === "denied" || state === "unavailable" || state === "outside";
}

/**
 * The blue dot, run through Mapbox's own `GeolocateControl` but wearing our
 * button. The control does the watching, the marker, the accuracy circle and
 * the heading cone; `showButton: false` keeps its default chrome out of the
 * corner so the trigger can sit in the glass stack with the zoom and compass.
 *
 * Nothing here is particular to a browser tab — an installed PWA is the same
 * secure context, so the dot works the same on a home-screen launch. What it
 * cannot do is run in the background: the watch stops when the app is
 * backgrounded, which is a platform limit rather than a setting.
 */
export function useGeolocate(getMap: () => mapboxgl.Map | null) {
  const control = useRef<mapboxgl.GeolocateControl | null>(null);
  const clearFailure = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mapbox settles its own support check asynchronously and ignores a trigger
  // before it has, so an early tap is held until the control says it is ready.
  const ready = useRef(false);
  const waiting = useRef(false);
  const [state, setState] = useState<LocateState>("idle");

  // `navigator.geolocation` is missing on an insecure origin — a phone reaching
  // the dev server over plain http — and in an embed the host page has not
  // granted it. Read on the client only, so the server renders no button rather
  // than one that cannot work.
  const supported = useSyncExternalStore(
    () => () => {},
    () => "geolocation" in navigator,
    () => false,
  );

  // The Mapbox events fire outside React, and each one needs to know where the
  // button already stands, so the state is kept in a ref as well.
  const current = useRef<LocateState>("idle");
  const set = useCallback((next: LocateState) => {
    current.current = next;
    setState(next);

    if (clearFailure.current) {
      clearTimeout(clearFailure.current);
      clearFailure.current = null;
    }
    if (isFailure(next)) {
      clearFailure.current = setTimeout(() => {
        if (!isFailure(current.current)) return;
        current.current = "idle";
        setState("idle");
      }, ERROR_LINGER);
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    let detach: (() => void) | undefined;

    const attach = () => {
      const map = getMap();
      if (!map) {
        frame = requestAnimationFrame(attach);
        return;
      }

      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 0,
        },
        // Mapbox reads these afresh at every camera move, and it reads a
        // missing pitch as zero — without one the first fix would flatten the
        // map, which nothing but the centre button is allowed to do.
        fitBoundsOptions: {
          maxZoom: 16.5,
          duration: 900,
          pitch: map.getPitch(),
        },
        trackUserLocation: true,
        showUserHeading: true,
        showButton: false,
      });

      const keepPitch = () => {
        geolocate.options.fitBoundsOptions = {
          ...geolocate.options.fitBoundsOptions,
          pitch: map.getPitch(),
        };
      };

      const onGeolocate = () => {
        keepPitch();
        // A fix that lands while the map has been panned away updates the dot
        // and nothing else, so the button stays in its passive state.
        set(current.current === "found" ? "found" : "tracking");
      };

      // Fires both when the map is dragged off the dot and when the watch is
      // switched off. The click handler has already written `idle` in the
      // second case, which is what tells the two apart.
      const onEnd = () => {
        if (current.current !== "idle") set("found");
      };

      const onError = (error: GeolocationPositionError) => {
        set(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      };

      // The map is bounded to the network, so a fix outside Vienna has nowhere
      // to fly to. Mapbox declines to move and says so, and we say so too.
      const onOutOfBounds = () => set("outside");

      const onReady = () => {
        ready.current = true;
        if (!waiting.current) return;
        waiting.current = false;
        geolocate.trigger();
      };

      geolocate.on("geolocate", onGeolocate);
      geolocate.on("trackuserlocationend", onEnd);
      geolocate.on("error", onError);
      geolocate.on("outofmaxbounds", onOutOfBounds);
      geolocate.on("ready", onReady);

      map.addControl(geolocate);
      control.current = geolocate;

      detach = () => {
        geolocate.off("geolocate", onGeolocate);
        geolocate.off("trackuserlocationend", onEnd);
        geolocate.off("error", onError);
        geolocate.off("outofmaxbounds", onOutOfBounds);
        geolocate.off("ready", onReady);
        if (map.hasControl(geolocate)) map.removeControl(geolocate);
        control.current = null;
        ready.current = false;
        waiting.current = false;
      };
    };

    attach();
    return () => {
      cancelAnimationFrame(frame);
      detach?.();
      if (clearFailure.current) clearTimeout(clearFailure.current);
    };
  }, [getMap, set]);

  const trigger = useCallback(() => {
    const geolocate = control.current;
    if (!geolocate) return;

    // Written before the trigger, because Mapbox fires its events synchronously
    // and they read this to tell a switch-off from a drag away from the dot.
    switch (current.current) {
      case "locating":
      case "tracking":
        set("idle");
        break;
      case "found":
        set("tracking");
        break;
      default:
        set("locating");
    }

    // A second tap before the control is ready is a change of mind, and the
    // state written just above already records it.
    if (ready.current) geolocate.trigger();
    else waiting.current = current.current !== "idle";
  }, [set]);

  return { supported, state, trigger };
}
