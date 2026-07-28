export const STEPHANSDOM = { lng: 16.37317, lat: 48.20849 } as const;

// Pitched far enough that the horizon and a band of sky sit in frame on load —
// the city reads as somewhere you are standing in rather than a plan of itself.
export const CAMERA = { zoom: 15.5, pitch: 76, bearing: 0 } as const;

export const MAX_PITCH = 80;

export const NETWORK_BOUNDS: [[number, number], [number, number]] = [
  [16.15, 47.97],
  [16.6, 48.33],
];
