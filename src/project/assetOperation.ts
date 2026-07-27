import { importAsepriteSprite } from "./asepriteImport.ts";
import { createBitmapFontAsset } from "./bitmapFont.ts";
import { isSupportedImageFile } from "./imageFormats.ts";
import type { Risc96Project, SpriteAsset, TilemapAsset } from "./model.ts";
import { createDefaultSpriteColliders } from "./spriteColliders.ts";
import { importImageSprite, importSpritesheetSprite } from "./spritesheetImport.ts";
import { importTilemapJson } from "./tilemapImport.ts";
import { createDefaultTilemap, normalizeTilemap } from "./tilemaps.ts";
import { createUploadedSoundAsset, createUploadedSpriteAsset, createUploadedSpriteFrame } from "./uploadedAssets.ts";

export async function addSpriteFromFile(project: Risc96Project, file: File): Promise<{ project: Risc96Project; spriteId: string }> {
  const bytes = await readFileBytes(file);
  const sprite = isSupportedImageFile(file)
    ? await importImageSprite(file, bytes, project.sprites).catch(() =>
        createUploadedSpriteAsset(file, bytes, project.sprites),
      )
    : createUploadedSpriteAsset(file, bytes, project.sprites);
  return { project: { ...project, sprites: [...project.sprites, sprite] }, spriteId: sprite.id };
}

export async function addAsepriteFromFile(project: Risc96Project, file: File): Promise<{ project: Risc96Project; spriteId: string }> {
  const sprite = await importAsepriteSprite(file, await readFileBytes(file), project.sprites);
  return { project: { ...project, sprites: [...project.sprites, sprite] }, spriteId: sprite.id };
}

export async function addSpritesheetFromFiles(
  project: Risc96Project,
  imageFile: File,
  jsonFile: File,
): Promise<{ project: Risc96Project; spriteId: string }> {
  const sprite = await importSpritesheetSprite(
    imageFile,
    await readFileBytes(imageFile),
    jsonFile,
    await readFileBytes(jsonFile),
    project.sprites,
  );
  return { project: { ...project, sprites: [...project.sprites, sprite] }, spriteId: sprite.id };
}

export async function addSpriteFrameFromFile(project: Risc96Project, spriteId: string, file: File): Promise<Risc96Project> {
  const sprite = project.sprites.find((candidate) => candidate.id === spriteId);
  if (!sprite) return project;

  const frame = createUploadedSpriteFrame(file, await readFileBytes(file), sprite);
  return {
    ...project,
    sprites: project.sprites.map((candidate) =>
      candidate.id === spriteId ? { ...candidate, frames: [...candidate.frames, frame] } : candidate,
    ),
  };
}

export async function addSoundFromFile(project: Risc96Project, file: File): Promise<Risc96Project> {
  return {
    ...project,
    sounds: [...project.sounds, createUploadedSoundAsset(file, await readFileBytes(file), project.sounds)],
  };
}

export function addToneSequenceSound(project: Risc96Project): Risc96Project {
  const id = uniqueId(project.sounds.map((sound) => sound.id), "tone");
  const index = project.sounds.filter((sound) => sound.format === "tone_sequence").length + 1;

  return {
    ...project,
    sounds: [
      ...project.sounds,
      {
        id,
        name: `Tone ${index}`,
        format: "tone_sequence",
        notes: [
          { freq: 440, ms: 120 },
          { freq: 660, ms: 120 },
          { freq: 880, ms: 180 },
        ],
      },
    ],
  };
}

export async function addFontFromFile(project: Risc96Project, file: File): Promise<Risc96Project> {
  return {
    ...project,
    fonts: [...project.fonts, createBitmapFontAsset(file, await readFileBytes(file), project.fonts)],
  };
}

export function deleteFont(project: Risc96Project, id: string): Risc96Project {
  return { ...project, fonts: project.fonts.filter((font) => font.id !== id) };
}

export function addDefaultTilemap(project: Risc96Project): { project: Risc96Project; tilemapId: string } {
  const tilemap = createDefaultTilemap(project.tilemaps, project.sprites);
  return { project: { ...project, tilemaps: [...project.tilemaps, tilemap] }, tilemapId: tilemap.id };
}

