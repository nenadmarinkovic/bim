import type mapboxgl from "mapbox-gl";

const DISC = "#1f7a5c";

const RING = "#ffffff";

const INK = "#ffffff";

const TOILET = `<path fill="${INK}" d="M128,68a12,12,0,0,1-12,12H100a12,12,0,0,1,0-24h16A12,12,0,0,1,128,68Zm48.15,127.62,3.65,25.55A20,20,0,0,1,160,244H96a20,20,0,0,1-19.8-22.83l3.65-25.55A100.08,100.08,0,0,1,28,108,12,12,0,0,1,40,96H52V40A20,20,0,0,1,72,20H184a20,20,0,0,1,20,20V96h12a12,12,0,0,1,12,12A100.08,100.08,0,0,1,176.15,195.62ZM76,96H180V44H76Zm77.21,108.78a100.3,100.3,0,0,1-50.42,0L100.61,220h54.78ZM203.05,120H53a76,76,0,0,0,150.1,0Z"/>`;

export const TOILET_IMAGE = "bim-toilet";

const RATIO = 4;

const BADGE = 15 * RATIO;

function markup(px: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${px}" height="${px}"><circle cx="128" cy="128" r="110" fill="${DISC}" stroke="${RING}" stroke-width="12"/><g transform="translate(51.2 51.2) scale(0.6)">${TOILET}</g></svg>`;
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

export async function installToiletIcon(map: mapboxgl.Map): Promise<void> {
  if (map.hasImage(TOILET_IMAGE)) return;

  const canvas = document.createElement("canvas");
  canvas.width = BADGE;
  canvas.height = BADGE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(await rasterise(markup(BADGE), BADGE), 0, 0, BADGE, BADGE);

  if (map.hasImage(TOILET_IMAGE)) return;
  map.addImage(TOILET_IMAGE, ctx.getImageData(0, 0, BADGE, BADGE), {
    pixelRatio: RATIO,
  });
}
