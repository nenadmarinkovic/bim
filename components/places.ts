import type mapboxgl from "mapbox-gl";

/**
 * Clickable places, driven by Mapbox Standard's featuresets. Standard hides its
 * internal layers from `queryRenderedFeatures`, so featuresets are the only way
 * in.
 *
 * Only labelled things are interactive: POI labels and landmark icons. Building
 * footprints are deliberately left alone — the famous buildings are drawn by
 * `building-models`, a model layer Mapbox cannot query at all, so making plain
 * buildings hoverable would have Karlskirche and its neighbours behaving
 * differently for no reason a user could see. Clicking text is consistent.
 */
function resolveTargets(map: mapboxgl.Map) {
  type Descriptor = ReturnType<
    mapboxgl.Map["getFeaturesetDescriptors"]
  >[number];
  const found = new Map<string, Descriptor>();

  // Mapbox's examples pass `importId: "basemap"`, which is only right when
  // Standard is imported into a custom style. Loaded directly its featuresets
  // sit on the root, so ask for both arrangements.
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

/** Placeholder copy — swap for the real lookup; the popup takes whatever this returns. */
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
    // Mapbox warns that mouseleave needs a matching mouseenter to fire.
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

/** Landmark icons only appear close in; they were intrusive when zoomed out. */
const LANDMARK_ICON_MIN_ZOOM = 15;

/**
 * POI labels and landmark icons have to be on for there to be anything to see
 * or click. Retried on a frame loop rather than gated on `isStyleLoaded`, which
 * can be briefly false and would otherwise drop the change silently.
 */
export function setPlaceVisibility(map: mapboxgl.Map, on: boolean): () => void {
  let frame = 0;
  let attempts = 0;
  let desired: boolean | null = null;
  let applied: boolean | null = null;

  // Config writes need a loaded style. Rather than dropping the change when it
  // is momentarily busy — which used to strand the icons visible after a zoom
  // out — the wanted value is held and retried until it lands.
  const push = () => {
    if (desired === null || desired === applied) return;
    if (!map.isStyleLoaded()) {
      if (attempts++ > 600) return;
      frame = requestAnimationFrame(push);
      return;
    }
    attempts = 0;
    applied = desired;
    map.setConfigProperty("basemap", "showLandmarkIcons", desired);
  };

  const syncIcons = () => {
    desired = on && map.getZoom() >= LANDMARK_ICON_MIN_ZOOM;
    cancelAnimationFrame(frame);
    push();
  };

  const applyLabels = () => {
    if (!map.isStyleLoaded()) {
      requestAnimationFrame(applyLabels);
      return;
    }
    map.setConfigProperty("basemap", "showPointOfInterestLabels", on);
    map.setConfigProperty("basemap", "showPlaceLabels", true);
  };

  applyLabels();
  syncIcons();

  // `zoom` fires throughout the gesture, so the icons go as you pull back
  // rather than snapping out once the zoom settles.
  map.on("zoom", syncIcons);
  map.on("zoomend", syncIcons);

  return () => {
    cancelAnimationFrame(frame);
    map.off("zoom", syncIcons);
    map.off("zoomend", syncIcons);
  };
}
