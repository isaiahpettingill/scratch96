import type { SpriteAnimation, SpriteAsset, SpriteFrame, SpritePaletteColor } from "./model.ts";
import { createDefaultSpriteColliders } from "./spriteColliders.ts";
import { createAsepriteSpriteAsset } from "./uploadedAssets.ts";
import initAsepriteWasm, { parse_aseprite } from "./asepriteWasm/aseprite_import.js";
import asepriteWasmUrl from "./asepriteWasm/aseprite_import_bg.wasm?url";

type ParsedAseprite = {
  width: number;
  height: number;
  frames: ParsedAsepriteFrame[];
  animations: ParsedAsepriteAnimation[];
};

type ParsedAsepriteFrame = {
  rgba: number[] | Uint8Array;
};

type ParsedAsepriteAnimation = {
  name: string;
  from: number;
  to: number;
  direction: SpriteAnimation["direction"];
  repeat: number;
};

let wasmReady: Promise<unknown> | undefined;

export async function importAsepriteSprite(
  file: File,
  bytes: number[],
  existing: SpriteAsset[],
): Promise<SpriteAsset> {
  const sprite = createAsepriteSpriteAsset(file, bytes, existing);

  try {
    const ase = await parseAseprite(new Uint8Array(bytes));
    const palette = createPalette(ase);

    return {
      ...sprite,
      width: ase.width,
      height: ase.height,
      palette,
      frames: ase.frames.map((frame, index) => createFrameFromAseprite(ase, frame, index, palette)),
      animations: createAnimations(ase),
      colliders: createDefaultSpriteColliders({ width: ase.width, height: ase.height }),
    };
  } catch {
    return sprite;
  }
}

export async function parseAseprite(bytes: Uint8Array): Promise<ParsedAseprite> {
  wasmReady ??= initAsepriteWasm({ module_or_path: resolveWasmUrl() });
  await wasmReady;
  return parse_aseprite(bytes) as ParsedAseprite;
}

function resolveWasmUrl(): string {
  return new URL(asepriteWasmUrl, globalThis.location?.href ?? import.meta.url).toString();
}

function createFrameFromAseprite(
  ase: ParsedAseprite,
  frame: ParsedAsepriteFrame,
  index: number,
  palette: SpritePaletteColor[],
): SpriteFrame {
  const rgba = Uint8ClampedArray.from(frame.rgba);

  return {
    id: `frame_${index + 1}`,
    name: `Frame ${index + 1}`,
    source: {
      filename: `frame_${index + 1}.rgba`,
      mimeType: "application/x-rgba",
      data: [...rgba],
    },
    colorIndexes: Array.from({ length: ase.width * ase.height }, (_, pixel) => indexForRgba(palette, rgba, pixel)),
  };
}

function createPalette(ase: ParsedAseprite): SpritePaletteColor[] {
  const colors = new Map<number, number>([[0x00000000, 0]]);

  for (const frame of ase.frames) {
    const rgba = frame.rgba;
    for (let pixel = 0; pixel < ase.width * ase.height; pixel += 1) {
      const source = pixel * 4;
      const alpha = rgba[source + 3] ?? 0;
      if (alpha !== 0) addPaletteColor(colors, packColor(rgba[source] ?? 0, rgba[source + 1] ?? 0, rgba[source + 2] ?? 0, alpha));
    }
  }

  return [...colors.entries()].map(([color, index]) => ({ index, color }));
}

function addPaletteColor(colors: Map<number, number>, color: number): number {
  const existing = colors.get(color);
  if (existing !== undefined) return existing;
  const index = colors.size;
  colors.set(color, index);
  return index;
}

function indexForRgba(palette: SpritePaletteColor[], rgba: Uint8ClampedArray, pixel: number): number {
  const source = pixel * 4;
  if (rgba[source + 3] === 0) return 0;
  const color = packColor(rgba[source], rgba[source + 1], rgba[source + 2], rgba[source + 3]);
  return palette.find((entry) => entry.color === color)?.index ?? 0;
}

function packColor(red: number, green: number, blue: number, alpha: number): number {
  return alpha === 0 ? 0x00000000 : ((red & 0xff) << 16) | ((green & 0xff) << 8) | (blue & 0xff);
}

function createAnimations(ase: ParsedAseprite): SpriteAnimation[] | undefined {
  if (ase.animations.length === 0) return undefined;
  return ase.animations.map((animation) => ({
    id: cleanId(animation.name),
    name: animation.name,
    from: animation.from,
    to: animation.to,
    direction: animation.direction,
    repeat: animation.repeat,
  }));
}

function cleanId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]+/g, "_") || "animation";
}