export async function addTilemapFromFile(project: Risc96Project, file: File): Promise<{ project: Risc96Project; tilemapId: string }> {
  const jsonText = new TextDecoder().decode(new Uint8Array(await readFileBytes(file)));
  const tilemap = importTilemapJson(jsonText, file.name, project.tilemaps, project.sprites);
  return { project: { ...project, tilemaps: [...project.tilemaps, tilemap] }, tilemapId: tilemap.id };
}

export function renameSprite(project: Risc96Project, id: string, name: string): Risc96Project {
  return { ...project, sprites: project.sprites.map((sprite) => (sprite.id === id ? { ...sprite, name } : sprite)) };
}

export function deleteSprite(project: Risc96Project, id: string): Risc96Project {
  return {
    ...project,
    sprites: project.sprites.filter((sprite) => sprite.id !== id),
    scripts: project.scripts.filter((script) => script.target === "stage" || script.target.spriteId !== id),
    tilemaps: project.tilemaps.filter((tilemap) => tilemap.tilesetSpriteId !== id),
  };
}

export function renameSound(project: Risc96Project, id: string, name: string): Risc96Project {
  return { ...project, sounds: project.sounds.map((sound) => (sound.id === id ? { ...sound, name } : sound)) };
}

export function addToneNote(project: Risc96Project, soundId: string): Risc96Project {
  return {
    ...project,
    sounds: project.sounds.map((sound) =>
      sound.id === soundId && sound.format === "tone_sequence"
        ? { ...sound, notes: [...sound.notes, { freq: 440, ms: 120 }] }
        : sound,
    ),
  };
}

export function removeToneNote(project: Risc96Project, soundId: string, noteIndex: number): Risc96Project {
  return {
    ...project,
    sounds: project.sounds.map((sound) =>
      sound.id === soundId && sound.format === "tone_sequence"
        ? { ...sound, notes: sound.notes.filter((_, index) => index !== noteIndex) }
        : sound,
    ),
  };
}

export function updateToneNoteField(
  project: Risc96Project,
  soundId: string,
  noteIndex: number,
  field: "freq" | "ms",
  value: number,
): Risc96Project {
  return {
    ...project,
    sounds: project.sounds.map((sound) =>
      sound.id === soundId && sound.format === "tone_sequence"
        ? {
            ...sound,
            notes: sound.notes.map((note, index) => (index === noteIndex ? { ...note, [field]: value } : note)),
          }
        : sound,
    ),
  };
}

export function renameTilemap(project: Risc96Project, id: string, name: string): Risc96Project {
  return { ...project, tilemaps: project.tilemaps.map((tilemap) => (tilemap.id === id ? { ...tilemap, name } : tilemap)) };
}

export function updateSpriteCollider(
  project: Risc96Project,
  spriteId: string,
  colliderId: string,
  field: "x" | "y" | "width" | "height",
  value: number,
): Risc96Project {
  return {
    ...project,
    sprites: project.sprites.map((sprite) =>
      sprite.id !== spriteId
        ? sprite
        : {
            ...sprite,
            colliders: sprite.colliders.map((collider) =>
              collider.id === colliderId ? { ...collider, [field]: value } : collider,
            ),
          },
    ),
  };
}

export function resizeSprite(project: Risc96Project, spriteId: string, width: number, height: number): Risc96Project {
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));

  return {
    ...project,
    sprites: project.sprites.map((sprite) =>
      sprite.id === spriteId
        ? {
            ...sprite,
            width: nextWidth,
            height: nextHeight,
            frames: sprite.frames.map((frame) => ({
              ...frame,
              colorIndexes: resizeIndexes(frame.colorIndexes, sprite.width, sprite.height, nextWidth, nextHeight, sprite.transparentIndex),
            })),
            colliders: createDefaultSpriteColliders({ width: nextWidth, height: nextHeight }),
          }
        : sprite,
    ),
  };
}

function resizeIndexes(source: number[], width: number, height: number, nextWidth: number, nextHeight: number, fill: number): number[] {
  return Array.from({ length: nextWidth * nextHeight }, (_, index) => {
    const x = index % nextWidth;
    const y = Math.floor(index / nextWidth);
    return x < width && y < height ? source[y * width + x] ?? fill : fill;
  });
}

