import type { SpriteAsset, TilemapAsset } from "./model.ts";

export function createDefaultTilemap(existing: TilemapAsset[], sprites: SpriteAsset[]): TilemapAsset {
  const tileset = sprites[0];
  const width = 16;
  const height = 12;

  return {
    id: uniqueId(existing, "tilemap"),
    name: `Tilemap ${existing.length + 1}`,
    tilesetSpriteId: tileset?.id ?? "",
    width,
    height,
    tileWidth: 8,
    tileHeight: 8,
    tiles: Array.from({ length: width * height }, () => -1),
    collisionTiles: Array.from({ length: width * height }, () => false),
  };
}

export function normalizeTilemap(tilemap: TilemapAsset): TilemapAsset {
  const size = Math.max(1, tilemap.width) * Math.max(1, tilemap.height);
  return {
    ...tilemap,
    width: Math.max(1, tilemap.width),
    height: Math.max(1, tilemap.height),
    tileWidth: Math.max(1, tilemap.tileWidth),
    tileHeight: Math.max(1, tilemap.tileHeight),
    tiles: [...tilemap.tiles, ...Array.from({ length: size }, () => -1)].slice(0, size),
    collisionTiles: [...(tilemap.collisionTiles ?? []), ...Array.from({ length: size }, () => false)].slice(0, size),
  };
}

function uniqueId(items: { id: string }[], base: string): string {
  let id = base;
  let index = 2;

  while (items.some((item) => item.id === id)) {
    id = `${base}_${index}`;
    index += 1;
  }

  return id;
}
