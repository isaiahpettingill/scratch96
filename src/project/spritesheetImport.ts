import type { SpriteAnimation, SpriteAsset, SpriteFrame, UploadedAssetSource } from "./model.ts";
import { quantizeSpritePixelsInBackground } from "./paletteQuantizeClient.ts";
import { quantizeSpritePixels, type QuantizedSpritePixels } from "./paletteQuantize.ts";
import { createDefaultSpriteColliders } from "./spriteColliders.ts";

export type DecodedSpritesheetImage = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

type FrameRect = { name: string; x: number; y: number; w: number; h: number; duration?: number };
type ParsedSpritesheet = { frames: FrameRect[]; animations?: SpriteAnimation[] };
type GridMetadata = {
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  columns?: number;
  rows?: number;
};

export async function importSpritesheetSprite(
  imageFile: File,
  imageBytes: number[],
  jsonFile: File,
  jsonBytes: number[],
  existing: SpriteAsset[],
): Promise<SpriteAsset> {
  const decoded = await decodeImage(imageFile);
  return createSpriteFromDecodedSpritesheetAsync(imageFile, imageBytes, jsonFile, jsonBytes, decoded, existing);
}

export async function importImageSprite(
  imageFile: File,
  imageBytes: number[],
  existing: SpriteAsset[],
): Promise<SpriteAsset> {
  const decoded = await decodeImage(imageFile);
  return createSpriteFromDecodedImageAsync(imageFile, imageBytes, decoded, existing);
}

export async function createSpriteFromDecodedImageAsync(
  imageFile: File,
  imageBytes: number[],
  decoded: DecodedSpritesheetImage,
  existing: SpriteAsset[],
): Promise<SpriteAsset> {
  const rect = { name: cleanName(imageFile.name), x: 0, y: 0, w: decoded.width, h: decoded.height };
  const quantized = await quantizeSpritePixelsInBackground(decoded, [rect]);
  return createSpriteFromQuantizedFrames(imageFile, imageBytes, undefined, undefined, decoded.width, decoded.height, [rect], quantized, existing);
}

export function createSpriteFromDecodedImage(
  imageFile: File,
  imageBytes: number[],
  decoded: DecodedSpritesheetImage,
  existing: SpriteAsset[],
): SpriteAsset {
  const rect = { name: cleanName(imageFile.name), x: 0, y: 0, w: decoded.width, h: decoded.height };
  const quantized = quantizeSpritePixels(decoded, [rect]);
  return createSpriteFromQuantizedFrames(imageFile, imageBytes, undefined, undefined, decoded.width, decoded.height, [rect], quantized, existing);
}

export async function createSpriteFromDecodedSpritesheetAsync(
  imageFile: File,
  imageBytes: number[],
  jsonFile: File,
  jsonBytes: number[],
  decoded: DecodedSpritesheetImage,
  existing: SpriteAsset[],
): Promise<SpriteAsset> {
  const parsed = parseSpritesheetMetadata(bytesToText(jsonBytes), decoded.width, decoded.height);
  const width = parsed.frames[0]?.w ?? decoded.width;
  const height = parsed.frames[0]?.h ?? decoded.height;
  const quantized = await quantizeSpritePixelsInBackground(decoded, parsed.frames);
  return createSpriteFromQuantizedFrames(imageFile, imageBytes, jsonFile, jsonBytes, width, height, parsed.frames, quantized, existing, parsed.animations);
}

export function createSpriteFromDecodedSpritesheet(
  imageFile: File,
  imageBytes: number[],
  jsonFile: File,
  jsonBytes: number[],
  decoded: DecodedSpritesheetImage,
  existing: SpriteAsset[],
): SpriteAsset {
  const parsed = parseSpritesheetMetadata(bytesToText(jsonBytes), decoded.width, decoded.height);
  const width = parsed.frames[0]?.w ?? decoded.width;
  const height = parsed.frames[0]?.h ?? decoded.height;
  const quantized = quantizeSpritePixels(decoded, parsed.frames);

  return createSpriteFromQuantizedFrames(imageFile, imageBytes, jsonFile, jsonBytes, width, height, parsed.frames, quantized, existing, parsed.animations);
}

function createSpriteFromQuantizedFrames(
  imageFile: File,
  imageBytes: number[],
  jsonFile: File | undefined,
  jsonBytes: number[] | undefined,
  width: number,
  height: number,
  frameRects: FrameRect[],
  quantized: QuantizedSpritePixels,
  existing: SpriteAsset[],
  animations?: SpriteAnimation[],
): SpriteAsset {
  return {
    id: uniqueId(existing, imageFile.name),
    name: cleanName(imageFile.name),
    source: createSource(imageFile, imageBytes),
    asepriteSource: jsonFile && jsonBytes ? createSource(jsonFile, jsonBytes) : undefined,
    width,
    height,
    palette: quantized.palette,
    transparentIndex: 0,
    frames: quantized.frames.map((frame, index) => createFrame(frameRects[index], index, frame.colorIndexes)),
    animations,
    colliders: createDefaultSpriteColliders({ width, height }),
  };
}

