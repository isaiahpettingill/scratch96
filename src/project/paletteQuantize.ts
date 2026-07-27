import type { SpritePaletteColor } from "./model.ts";
import type { DecodedSpritesheetImage } from "./spritesheetImport.ts";

export type QuantizeFrameRect = { x: number; y: number; w: number; h: number };
export type QuantizedSpriteFrame = { colorIndexes: number[] };
export type QuantizedSpritePixels = { palette: SpritePaletteColor[]; frames: QuantizedSpriteFrame[] };

type ColorBucket = { color: number; count: number };
type ColorBox = { colors: ColorBucket[]; total: number; rMin: number; rMax: number; gMin: number; gMax: number; bMin: number; bMax: number };

const maxPaletteColors = 256;

export function quantizeSpritePixels(decoded: DecodedSpritesheetImage, frames: QuantizeFrameRect[]): QuantizedSpritePixels {
  const colors = collectColors(decoded, frames);
  const paletteColors = colors.size <= maxPaletteColors - 1 ? [...colors.keys()] : quantizeColors(colors, maxPaletteColors - 1);
  const palette = [{ index: 0, color: 0 }, ...paletteColors.map((color, offset) => ({ index: offset + 1, color }))];
  const colorToIndex = createColorIndexMap(colors, paletteColors);

  return {
    palette,
    frames: frames.map((frame) => ({ colorIndexes: createFrameIndexes(decoded, frame, colorToIndex) })),
  };
}

function collectColors(decoded: DecodedSpritesheetImage, frames: QuantizeFrameRect[]): Map<number, number> {
  const colors = new Map<number, number>();
  for (const frame of frames) {
    for (let y = 0; y < frame.h; y += 1) {
      for (let x = 0; x < frame.w; x += 1) {
        const color = pixelColor(decoded, frame.x + x, frame.y + y);
        if (color === 0) continue;
        colors.set(color, (colors.get(color) ?? 0) + 1);
      }
    }
  }
  return colors;
}

function quantizeColors(colors: Map<number, number>, maxColors: number): number[] {
  const initial = createColorBox([...colors.entries()].map(([color, count]) => ({ color, count })));
  const boxes = [initial];
  while (boxes.length < maxColors) {
    const boxIndex = selectSplitBox(boxes);
    if (boxIndex === -1) break;
    const [box] = boxes.splice(boxIndex, 1);
    boxes.push(...splitBox(box));
  }

  return boxes.map((box) => averageBoxColor(box));
}

function createColorIndexMap(colors: Map<number, number>, paletteColors: number[]): Map<number, number> {
  const exact = new Map(paletteColors.map((color, index) => [color, index + 1]));
  if (colors.size === paletteColors.length) return exact;

  const mapped = new Map<number, number>();
  for (const color of colors.keys()) {
    mapped.set(color, nearestPaletteIndex(color, paletteColors));
  }
  return mapped;
}

function createFrameIndexes(decoded: DecodedSpritesheetImage, frame: QuantizeFrameRect, colorToIndex: Map<number, number>): number[] {
  return Array.from({ length: frame.w * frame.h }, (_, pixel) => {
    const x = pixel % frame.w;
    const y = Math.floor(pixel / frame.w);
    return colorToIndex.get(pixelColor(decoded, frame.x + x, frame.y + y)) ?? 0;
  });
}

function selectSplitBox(boxes: ColorBox[]): number {
  let selected = -1;
  let selectedScore = 0;
  boxes.forEach((box, index) => {
    if (box.colors.length < 2) return;
    const score = Math.max(box.rMax - box.rMin, box.gMax - box.gMin, box.bMax - box.bMin) * box.total;
    if (score > selectedScore) {
      selected = index;
      selectedScore = score;
    }
  });
  return selected;
}

function splitBox(box: ColorBox): [ColorBox, ColorBox] {
  const channel = widestChannel(box);
  const sorted = [...box.colors].sort((left, right) => channelValue(left.color, channel) - channelValue(right.color, channel));
  const halfTotal = box.total / 2;
  let splitAt = 1;
  let running = 0;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    running += sorted[index]?.count ?? 0;
    if (running >= halfTotal) {
      splitAt = index + 1;
      break;
    }
  }
  return [createColorBox(sorted.slice(0, splitAt)), createColorBox(sorted.slice(splitAt))];
}

function createColorBox(colors: ColorBucket[]): ColorBox {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  let total = 0;
  for (const entry of colors) {
    const r = (entry.color >> 16) & 0xff;
    const g = (entry.color >> 8) & 0xff;
    const b = entry.color & 0xff;
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
    gMin = Math.min(gMin, g);
    gMax = Math.max(gMax, g);
    bMin = Math.min(bMin, b);
    bMax = Math.max(bMax, b);
    total += entry.count;
  }
  return { colors, total, rMin, rMax, gMin, gMax, bMin, bMax };
}

function averageBoxColor(box: ColorBox): number {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const entry of box.colors) {
    r += ((entry.color >> 16) & 0xff) * entry.count;
    g += ((entry.color >> 8) & 0xff) * entry.count;
    b += (entry.color & 0xff) * entry.count;
  }
  return (Math.round(r / box.total) << 16) | (Math.round(g / box.total) << 8) | Math.round(b / box.total);
}

function nearestPaletteIndex(color: number, palette: number[]): number {
  let selected = 1;
  let selectedDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < palette.length; index += 1) {
    const distance = colorDistance(color, palette[index] ?? 0);
    if (distance < selectedDistance) {
      selected = index + 1;
      selectedDistance = distance;
    }
  }
  return selected;
}

function colorDistance(left: number, right: number): number {
  const r = ((left >> 16) & 0xff) - ((right >> 16) & 0xff);
  const g = ((left >> 8) & 0xff) - ((right >> 8) & 0xff);
  const b = (left & 0xff) - (right & 0xff);
  return r * r + g * g + b * b;
}

function widestChannel(box: ColorBox): "r" | "g" | "b" {
  const r = box.rMax - box.rMin;
  const g = box.gMax - box.gMin;
  const b = box.bMax - box.bMin;
  if (r >= g && r >= b) return "r";
  return g >= b ? "g" : "b";
}

function channelValue(color: number, channel: "r" | "g" | "b"): number {
  if (channel === "r") return (color >> 16) & 0xff;
  if (channel === "g") return (color >> 8) & 0xff;
  return color & 0xff;
}

function pixelColor(decoded: DecodedSpritesheetImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= decoded.width || y >= decoded.height) return 0;
  const offset = (y * decoded.width + x) * 4;
  const alpha = decoded.pixels[offset + 3] ?? 0;
  if (alpha === 0) return 0;
  return ((decoded.pixels[offset] ?? 0) << 16) | ((decoded.pixels[offset + 1] ?? 0) << 8) | (decoded.pixels[offset + 2] ?? 0);
}
