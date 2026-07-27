import type mapboxgl from "mapbox-gl";

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

const LANG = "en";

type Detail = { title: string; extract: string };

async function fetchDetail(
  place: Place,
  signal: AbortSignal,
): Promise<Detail | null> {
  const query = new URLSearchParams({
    name: place.title,
    kind: place.kind,
    lang: LANG,
  });

  try {
    const response = await fetch(`/api/place?${query}`, { signal });
    if (!response.ok) return null;
    return (await response.json()) as Detail;
  } catch {
    return null;
  }
}

type FeatureLike = { properties?: Record<string, unknown> | null };

function describe(
  feature: FeatureLike,
  fallbackKind: string,
  lngLat: mapboxgl.LngLatLike,
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

  return { title, kind, detail: "Looking up…", lngLat, pending: true };
}

export function enablePlaces(
  map: mapboxgl.Map,
  onSelect: (place: Place | null) => void,
): () => void {
  const targets = resolveTargets(map);

  // Clicks outrun the network; a stale response would caption the wrong place.
  let ticket = 0;
  let inFlight: AbortController | null = null;

  const click =
    (fallbackKind: string) =>
    (event: { feature?: FeatureLike; lngLat: mapboxgl.LngLat }) => {
      if (!event.feature) return false;
      const place = describe(event.feature, fallbackKind, event.lngLat);
      if (!place) return false;

      const mine = ++ticket;
      inFlight?.abort();
      inFlight = new AbortController();

      onSelect(place);

      void fetchDetail(place, inFlight.signal).then((detail) => {
        if (mine !== ticket) return;
        onSelect(
          detail
            ? {
                ...place,
                detail: detail.extract,
                pending: false,
                described: true,
              }
            : // Declined or failed: drop the line rather than show filler.
              { ...place, detail: "", pending: false },
        );
      });

      return true;
    };

  const pointer = () => {
    map.getCanvas().style.cursor = "pointer";
    return true;
  };
  const resetPointer = () => {
    map.getCanvas().style.cursor = "";
    return false;
  };

  if (targets.landmarks) {
    map.addInteraction(IDS.landmarkClick, {
      type: "click",
      target: targets.landmarks,
      handler: click("Landmark"),
    });
    map.addInteraction(IDS.landmarkEnter, {
      type: "mouseenter",
      target: targets.landmarks,
      handler: pointer,
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
      handler: click("Place"),
    });
    map.addInteraction(IDS.poiEnter, {
      type: "mouseenter",
      target: targets.poi,
      handler: pointer,
    });
    map.addInteraction(IDS.poiLeave, {
      type: "mouseleave",
      target: targets.poi,
      handler: resetPointer,
    });
  }

  return () => {
    ticket++;
    inFlight?.abort();

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
