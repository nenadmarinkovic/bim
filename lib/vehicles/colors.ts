import type { VehicleMode } from "./types.ts";

// Wiener Linien's published line colours.
export const METRO_COLOR: Record<string, string> = {
  U1: "#e3000f",
  U2: "#a862a4",
  U3: "#ef7c00",
  U4: "#00963f",
  U5: "#008f95",
  U6: "#9d6830",
};

// Vienna Red: the paint on the trams themselves, and on the buses too. Buses
// take their signage blue instead, because a map that draws both in one red
// cannot tell them apart.
export const TRAM_RED = "#e3000f";
export const BUS_BLUE = "#009bac";
export const SBAHN_BLUE = "#009ddd";

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const hexOf = (c: number) => mix(c).toString(16).padStart(2, "0");
  return `#${hexOf((n >> 16) & 255)}${hexOf((n >> 8) & 255)}${hexOf(n & 255)}`;
}

const NIGHT_LUMINANCE_FLOOR = 0.1;

export function forNight(hex: string): string {
  let amount = 0.08;
  let out = lighten(hex, amount);
  while (relativeLuminance(out) < NIGHT_LUMINANCE_FLOOR && amount < 0.75) {
    amount += 0.04;
    out = lighten(hex, amount);
  }
  return out;
}

export function vehicleColour(
  mode: VehicleMode,
  line: string,
  dark: boolean,
): string {
  const base =
    mode === "metro"
      ? (METRO_COLOR[line] ?? TRAM_RED)
      : mode === "tram"
        ? TRAM_RED
        : mode === "train"
          ? SBAHN_BLUE
          : BUS_BLUE;
  return dark ? forNight(base) : base;
}

export const DIMENSIONS: Record<
  VehicleMode,
  {
    length: number;
    width: number;
    height: number;
    windowBase: number;
    windowTop: number;
  }
> = {
  // A Wiener S-Bahn set is a 4746/8073 double-decker pair or a Talent — longer
  // than a U-Bahn train and wider than a tram.
  train: {
    length: 132,
    width: 3.0,
    height: 4.6,
    windowBase: 1.7,
    windowTop: 3.4,
  },
  metro: {
    length: 111,
    width: 2.85,
    height: 3.5,
    windowBase: 1.5,
    windowTop: 2.7,
  },
  tram: {
    length: 35,
    width: 2.4,
    height: 3.4,
    windowBase: 1.4,
    windowTop: 2.6,
  },
  bus: {
    length: 12,
    width: 2.55,
    height: 3.0,
    windowBase: 1.5,
    windowTop: 2.5,
  },
};

export const ROOF_THICKNESS = 0.18;

export const GLASS = { light: "#f4f6f9", dark: "#e6ebf3" } as const;
export const ROOF = { light: "#ffffff", dark: "#f2f5fa" } as const;

const UNDERGROUND_MUTE = 0.55;
const TOWARD = { light: [255, 255, 255], dark: [23, 23, 25] } as const;

// Mixing toward achromatic desaturates without rotating hue, so a dimmed U3 still reads orange.
export function undergroundColour(hex: string, dark: boolean): string {
  const n = parseInt(hex.slice(1), 16);
  const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const target = TOWARD[dark ? "dark" : "light"];
  const mixed = base.map((c, i) =>
    Math.round(c + (target[i] - c) * UNDERGROUND_MUTE),
  );
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}
