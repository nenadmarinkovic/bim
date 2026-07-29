import type mapboxgl from "mapbox-gl";

import type { Dictionary, Locale } from "@/lib/i18n";

function resolveTargets(map: mapboxgl.Map) {
  type Descriptor = ReturnType<
    mapboxgl.Map["getFeaturesetDescriptors"]
  >[number];
  const found = new Map<string, Descriptor>();

  const collect = (importId?: string) => {
    try {
      for (const descriptor of map.getFeaturesetDescriptors(importId)) {
        if (!found.has(descriptor.featuresetId)) {
          found.set(descriptor.featuresetId, descriptor);
        }
      }
    } catch {}
  };

  collect();
  collect("basemap");

  return { poi: found.get("poi"), landmarks: found.get("landmark-icons") };
}

const IDS = {
  poiClick: "bim-poi-click",
  poiEnter: "bim-poi-enter",
  poiLeave: "bim-poi-leave",
  landmarkClick: "bim-landmark-click",
  landmarkEnter: "bim-landmark-enter",
  landmarkLeave: "bim-landmark-leave",
};

export type Place = {
  title: string;
  kind: string;
  detail: string;
  lngLat: mapboxgl.LngLatLike;
  pending?: boolean;
  described?: boolean;
};

const MINOR = new Set(["and", "or", "of", "the"]);

const titleCase = (value: string) =>
  value
    .replace(/_like$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w+/g, (word, at: number) =>
      at > 0 && MINOR.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    );

type Detail = { title: string; extract: string };

const detailKey = (place: Place, locale: Locale) =>
  `${locale}|${place.title}|${place.kind}`;

const inFlight = new Map<string, Promise<Detail | null>>();
const settled = new Map<string, Detail>();

function loadDetail(place: Place, locale: Locale): Promise<Detail | null> {
  const key = detailKey(place, locale);
  const already = inFlight.get(key);
  if (already) return already;

  const query = new URLSearchParams({
    name: place.title,
    kind: place.kind,
    lang: locale,
  });

  const request = fetch(`/api/place?${query}`)
    .then((response) =>
      response.ok ? (response.json() as Promise<Detail>) : null,
    )
    .catch(() => null)
    .then((detail) => {
      if (detail) settled.set(key, detail);
      else inFlight.delete(key);
      return detail;
    });

  inFlight.set(key, request);
  return request;
}

const DWELL_MS = 220;
const WARM_WINDOW_MS = 60_000;
const WARM_PER_WINDOW = 6;
const warmed: number[] = [];

function mayWarm(): boolean {
  const now = performance.now();
  while (warmed.length && warmed[0]! <= now - WARM_WINDOW_MS) warmed.shift();
  if (warmed.length >= WARM_PER_WINDOW) return false;
  warmed.push(now);
  return true;
}

const withDetail = (place: Place, detail: Detail): Place => ({
  ...place,
  detail: detail.extract,
  pending: false,
  described: true,
});

type FeatureLike = { properties?: Record<string, unknown> | null };

function describe(
  feature: FeatureLike,
  fallbackKind: string,
  lngLat: mapboxgl.LngLatLike,
  lookingUp: string,
): Place | null {
  const props = feature.properties ?? {};
  const title =
    (props.name_en as string) ||
    (props.name as string) ||
    (props.short_name as string) ||
    "";
  if (!title) return null;

  const kind = titleCase(
    (props.type as string) ||
      (props.class as string) ||
      (props.group as string) ||
      fallbackKind,
  );

  return { title, kind, detail: lookingUp, lngLat, pending: true };
}

export function enablePlaces(
  map: mapboxgl.Map,
  onSelect: (place: Place | null) => void,
  { dict, locale }: { dict: Dictionary; locale: Locale },
): () => void {
  const targets = resolveTargets(map);

  let ticket = 0;
  let dwell = 0;

  const click =
    (fallbackKind: string) =>
    (event: { feature?: FeatureLike; lngLat: mapboxgl.LngLat }) => {
      if (!event.feature) return false;
      const place = describe(
        event.feature,
        fallbackKind,
        event.lngLat,
        dict.place.lookingUp,
      );
      if (!place) return false;

      const mine = ++ticket;

      const known = settled.get(detailKey(place, locale));
      if (known) {
        onSelect(withDetail(place, known));
        return true;
      }

      onSelect(place);

      void loadDetail(place, locale).then((detail) => {
        if (mine !== ticket) return;
        onSelect(
          detail
            ? withDetail(place, detail)
            : { ...place, detail: "", pending: false },
        );
      });

      return true;
    };

  const pointer =
    (fallbackKind: string) =>
    (event: { feature?: FeatureLike; lngLat: mapboxgl.LngLat }) => {
      map.getCanvas().style.cursor = "pointer";

      const place = event.feature
        ? describe(
            event.feature,
            fallbackKind,
            event.lngLat,
            dict.place.lookingUp,
          )
        : null;
      if (!place || inFlight.has(detailKey(place, locale))) return true;

      clearTimeout(dwell);
      dwell = window.setTimeout(() => {
        if (mayWarm()) void loadDetail(place, locale);
      }, DWELL_MS);

      return true;
    };

  const resetPointer = () => {
    clearTimeout(dwell);
    map.getCanvas().style.cursor = "";
    return false;
  };

  if (targets.landmarks) {
    map.addInteraction(IDS.landmarkClick, {
      type: "click",
      target: targets.landmarks,
      handler: click(dict.place.landmark),
    });
    map.addInteraction(IDS.landmarkEnter, {
      type: "mouseenter",
      target: targets.landmarks,
      handler: pointer(dict.place.landmark),
    });
    map.addInteraction(IDS.landmarkLeave, {
      type: "mouseleave",
      target: targets.landmarks,
      handler: resetPointer,
    });
  }

  if (targets.poi) {
    map.addInteraction(IDS.poiClick, {
      type: "click",
      target: targets.poi,
      handler: click(dict.place.place),
    });
    map.addInteraction(IDS.poiEnter, {
      type: "mouseenter",
      target: targets.poi,
      handler: pointer(dict.place.place),
    });
    map.addInteraction(IDS.poiLeave, {
      type: "mouseleave",
      target: targets.poi,
      handler: resetPointer,
    });
  }

  return () => {
    ticket++;
    clearTimeout(dwell);

    for (const id of Object.values(IDS)) {
      try {
        map.removeInteraction(id);
      } catch {}
    }
    map.getCanvas().style.cursor = "";
    onSelect(null);
  };
}

export function setPlaceVisibility(map: mapboxgl.Map, on: boolean): () => void {
  let frame = 0;
  let attempts = 0;

  const apply = () => {
    if (!map.isStyleLoaded()) {
      if (attempts++ > 600) return;
      frame = requestAnimationFrame(apply);
      return;
    }
    map.setConfigProperty("basemap", "showPointOfInterestLabels", on);
    map.setConfigProperty("basemap", "showPlaceLabels", true);
    map.setConfigProperty("basemap", "showLandmarkIcons", false);
    map.setConfigProperty("basemap", "showLandmarkIconLabels", false);
  };

  apply();
  return () => cancelAnimationFrame(frame);
}
