import { describe, expect, it } from "vitest";

import type { SpriteAsset } from "./model.ts";
import { importTilemapJson } from "./tilemapImport.ts";

const sprites: SpriteAsset[] = [
  {
    id: "tiles",
    name: "Tiles",
    width: 8,
    height: 8,
    palette: [{ index: 0, color: 0 }],
    transparentIndex: 0,
    frames: [
      { id: "frame-0", colorIndexes: [] },
      { id: "frame-1", colorIndexes: [] },
      { id: "frame-2", colorIndexes: [] },
    ],
    colliders: [],
  },
];

describe("tilemap import", () => {
  it("imports finite Tiled JSON tile layers as sprite frame indexes", () => {
    const tilemap = importTilemapJson(
      JSON.stringify({
        width: 3,
        height: 2,
        tilewidth: 8,
        tileheight: 8,
        tilesets: [{ firstgid: 5 }],
        layers: [
          { type: "objectgroup", objects: [] },
          { type: "tilelayer", width: 3, height: 2, data: [0, 5, 6, 7, 0x80000008, 9] },
        ],
      }),
      "world.json",
      [],
      sprites,
    );

    expect(tilemap).toMatchObject({
      id: "world",
      name: "world",
      tilesetSpriteId: "tiles",
      width: 3,
      height: 2,
      tileWidth: 8,
      tileHeight: 8,
    });
    expect(tilemap.tiles).toEqual([-1, 0, 1, 2, 3, 4]);
  });

  it("imports Tiled CSV layer data", () => {
    const tilemap = importTilemapJson(
      JSON.stringify({
        width: 2,
        height: 2,
        tilewidth: 16,
        tileheight: 16,
        layers: [{ type: "tilelayer", data: "1, 2\n3, 0" }],
      }),
      "csv-map.json",
      [],
      sprites,
    );

    expect(tilemap.tiles).toEqual([0, 1, 2, -1]);
  });

  it("imports embedded LDtk tile layers into a dense tile array", () => {
    const tilemap = importTilemapJson(
      JSON.stringify({
        levels: [
          {
            identifier: "Level_0",
            pxWid: 16,
            pxHei: 16,
            layerInstances: [
              {
                __type: "Tiles",
                __gridSize: 8,
                __cWid: 2,
                __cHei: 2,
                gridTiles: [
                  { px: [0, 0], t: 2 },
                  { px: [8, 8], t: 1 },
                ],
              },
            ],
          },
        ],
      }),
      "level.ldtk.json",
      [],
      sprites,
    );

    expect(tilemap).toMatchObject({ width: 2, height: 2, tileWidth: 8, tileHeight: 8 });
    expect(tilemap.tiles).toEqual([2, -1, -1, 1]);
  });
});
