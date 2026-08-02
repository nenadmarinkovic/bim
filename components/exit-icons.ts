import type mapboxgl from "mapbox-gl";

import { WHEELCHAIR as WHEELCHAIR_PATH } from "./glyphs";

const DISC = "#1a3a6b";

const RING = "#ffffff";

const INK = "#ffffff";

const WHEELCHAIR = `<g transform="translate(51.2 51.2) scale(0.6)"><path fill="${INK}" d="${WHEELCHAIR_PATH}"/></g>`;

const STAIRS = `<g transform="translate(33.28 33.28) scale(0.74)"><path fill="${INK}" d="M252,56a12,12,0,0,1-12,12H196v36a12,12,0,0,1-12,12H140v36a12,12,0,0,1-12,12H84v36a12,12,0,0,1-12,12H16a12,12,0,0,1,0-24H60V152a12,12,0,0,1,12-12h44V104a12,12,0,0,1,12-12h44V56a12,12,0,0,1,12-12h56A12,12,0,0,1,252,56Z"/></g>`;

const GLYPH = {
  free: WHEELCHAIR,
  steps: STAIRS,
  unknown: "",
} as const;

export type ExitIcon = keyof typeof GLYPH;

export const EXIT_ICONS = Object.keys(GLYPH) as ExitIcon[];

export const exitImageId = (icon: ExitIcon) => `bim-exit-${icon}`;

const RATIO = 4;

const BADGE = 18 * RATIO;

function markup(icon: ExitIcon, px: number): string {
  const glyph = GLYPH[icon];

  const radius = glyph ? 119 : 86;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${px}" height="${px}"><circle cx="128" cy="128" r="${radius}" fill="${DISC}" stroke="${RING}" stroke-width="12"/>${glyph}</svg>`;
}

async function rasterise(
  svg: string,
  size: number,
): Promise<CanvasImageSource> {
  const image = new Image(size, size);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

export async function installExitIcons(map: mapboxgl.Map): Promise<void> {
  for (const icon of EXIT_ICONS) {
    const id = exitImageId(icon);
    if (map.hasImage(id)) continue;

    const canvas = document.createElement("canvas");
    canvas.width = BADGE;
    canvas.height = BADGE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      await rasterise(markup(icon, BADGE), BADGE),
      0,
      0,
      BADGE,
      BADGE,
    );

    if (map.hasImage(id)) continue;
    map.addImage(id, ctx.getImageData(0, 0, BADGE, BADGE), {
      pixelRatio: RATIO,
    });
  }
}
