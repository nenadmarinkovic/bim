import type { VehicleMode } from "@/lib/vehicles/types";
import { METRO_COLOR, vehicleColour } from "@/lib/vehicles/colors";

export { METRO_COLOR };

const SPEC: Record<
  VehicleMode,
  { length: number; width: number; joints: number }
> = {
  train: { length: 38, width: 10, joints: 3 },
  metro: { length: 34, width: 9, joints: 3 },
  tram: { length: 26, width: 8, joints: 2 },
  bus: { length: 16, width: 8, joints: 0 },
};

const PIXEL_RATIO = 2;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function makeVehicleSprite(
  mode: VehicleMode,
  line: string,
  dark: boolean,
): ImageData | null {
  const { length, width, joints } = SPEC[mode];
  const pad = 2;
  const w = (width + pad * 2) * PIXEL_RATIO;
  const h = (length + pad * 2) * PIXEL_RATIO;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  ctx.lineJoin = "round";

  const x = pad;
  const y = pad;
  const radius = width / 2.4;

  roundedRect(ctx, x, y, width, length, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const inset = 1.0;
  roundedRect(
    ctx,
    x + inset,
    y + inset,
    width - inset * 2,
    length - inset * 2,
    radius - inset / 2,
  );
  ctx.fillStyle = vehicleColour(mode, line, dark);
  ctx.fill();

  if (joints > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 0.9;
    const step = length / (joints + 1);
    for (let i = 1; i <= joints; i++) {
      const jy = y + step * i;
      ctx.beginPath();
      ctx.moveTo(x + inset, jy);
      ctx.lineTo(x + width - inset, jy);
      ctx.stroke();
    }
  }

  const noseHeight = Math.max(3, length * 0.16);
  ctx.save();
  roundedRect(
    ctx,
    x + inset,
    y + inset,
    width - inset * 2,
    length - inset * 2,
    radius - inset / 2,
  );
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(x, y + inset, width, noseHeight);
  ctx.restore();

  return ctx.getImageData(0, 0, w, h);
}

export const spriteId = (mode: VehicleMode, line = ""): string =>
  mode === "metro" && METRO_COLOR[line] ? `vehicle-${line}` : `vehicle-${mode}`;

export const SPRITES: { mode: VehicleMode; line: string }[] = [
  ...Object.keys(METRO_COLOR).map((line) => ({ mode: "metro" as const, line })),
  { mode: "metro", line: "" },
  { mode: "tram", line: "" },
  { mode: "bus", line: "" },
  { mode: "train", line: "" },
];

export const SPRITE_PIXEL_RATIO = PIXEL_RATIO;
