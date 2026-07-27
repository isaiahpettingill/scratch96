import type { SoundAsset, SpriteAsset, SpriteFrame, UploadedAssetSource } from "./model.ts";
import { createDefaultSpriteColliders } from "./spriteColliders.ts";

export function createUploadedSpriteAsset(file: File, bytes: number[], existing: SpriteAsset[]): SpriteAsset {
  const id = uniqueId(existing, file.name);
  const source = createUploadedSource(file, bytes);

  return {
    id,
    name: cleanName(file.name),
    source,
    width: 1,
    height: 1,
    palette: [
      { index: 0, color: 0x00000000 },
      { index: 1, color: 0x00ffffff },
    ],
    transparentIndex: 0,
    frames: [{ id: "frame_1", name: cleanName(file.name), source, colorIndexes: [1] }],
    colliders: createDefaultSpriteColliders({ width: 1, height: 1 }),
  };
}

export function createAsepriteSpriteAsset(file: File, bytes: number[], existing: SpriteAsset[]): SpriteAsset {
  const sprite = createUploadedSpriteAsset(file, bytes, existing);

  return {
    ...sprite,
    asepriteSource: sprite.source,
    frames: [{ id: "frame_1", name: "Frame 1", colorIndexes: [1] }],
  };
}

export function createUploadedSpriteFrame(file: File, bytes: number[], sprite: SpriteAsset): SpriteFrame {
  return {
    id: uniqueId(sprite.frames, file.name),
    name: cleanName(file.name),
    source: createUploadedSource(file, bytes),
    colorIndexes: Array.from({ length: sprite.width * sprite.height }, () => 1),
  };
}

export function createUploadedSoundAsset(file: File, bytes: number[], existing: SoundAsset[]): SoundAsset {
  return {
    id: uniqueId(existing, file.name),
    name: cleanName(file.name),
    source: createUploadedSource(file, bytes),
    format: "source_audio",
    sourceFormat: sourceAudioFormat(file.name),
    data: bytes,
  };
}

function createUploadedSource(file: File, bytes: number[]): UploadedAssetSource {
  return { filename: file.name, mimeType: file.type || "application/octet-stream", data: bytes };
}

function uniqueId(items: { id: string }[], filename: string): string {
  const base = cleanName(filename).toLowerCase().replace(/[^a-z0-9_]+/g, "_") || "asset";
  let id = base;
  let index = 2;

  while (items.some((item) => item.id === id)) {
    id = `${base}_${index}`;
    index += 1;
  }

  return id;
}

function cleanName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled asset";
}

function sourceAudioFormat(filename: string): "wav" | "mp3" | "ogg" | "flac" | "unknown" {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension === "wav" || extension === "mp3" || extension === "ogg" || extension === "flac" ? extension : "unknown";
}
