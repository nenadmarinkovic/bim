import type mapboxgl from "mapbox-gl";

import { BUS_BLUE, TRAM_RED } from "@/lib/vehicles/colors";

export const STATION_MODES = ["metro", "train", "tram", "bus"] as const;

export type StationMode = (typeof STATION_MODES)[number];

// Wiener Linien's own U and S marks, inlined so a popup never waits on a
// request and the map can rasterise them without one either.
const UBAHN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="200" fill="#0081c9"/><path fill="#fff" d="m172.75 364.78c-36.647-11.257-75.155-30.988-92.265-67.24-15.551-31.99-11.139-68.672-12.254-103.06-0.062434-41.015-0.056895-82.03-0.05848-123.05 29.692-0.03344 59.383-0.06687 89.075-0.10031 0.14528 57.408-0.29178 114.84 0.2208 172.23 1.7868 25.997 30.641 45.043 55.255 36.466 19.687-5.6518 32.159-26.376 30.044-46.393 1e-5 -54.101 1e-5 -108.2 2e-5 -162.3 29.692 0.03344 59.383 0.06687 89.075 0.10031-0.35735 58.909 0.8038 117.85-0.9706 176.74-0.44176 32.821-14.409 66.065-41.181 85.947-22.415 16.189-48.302 28.998-75.819 33.238-13.676 1.1415-27.72 0.49602-41.122-2.5722z"/></svg>`;

const SBAHN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 86.82 86.82"><circle cx="43.41" cy="43.41" r="43.41" fill="#fff"/><path fill="#0097D9" d="M56.6,4.06l-15,18.76c-3.079,3.873-2.454,9.506,1.4,12.61l11.67,9.41c7.147,5.73,8.302,16.166,2.58,23.32L43.83,84.94c22.929-0.259,41.307-19.057,41.048-41.987C84.678,25.298,73.335,9.7,56.6,4.07"/><path fill="#0097D9" d="M45.19,64.03c3.072-3.872,2.447-9.497-1.4-12.6l-11.7-9.37c-7.16-5.725-8.324-16.169-2.6-23.33L42.96,1.91C20.036,2.131,1.631,20.894,1.852,43.818C2.023,61.517,13.397,77.16,30.18,82.78L45.19,64.03z"/></svg>`;

// Phosphor's filled tram and bus, on the colour their vehicles are drawn in.
const GLYPH: Record<"tram" | "bus", string> = {
  tram: "M184,48H136V24h32a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h32V48H72A32,32,0,0,0,40,80V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V80A32,32,0,0,0,184,48Zm0,152H72a16,16,0,0,1-16-16V128H200v56A16,16,0,0,1,184,200ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z",
  bus: "M248,80v24a8,8,0,0,1-16,0V80a8,8,0,0,1,16,0ZM16,72a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V80A8,8,0,0,0,16,72Zm200-8V208a16,16,0,0,1-16,16H184a16,16,0,0,1-16-16v-8H88v8a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V64A32,32,0,0,1,72,32H184A32,32,0,0,1,216,64ZM104,148a12,12,0,1,0-12,12A12,12,0,0,0,104,148Zm72,0a12,12,0,1,0-12,12A12,12,0,0,0,176,148Zm24-76H56v40H200Z",
};

// From the shared palette, so a badge and its vehicles cannot drift apart.
const GLYPH_FILL: Record<"tram" | "bus", string> = {
  tram: TRAM_RED,
  bus: BUS_BLUE,
};

// The glyph sits inside the disc rather than filling it — but not by much. At a
// fourteen pixel badge every tenth of this is a pixel of tram, and Phosphor's
// wheels and windows are the first thing to disappear.
const GLYPH_INSET = 0.68;

export function badgeMarkup(mode: StationMode, px: number): string {
  if (mode === "metro") return sized(UBAHN, px);
  if (mode === "train") return sized(SBAHN, px);

  const g = 256 * GLYPH_INSET;
  const offset = (256 - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${px}" height="${px}"><circle cx="128" cy="128" r="128" fill="${GLYPH_FILL[mode]}"/><g transform="translate(${offset} ${offset}) scale(${GLYPH_INSET})"><path fill="#fff" d="${GLYPH[mode]}"/></g></svg>`;
}

const sized = (svg: string, px: number) =>
  svg.replace("<svg ", `<svg width="${px}" height="${px}" `);

// Every ordered subset, so a station's own `modes` string names its image.
export function modeCombinations(): StationMode[][] {
  const out: StationMode[][] = [];
  for (let mask = 1; mask < 1 << STATION_MODES.length; mask++) {
    out.push(STATION_MODES.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

export const stopImageId = (modes: string) => `bim-stop-${modes}`;

// Drawn at four device pixels per CSS pixel. A retina screen already needs two,
// and icon-size lifts them to 1.2 when zoomed in, so anything less is being
// enlarged from too little detail — which is what made the glyphs mushy. Every
// measurement below stays a whole number of pixels at this ratio.
const RATIO = 4;
const BADGE = 14 * RATIO;
const GAP = 1.5 * RATIO;
// Just enough light rim to keep a dark badge off a dark basemap; any more and
// it reads as a ring around the icon rather than a gap behind it.
const RIM = 0.5 * RATIO;

async function rasterise(
  svg: string,
  size: number,
): Promise<CanvasImageSource> {
  const image = new Image(size, size);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

async function paintBadge(
  ctx: CanvasRenderingContext2D,
  mode: StationMode,
  x: number,
) {
  const middle = BADGE / 2;

  ctx.beginPath();
  ctx.arc(x + middle, middle, middle, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const inner = BADGE - RIM * 2;
  // Rasterised at its final pixel size, never scaled up afterwards.
  const markup = badgeMarkup(mode, inner);
  ctx.drawImage(await rasterise(markup, inner), x + RIM, RIM, inner, inner);
}

export async function installStopIcons(map: mapboxgl.Map): Promise<void> {
  for (const modes of modeCombinations()) {
    const id = stopImageId(modes.join(","));
    if (map.hasImage(id)) continue;

    const width = modes.length * BADGE + (modes.length - 1) * GAP;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = BADGE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";

    for (let i = 0; i < modes.length; i++) {
      await paintBadge(ctx, modes[i]!, i * (BADGE + GAP));
    }

    if (map.hasImage(id)) continue;
    map.addImage(id, ctx.getImageData(0, 0, width, BADGE), {
      pixelRatio: RATIO,
    });
  }
}