export function updateSpritePaletteColor(project: Risc96Project, spriteId: string, index: number, color: number): Risc96Project {
  return {
    ...project,
    sprites: project.sprites.map((sprite) =>
      sprite.id === spriteId
        ? {
            ...sprite,
            palette: sprite.palette.map((entry) => (entry.index === index ? { ...entry, color } : entry)),
          }
        : sprite,
    ),
  };
}

export function updateSpriteFromEditor(
  project: Risc96Project,
  spriteId: string,
  update: Pick<SpriteAsset, "name" | "width" | "height" | "transparentIndex" | "palette" | "frames">,
): Risc96Project {
  return {
    ...project,
    sprites: project.sprites.map((sprite) =>
      sprite.id === spriteId
        ? {
            ...sprite,
            name: update.name,
            width: update.width,
            height: update.height,
            transparentIndex: update.transparentIndex,
            palette: update.palette,
            frames: update.frames.map((frame, index) => ({
              ...sprite.frames[index],
              ...frame,
            })),
          }
        : sprite,
    ),
  };
}

export function updateTilemapFromEditor(project: Risc96Project, tilemapId: string, update: TilemapAsset): Risc96Project {
  return {
    ...project,
    tilemaps: project.tilemaps.map((tilemap) =>
      tilemap.id === tilemapId
        ? normalizeTilemap({
            ...tilemap,
            name: update.name,
            width: update.width,
            height: update.height,
            tilesetSpriteId: update.tilesetSpriteId,
            tileWidth: update.tileWidth,
            tileHeight: update.tileHeight,
            tiles: [...update.tiles],
            collisionTiles: update.collisionTiles ? [...update.collisionTiles] : tilemap.collisionTiles,
          })
        : tilemap,
    ),
  };
}

export function updateTilemapField(
  project: Risc96Project,
  id: string,
  field: "width" | "height" | "tileWidth" | "tileHeight",
  value: number,
): Risc96Project {
  return {
    ...project,
    tilemaps: project.tilemaps.map((tilemap) => (tilemap.id === id ? normalizeTilemap({ ...tilemap, [field]: value }) : tilemap)),
  };
}

export function updateTilemapTileset(project: Risc96Project, id: string, tilesetSpriteId: string): Risc96Project {
  const tileset = project.sprites.find((sprite) => sprite.id === tilesetSpriteId);
  const frameCount = Math.max(1, tileset?.frames.length ?? 1);

  return {
    ...project,
    tilemaps: project.tilemaps.map((tilemap) =>
      tilemap.id === id
        ? normalizeTilemap({
            ...tilemap,
            tilesetSpriteId,
            tileWidth: tileset?.width ?? tilemap.tileWidth,
            tileHeight: tileset?.height ?? tilemap.tileHeight,
            tiles: tilemap.tiles.map((tile) => (tile < 0 ? -1 : Math.max(0, Math.min(frameCount - 1, tile)))),
          })
        : tilemap,
    ),
  };
}

export function updateTilemapCell(project: Risc96Project, id: string, index: number, value: number): Risc96Project {
  return {
    ...project,
    tilemaps: project.tilemaps.map((tilemap) =>
      tilemap.id === id ? { ...tilemap, tiles: tilemap.tiles.map((tile, tileIndex) => (tileIndex === index ? value : tile)) } : tilemap,
    ),
  };
}

export function updateTilemapCollisionCell(project: Risc96Project, id: string, index: number): Risc96Project {
  return {
    ...project,
    tilemaps: project.tilemaps.map((tilemap) =>
      tilemap.id === id
        ? normalizeTilemap({
            ...tilemap,
            collisionTiles: (tilemap.collisionTiles ?? tilemap.tiles.map(() => false)).map((solid, tileIndex) =>
              tileIndex === index ? !solid : solid,
            ),
          })
        : tilemap,
    ),
  };
}

async function readFileBytes(file: File): Promise<number[]> {
  return [...new Uint8Array(await file.arrayBuffer())];
}

function uniqueId(existing: string[], base: string): string {
  const safeBase = base.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "asset";
  let candidate = safeBase;
  let suffix = 1;

  while (existing.includes(candidate)) {
    suffix++;
    candidate = `${safeBase}_${suffix}`;
  }

  return candidate;
}
