export const STEPHANSDOM = { lng: 16.37317, lat: 48.20849 } as const;

export const CAMERA = { zoom: 15.5, pitch: 70, bearing: 0 } as const;

export const MAX_PITCH = 80;

/**
 * Panning limit, sized to the network rather than to the city.
 *
 * Wiener Linien stops are all inside Vienna, but the Badner Bahn's track runs
 * south to Baden at 47.999 N — clamping to the city limits would fence off a
 * line that is genuinely in service. This is the data's own bounding box with
 * roughly 3 km of padding.
 */
export const NETWORK_BOUNDS: [[number, number], [number, number]] = [
  [16.15, 47.97],
  [16.6, 48.33],
];
