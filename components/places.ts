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
    } catch {
      // No such import in this style.
    }
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
};

const titleCase = (value: string) =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function dummyDetail(title: string, kind: string): string {
  return `A ${kind.toLowerCase()} in Vienna. Details for ${title} will be filled in from a live source.`;
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

  return { title, kind, detail: dummyDetail(title, kind), lngLat };
}

export function placePopupHtml(place: Place): string {
  const escape = (v: string) =>
    v.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
    );
  return [
    `<strong>${escape(place.title)}</strong>`,
    `<span class="bim-popup-kind">${escape(place.kind)}</span>`,
    `<span class="bim-popup-detail">${escape(place.detail)}</span>`,
  ].join("");
}

export function enablePlaces(
  map: mapboxgl.Map,
  onSelect: (place: Place | null) => void,
): () => void {
  const targets = resolveTargets(map);

  const click =
    (fallbackKind: string) =>
    (event: { feature?: FeatureLike; lngLat: mapboxgl.LngLat }) => {
      if (!event.feature) return false;
      const place = describe(event.feature, fallbackKind, event.lngLat);
      if (!place) return false;
      onSelect(place);
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
    for (const id of Object.values(IDS)) {
      try {
        map.removeInteraction(id);
      } catch {
        // Never registered, because that featureset was not exposed.
      }
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
