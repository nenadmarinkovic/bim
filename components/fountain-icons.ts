import type mapboxgl from "mapbox-gl";

// Vienna's water comes off two alpine springs and arrives cold; the badge is
// the blue of the pipes the city paints on its own hydrants.
const DISC = "#0b6ea8";

const TROUGH = "#0e5a7d";

const RING = "#ffffff";

// Phosphor's drop, at the same inset as the exit glyphs.
const DROP = `<g transform="translate(51.2 51.2) scale(0.6)"><path fill="${RING}" d="M174,47.75a254.19,254.19,0,0,0-41.45-38.3,12,12,0,0,0-13.1,0A254.19,254.19,0,0,0,78,47.75C49.74,79.4,36,111.31,36,145a92,92,0,0,0,184,0C220,111.31,206.26,79.4,174,47.75ZM128,213a68.08,68.08,0,0,1-68-68c0-56.1,50.05-100,68-113.83C145.94,45,196,88.9,196,145A68.08,68.08,0,0,1,128,213Z"/><path fill="${RING}" d="M168.19,128.7a12,12,0,0,0-13.62,10.15c-2,13.79-13.86,25.62-27.63,27.52a12,12,0,0,0,1.63,23.89,12.56,12.56,0,0,0,1.65-.11c24.24-3.33,44.34-23.36,47.72-47.83A12,12,0,0,0,168.19,128.7Z"/></g>`;

const GLYPH = {
  plain: DROP,
  // "mit Tränke" — a bowl at ground level. Marked, because on a hot day it is
  // the difference between walking the dog and carrying it.
  trough: DROP,
} as const;

export type FountainIcon = keyof typeof GLYPH;

export const FOUNTAIN_ICONS = Object.keys(GLYPH) as FountainIcon[];

export const fountainImageId = (icon: FountainIcon) => `bim-fountain-${icon}`;

const RATIO = 4;

const BADGE = 14 * RATIO;

function markup(icon: FountainIcon, px: number): string {
  const fill = icon === "trough" ? TROUGH : DISC;
  // The trough variant carries a second, smaller disc below — a bowl on the
  // ground, read at a glance without a second glyph to squint at.
  const bowl =
    icon === "trough"
      ? `<circle cx="128" cy="222" r="30" fill="${fill}" stroke="${RING}" stroke-width="12"/>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 276" width="${px}" height="${(px * 276) / 256}"><circle cx="128" cy="128" r="110" fill="${fill}" stroke="${RING}" stroke-width="12"/>${GLYPH[icon]}${bowl}</svg>`;
}

// Chrome refuses an SVG blob in createImageBitmap, so this goes via image + canvas.
async function rasterise(
  svg: string,
  width: number,
  height: number,
): Promise<CanvasImageSource> {
  const image = new Image(width, height);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

export async function installFountainIcons(map: mapboxgl.Map): Promise<void> {
  const height = Math.round((BADGE * 276) / 256);

  for (const icon of FOUNTAIN_ICONS) {
    const id = fountainImageId(icon);
    if (map.hasImage(id)) continue;

    const canvas = document.createElement("canvas");
    canvas.width = BADGE;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      await rasterise(markup(icon, BADGE), BADGE, height),
      0,
      0,
      BADGE,
      height,
    );

    if (map.hasImage(id)) continue;
    map.addImage(id, ctx.getImageData(0, 0, BADGE, height), {
      pixelRatio: RATIO,
    });
  }
}
