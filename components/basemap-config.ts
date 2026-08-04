import type mapboxgl from "mapbox-gl";

// Every basemap config write goes through here, because setConfigProperty has
// no failure of its own: given an unresolved fragment it returns having done
// nothing, and the caller is none the wiser.
//
// isStyleLoaded() is the wrong guard, in both directions. It walks the
// fragments it has, so while the basemap import is outstanding there are none
// to walk and it answers true — the window where a write is dropped reads as
// ready. Then it answers false whenever a source is mid-load, and this map
// hands the vehicle source new data every frame, so once trams are on screen it
// is false for good: a caller waiting on it waits for a lull that never comes.
// Neither answer is about the fragment, which is the only thing a config write
// needs. getConfigProperty is null until that fragment lands, so it is.
//
// Returns whether the value is now set, so a caller can keep trying.
export function pushConfig(
  map: mapboxgl.Map,
  property: string,
  value: string | boolean,
): boolean {
  try {
    const current = map.getConfigProperty("basemap", property);
    if (current === null || current === undefined) return false;
    if (current === value) return true;
    map.setConfigProperty("basemap", property, value);
    return true;
  } catch {
    return false;
  }
}
