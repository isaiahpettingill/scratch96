import { describe, expect, it } from "vite-plus/test";

import { createDefaultTilemap, normalizeTilemap } from "./tilemaps.ts";

describe("tilemaps", () => {
  it("creates an empty map with standard 8 by 8 tiles", () => {
    const tilemap = createDefaultTilemap([], []);

    expect(tilemap.tileWidth).toBe(8);
    expect(tilemap.tileHeight).toBe(8);
    expect(tilemap.tiles).toHaveLength(tilemap.width * tilemap.height);
    expect(tilemap.tiles.every((tile) => tile === -1)).toBe(true);
  });

  it("preserves empty cells while normalizing a resized map", () => {
    const tilemap = normalizeTilemap({
      id: "level",
      name: "Level",
      tilesetSpriteId: "tiles",
      width: 2,
      height: 2,
      tileWidth: 8,
      tileHeight: 8,
      tiles: [0],
    });

    expect(tilemap.tiles).toEqual([0, -1, -1, -1]);
  });
});
