import type { VehicleMode } from "./types.ts";

/** Wiener Linien's official line colours. U5 is not in service yet. */
export const METRO_COLOR: Record<string, string> = {
  U1: "#e30613",
  U2: "#a762a3",
  U3: "#ed7d00",
  U4: "#039540",
  U5: "#14a79d",
  U6: "#9d6831",
};

export const TRAM_RED = "#df021d";
export const BUS_BLUE = "#032960";
/** Defined for when S-Bahn data exists; the Wiener Linien feed has no rail routes. */
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

/**
 * Lifts a colour for the night basemap, by however much it actually needs.
 *
 * The white window band and roof carry the silhouette against the dark map, so
 * the body colour only has to stay identifiable — a heavy lift washed the bus
 * navy out to slate. Only genuinely near-black colours get lifted much.
 */
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
        : BUS_BLUE;
  return dark ? forNight(base) : base;
}

/**
 * Real fleet dimensions in metres — a six-car U-Bahn set really is 111 m, an
 * ULF tram 35 m and a Citaro bus 12 m. Extruding at true size is what makes
 * them read as Vienna vehicles rather than as generic markers.
 */
export const DIMENSIONS: Record<
  VehicleMode,
  {
    length: number;
    width: number;
    height: number;
    /** Glazing band, in metres above the rail or road. */
    windowBase: number;
    windowTop: number;
  }
> = {
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

/** Roof equipment sits proud of the body by this much. */
export const ROOF_THICKNESS = 0.18;

/** The window band and roof are white — what Vienna's fleet actually looks like. */
export const GLASS = { light: "#f4f6f9", dark: "#e6ebf3" } as const;
export const ROOF = { light: "#ffffff", dark: "#f2f5fa" } as const;

/**
 * A vehicle in tunnel is drawn washed out, because it genuinely cannot be seen
 * from the street. Mixing toward an achromatic target desaturates without
 * rotating hue, so a dimmed U3 still reads as U3 orange — mixing toward the
 * navy basemap instead dragged greens and reds up to 15 degrees off.
 */
const UNDERGROUND_MUTE = 0.55;
const TOWARD = { light: [255, 255, 255], dark: [23, 23, 25] } as const;

export function undergroundColour(hex: string, dark: boolean): string {
  const n = parseInt(hex.slice(1), 16);
  const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const target = TOWARD[dark ? "dark" : "light"];
  const mixed = base.map((c, i) =>
    Math.round(c + (target[i] - c) * UNDERGROUND_MUTE),
  );
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}
