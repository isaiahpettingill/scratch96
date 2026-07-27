import type { SpriteAsset, TilemapAsset } from "./model.ts";

const TILED_GID_MASK = 0x0fffffff;

type ImportedTilemapData = {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tiles: number[];
};

export function importTilemapJson(
  jsonText: string,
  filename: string,
  existing: TilemapAsset[],
  sprites: SpriteAsset[],
): TilemapAsset {
  const data = parseJsonObject(jsonText);
  const imported = readImportedTilemap(data);
  const tileset = sprites[0];

  return {
    id: uniqueId(existing, filenameBase(filename)),
    name: filenameBase(filename),
    tilesetSpriteId: tileset?.id ?? "",
    width: imported.width,
    height: imported.height,
    tileWidth: imported.tileWidth,
    tileHeight: imported.tileHeight,
    tiles: imported.tiles,
    collisionTiles: imported.tiles.map(() => false),
  };
}

function readImportedTilemap(data: Record<string, unknown>): ImportedTilemapData {
  if (
    Array.isArray(data.layers) &&
    typeof data.tilewidth === "number" &&
    typeof data.tileheight === "number"
  ) {
    return readTiledTilemap(data);
  }

  if (Array.isArray(data.levels)) {
    return readLdtkTilemap(data);
  }

  throw new Error("Tilemap JSON must be a Tiled map or an LDtk project.");
}

function readTiledTilemap(data: Record<string, unknown>): ImportedTilemapData {
  const mapWidth = readPositiveInteger(data.width, "Tiled map width");
  const mapHeight = readPositiveInteger(data.height, "Tiled map height");
  const tileWidth = readPositiveInteger(data.tilewidth, "Tiled tile width");
  const tileHeight = readPositiveInteger(data.tileheight, "Tiled tile height");
  const layers = Array.isArray(data.layers) ? data.layers : [];
  const layer = layers.find(
    (candidate) => isRecord(candidate) && candidate.type === "tilelayer",
  ) as Record<string, unknown> | undefined;

  if (!layer) {
    throw new Error("Tiled map does not contain a tile layer.");
  }

  const width = readPositiveInteger(layer.width ?? mapWidth, "Tiled layer width");
  const height = readPositiveInteger(layer.height ?? mapHeight, "Tiled layer height");
  const firstGid = readTiledFirstGid(data.tilesets);
  const gids = readTiledLayerData(layer.data, width * height);

  return {
    width,
    height,
    tileWidth,
    tileHeight,
    tiles: gids.map((gid) => tiledGidToFrameIndex(gid, firstGid)),
  };
}

function readLdtkTilemap(data: Record<string, unknown>): ImportedTilemapData {
  const levels = Array.isArray(data.levels) ? data.levels : [];
  const level = levels.find(isRecord);
  if (!level) {
    throw new Error("LDtk project does not contain an embedded level.");
  }

  const layerInstances = Array.isArray(level.layerInstances) ? level.layerInstances : [];
  const layer = layerInstances.find(isLdtkTileLayer);
  if (!layer) {
    throw new Error("LDtk level does not contain a Tiles or AutoLayer layer.");
  }

  const tileWidth = readPositiveInteger(layer.__gridSize, "LDtk layer grid size");
  const tileHeight = tileWidth;
  const width = readPositiveInteger(
    layer.__cWid ??
      (typeof level.pxWid === "number" ? Math.ceil(level.pxWid / tileWidth) : undefined),
    "LDtk layer width",
  );
  const height = readPositiveInteger(
    layer.__cHei ??
      (typeof level.pxHei === "number" ? Math.ceil(level.pxHei / tileHeight) : undefined),
    "LDtk layer height",
  );
  const tiles = Array.from({ length: width * height }, () => -1);

  for (const tile of readLdtkTiles(layer)) {
    const position = Array.isArray(tile.px) ? tile.px : [];
    const x = typeof position[0] === "number" ? Math.floor(position[0] / tileWidth) : -1;
    const y = typeof position[1] === "number" ? Math.floor(position[1] / tileHeight) : -1;
    const tileIndex =
      typeof tile.t === "number" && Number.isFinite(tile.t) ? Math.max(0, Math.floor(tile.t)) : -1;

    if (x >= 0 && x < width && y >= 0 && y < height) {
      tiles[y * width + x] = tileIndex;
    }
  }

  return { width, height, tileWidth, tileHeight, tiles };
}

function parseJsonObject(jsonText: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(jsonText);
  if (!isRecord(parsed)) {
    throw new Error("Tilemap JSON root must be an object.");
  }
  return parsed;
}

function readTiledFirstGid(tilesets: unknown): number {
  if (!Array.isArray(tilesets)) return 1;

  const firstTileset = tilesets.find(isRecord);
  if (!firstTileset) return 1;

  return readPositiveInteger(firstTileset.firstgid ?? 1, "Tiled tileset firstgid");
}

function readTiledLayerData(data: unknown, size: number): number[] {
  const gids = Array.isArray(data)
    ? data
    : typeof data === "string"
      ? readCsvGids(data)
      : undefined;
  if (!gids) {
    throw new Error("Tiled tile layer data must be an array or CSV string.");
  }

  if (gids.length < size) {
    throw new Error("Tiled tile layer data is shorter than the layer size.");
  }

  return gids.slice(0, size).map((gid) => readNonNegativeInteger(gid, "Tiled tile gid"));
}

function readCsvGids(data: string): number[] {
  return data
    .trim()
    .split(/[\s,]+/)
    .filter((part) => part.length > 0)
    .map(Number);
}

function tiledGidToFrameIndex(gid: number, firstGid: number): number {
  const unflagged = gid & TILED_GID_MASK;
  return unflagged === 0 ? -1 : Math.max(0, unflagged - firstGid);
}

function isLdtkTileLayer(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return (
    (value.__type === "Tiles" && Array.isArray(value.gridTiles)) ||
    (value.__type === "AutoLayer" && Array.isArray(value.autoLayerTiles))
  );
}

function readLdtkTiles(layer: Record<string, unknown>): Record<string, unknown>[] {
  const tiles = layer.__type === "AutoLayer" ? layer.autoLayerTiles : layer.gridTiles;
  return Array.isArray(tiles) ? tiles.filter(isRecord) : [];
}

function readPositiveInteger(value: unknown, label: string): number {
  const number = readNonNegativeInteger(value, label);
  if (number < 1) {
    throw new Error(`${label} must be at least 1.`);
  }
  return number;
}

function readNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.floor(value);
}

function filenameBase(filename: string): string {
  const leaf = filename.split(/[\\/]/).at(-1) ?? filename;
  return leaf.replace(/\.[^.]+$/, "") || "Tilemap";
}

function uniqueId(items: { id: string }[], base: string): string {
  const safeBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "") || "tilemap";
  let id = safeBase;
  let index = 2;

  while (items.some((item) => item.id === id)) {
    id = `${safeBase}_${index}`;
    index += 1;
  }

  return id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
