import type mapboxgl from "mapbox-gl";

// One colour for every door, because the glyph carries the difference. Dark
// enough to hold white at this size, and it keeps its own identity against the
// reds and greens the vehicles already use.
const DISC = "#1a3a6b";

const RING = "#ffffff";

const INK = "#ffffff";

// Phosphor's wheelchair at bold weight — the accessibility pictogram everybody
// already reads, and solid enough to survive being reversed out of navy.
const WHEELCHAIR = `<g transform="translate(51.2 51.2) scale(0.6)"><path fill="${INK}" d="M255.14,187.54a12,12,0,0,0-15.6-6.68l-9.75,3.9-27.06-54.13A12,12,0,0,0,192,124H116V108h52a12,12,0,0,0,0-24H116V77.81a34,34,0,1,0-24,0v8.88a76,76,0,1,0,88.35,106.57,12,12,0,1,0-21.57-10.52A52,52,0,1,1,92,112v24a12,12,0,0,0,12,12h80.58l28.68,57.37a12,12,0,0,0,15.19,5.77l20-8A12,12,0,0,0,255.14,187.54ZM104,36A10,10,0,1,1,94,46,10,10,0,0,1,104,36Z"/></g>`;

// Phosphor's steps at bold weight, scaled to fill the disc rather than sit in
// the middle of it. The glyph is a fine four-step diagonal, so at the wheelchair's
// inset it shrank to an illegible squiggle; at this size it reads. Any larger and
// the bottom tread crosses the ring.
const STAIRS = `<g transform="translate(33.28 33.28) scale(0.74)"><path fill="${INK}" d="M252,56a12,12,0,0,1-12,12H196v36a12,12,0,0,1-12,12H140v36a12,12,0,0,1-12,12H84v36a12,12,0,0,1-12,12H16a12,12,0,0,1,0-24H60V152a12,12,0,0,1,12-12h44V104a12,12,0,0,1,12-12h44V56a12,12,0,0,1,12-12h56A12,12,0,0,1,252,56Z"/></g>`;

const GLYPH = {
  free: WHEELCHAIR,
  steps: STAIRS,
  // Nothing at all: a door nobody has surveyed cannot be drawn as one with
  // stairs, and a bare disc is the only shape that claims nothing.
  unknown: "",
} as const;

export type ExitIcon = keyof typeof GLYPH;

export const EXIT_ICONS = Object.keys(GLYPH) as ExitIcon[];

export const exitImageId = (icon: ExitIcon) => `bim-exit-${icon}`;

// Four device pixels per CSS pixel, matching the stop badges: anything less is
// enlarged from too little detail, which is what makes a glyph mushy.
const RATIO = 4;

const BADGE = 18 * RATIO;

function markup(icon: ExitIcon, px: number): string {
  const glyph = GLYPH[icon];

  // The bare disc is drawn smaller: with nothing inside it, the same radius
  // reads as a heavier mark than the two that carry a glyph.
  const radius = glyph ? 119 : 86;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${px}" height="${px}"><circle cx="128" cy="128" r="${radius}" fill="${DISC}" stroke="${RING}" stroke-width="12"/>${glyph}</svg>`;
}

// Chrome refuses an SVG blob in createImageBitmap, so it goes through an image
// and a canvas — the same route the stop badges take.
async function rasterise(svg: string, size: number): Promise<CanvasImageSource> {
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

    // Rasterised at its final pixel size, never scaled up afterwards.
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