export function parseSpritesheetMetadata(jsonText: string, imageWidth: number, imageHeight: number): ParsedSpritesheet {
  const data = JSON.parse(jsonText) as unknown;
  const explicitFrames = parseFrameRects(data);
  const frames = explicitFrames.length > 0 ? explicitFrames : parseGridFrames(data, imageWidth, imageHeight);
  return { frames, animations: parseAnimations(data, frames) };
}

function parseFrameRects(data: unknown): FrameRect[] {
  const frames = frameEntries(data);
  return frames.flatMap(([name, value], index) => {
    if (!isRecord(value)) return [];
    const rect = readRect(value);
    if (!rect) return [];
    return [
      {
        name: frameName(value, name, index),
        ...rect,
        duration: numberField(value, "duration") ?? numberField(value, "durationMs"),
      },
    ];
  });
}

function parseGridFrames(data: unknown, imageWidth: number, imageHeight: number): FrameRect[] {
  const grid = parseGridMetadata(data);
  if (!grid) {
    return [{ name: "Frame 1", x: 0, y: 0, w: imageWidth, h: imageHeight }];
  }

  const frameCount = Math.max(1, Math.floor(grid.frameCount ?? 1));
  const inferredColumns = grid.frameWidth ? Math.floor(imageWidth / grid.frameWidth) || frameCount : frameCount;
  const columns = Math.max(1, Math.floor(grid.columns ?? inferredColumns));
  const rows = Math.max(1, Math.floor(grid.rows ?? Math.ceil(frameCount / columns)));
  const frameWidth = Math.max(1, Math.floor(grid.frameWidth ?? imageWidth / columns));
  const frameHeight = Math.max(1, Math.floor(grid.frameHeight ?? imageHeight / rows));
  const sourceFrames = isRecord(data) && Array.isArray(data.frames) ? data.frames : [];

  return Array.from({ length: frameCount }, (_, index) => {
    const frame = sourceFrames[index];
    return {
      name: isRecord(frame) ? frameName(frame, undefined, index) : `Frame ${index + 1}`,
      x: (index % columns) * frameWidth,
      y: Math.floor(index / columns) * frameHeight,
      w: frameWidth,
      h: frameHeight,
      duration: isRecord(frame) ? numberField(frame, "duration") : undefined,
    };
  });
}

function frameEntries(data: unknown): [string, unknown][] {
  if (!isRecord(data)) return [];
  const frames = data.frames ?? data.sprites ?? data.tiles ?? data.regions;
  if (Array.isArray(frames)) {
    return frames.map((frame, index) => [
      isRecord(frame) && typeof frame.filename === "string" ? frame.filename : `Frame ${index + 1}`,
      frame,
    ]);
  }
  if (isRecord(frames)) return Object.entries(frames);
  return [];
}

function readRect(value: Record<string, unknown>): Pick<FrameRect, "x" | "y" | "w" | "h"> | undefined {
  const candidates = [
    value,
    value.frame,
    value.rect,
    value.bounds,
    value.sourceRect,
    value.sourceRectangle,
    value.textureRect,
  ];
  for (const candidate of candidates) {
    const rect = readRectFields(candidate);
    if (rect) return rect;
  }

  if (isRecord(value.position) && isRecord(value.size)) {
    const x = numberField(value.position, "x");
    const y = numberField(value.position, "y");
    const w = numberField(value.size, "w") ?? numberField(value.size, "width");
    const h = numberField(value.size, "h") ?? numberField(value.size, "height");
    if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) return { x, y, w, h };
  }

  return undefined;
}

function readRectFields(value: unknown): Pick<FrameRect, "x" | "y" | "w" | "h"> | undefined {
  if (Array.isArray(value) && value.length >= 4) {
    const [x, y, w, h] = value;
    if ([x, y, w, h].every((field) => typeof field === "number" && Number.isFinite(field))) return { x, y, w, h };
  }
  if (!isRecord(value)) return undefined;
  const x = numberField(value, "x") ?? numberField(value, "left");
  const y = numberField(value, "y") ?? numberField(value, "top");
  const w = numberField(value, "w") ?? numberField(value, "width");
  const h = numberField(value, "h") ?? numberField(value, "height");
  return x !== undefined && y !== undefined && w !== undefined && h !== undefined ? { x, y, w, h } : undefined;
}

