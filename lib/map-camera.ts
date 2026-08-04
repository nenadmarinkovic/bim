export const STEPHANSDOM = { lng: 16.37317, lat: 48.20849 } as const;

export const CAMERA = { zoom: 15.5, pitch: 76, bearing: 0 } as const;

export const EMBED_CENTRE = { lng: 16.39597, lat: 48.2286 } as const;
export const EMBED_CAMERA = {
  zoom: 15.72,
  pitch: 80.0,
  bearing: -37.4,
} as const;

export const MAX_PITCH = 80;

export const MIN_ZOOM = 8.5;
export const MAX_ZOOM = 18;

// Pitch is what makes the close view read as a city instead of a diagram, and
// what makes a far one unreadable: at 76° the whole network folds into a band
// across the middle of the screen with sky above it, however far you pull back.
// So the ceiling rides the zoom — full tilt in a neighbourhood, flat by the
// time the city fits on a phone, linear in between.
export const PITCH_FULL_ZOOM = 14;
export const PITCH_FLAT_ZOOM = 11;

export function pitchCeiling(zoom: number): number {
  if (zoom >= PITCH_FULL_ZOOM) return MAX_PITCH;
  if (zoom <= PITCH_FLAT_ZOOM) return 0;
  const through =
    (zoom - PITCH_FLAT_ZOOM) / (PITCH_FULL_ZOOM - PITCH_FLAT_ZOOM);
  return MAX_PITCH * through;
}

export const NETWORK_BOUNDS: [[number, number], [number, number]] = [
  [16.15, 47.97],
  [16.6, 48.33],
];