function frameName(value: Record<string, unknown>, fallback: string | undefined, index: number): string {
  return (
    stringField(value, "filename") ??
    stringField(value, "fileName") ??
    stringField(value, "name") ??
    stringField(value, "id") ??
    fallback ??
    `Frame ${index + 1}`
  );
}

function parseGridMetadata(data: unknown): GridMetadata | undefined {
  if (!isRecord(data)) return undefined;
  const piskel = isRecord(data.piskel) ? data.piskel : undefined;
  const source = piskel ?? data;
  const frames = Array.isArray(data.frames) ? data.frames : undefined;
  const frameCount =
    numberField(source, "frameCount") ??
    numberField(source, "framesCount") ??
    numberField(source, "numberOfFrames") ??
    parsePiskelFrameCount(piskel) ??
    frames?.length;
  const frameWidth =
    numberField(source, "frameWidth") ??
    numberField(source, "frame_width") ??
    numberField(source, "cellWidth") ??
    numberField(source, "tileWidth") ??
    numberField(source, "spriteWidth") ??
    (piskel ? numberField(piskel, "width") : undefined);
  const frameHeight =
    numberField(source, "frameHeight") ??
    numberField(source, "frame_height") ??
    numberField(source, "cellHeight") ??
    numberField(source, "tileHeight") ??
    numberField(source, "spriteHeight") ??
    (piskel ? numberField(piskel, "height") : undefined);

  if (!frameCount && !frameWidth && !frameHeight && !frames) return undefined;
  return { frameWidth, frameHeight, frameCount, columns: numberField(source, "columns") ?? numberField(source, "cols"), rows: numberField(source, "rows") };
}

function parsePiskelFrameCount(piskel: Record<string, unknown> | undefined): number | undefined {
  if (!piskel || !Array.isArray(piskel.layers)) return undefined;
  return piskel.layers.reduce<number | undefined>((max, layer) => {
    const parsed = typeof layer === "string" ? parseJsonRecord(layer) : isRecord(layer) ? layer : undefined;
    const count = parsed ? numberField(parsed, "frameCount") : undefined;
    return count === undefined ? max : Math.max(max ?? 0, count);
  }, undefined);
}

function parseJsonRecord(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parseAnimations(data: unknown, frames: FrameRect[]): SpriteAnimation[] | undefined {
  if (!isRecord(data)) return undefined;
  const tags = isRecord(data.meta) && Array.isArray(data.meta.frameTags) ? data.meta.frameTags : Array.isArray(data.frameTags) ? data.frameTags : [];
  if (tags.length === 0 && frames.length > 1) {
    return [{ id: "default", name: "Default", from: 0, to: frames.length - 1, direction: "forward", repeat: 0 }];
  }

  const animations = tags.flatMap((tag): SpriteAnimation[] => {
    if (!isRecord(tag) || typeof tag.name !== "string") return [];
    const from = numberField(tag, "from") ?? 0;
    const to = numberField(tag, "to") ?? from;
    return [{ id: cleanId(tag.name), name: tag.name, from, to, direction: normalizeDirection(stringField(tag, "direction") ?? "forward"), repeat: 0 }];
  });

  return animations.length > 0 ? animations : undefined;
}

function createFrame(rect: FrameRect | undefined, index: number, colorIndexes: number[]): SpriteFrame {
  return {
    id: `frame_${index + 1}`,
    name: rect?.name ?? `Frame ${index + 1}`,
    colorIndexes,
  };
}

async function decodeImage(file: File): Promise<DecodedSpritesheetImage> {
  try {
    return await decodeNativeImage(file);
  } catch {
    const { decodeImageWithFfmpeg } = await import("./ffmpegImageDecode.ts");
    return decodeImageWithFfmpeg(file);
  }
}

async function decodeNativeImage(file: File): Promise<DecodedSpritesheetImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.drawImage(bitmap, 0, 0);
  return { width: bitmap.width, height: bitmap.height, pixels: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberField(value: Record<string, unknown>, field: string): number | undefined {
  const raw = value[field];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function stringField(value: Record<string, unknown>, field: string): string | undefined {
  const raw = value[field];
  return typeof raw === "string" ? raw : undefined;
}

function normalizeDirection(direction: string): SpriteAnimation["direction"] {
  if (direction === "reverse") return "reverse";
  if (direction === "pingpong" || direction === "ping-pong") return "pingpong";
  return "forward";
}

function createSource(file: File, bytes: number[]): UploadedAssetSource {
  return { filename: file.name, mimeType: file.type || "application/octet-stream", data: bytes };
}

function bytesToText(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function uniqueId(items: { id: string }[], filename: string): string {
  const base = cleanId(cleanName(filename));
  let id = base;
  let index = 2;
  while (items.some((item) => item.id === id)) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}

function cleanId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "asset";
}

function cleanName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled asset";
}
