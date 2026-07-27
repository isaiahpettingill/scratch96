import { describe, expect, it } from "vite-plus/test";

import { emitAssetsHeader } from "./emitAssets.ts";
import { sampleProject } from "../project/sampleProject.ts";

describe("emitAssetsHeader", () => {
  it("emits sprite constants and Risc96 sprite definitions", () => {
    const header = emitAssetsHeader(sampleProject);

    expect(header).toContain("#define SPRITE_PLAYER 0");
    expect(header).toContain("static const r96_sprite_def_t r96_sprite_defs[]");
    expect(header).toContain("{.width = 4, .height = 4, .frame_count = 1, .frames = sprite_player_frames, .collider_count = 1, .colliders = sprite_player_colliders}");
    expect(header).toContain("static const r96_rect_collider_t sprite_player_colliders[]");
    expect(header).toContain("{.x = 0, .y = 0, .width = 4, .height = 4}");
  });

  it("expands indexed-color sprite frames into cartridge pixels", () => {
    const header = emitAssetsHeader(sampleProject);

    expect(header).toContain("static const unsigned int sprite_player_frame_0_pixels[4 * 4]");
    expect(header).toContain("static const unsigned int *sprite_player_frames[]");
    expect(header).toContain("0x00000000, 0x00f6b74b, 0x00f6b74b, 0x00000000");
    expect(header).toContain("0x00f6b74b, 0x006c4b2f, 0x006c4b2f, 0x00f6b74b");
  });

  it("emits tone sequence sound assets", () => {
    const header = emitAssetsHeader(sampleProject);

    expect(header).toContain("#define SOUND_COIN 0");
    expect(header).toContain("static const r96_tone_note_t sound_coin_notes[]");
    expect(header).toContain("{.freq = 880, .ms = 80}");
    expect(header).toContain("{.freq = 1320, .ms = 120}");
    expect(header).toContain("static const r96_sound_def_t r96_sound_defs[]");
  });

  it("marks advanced sprite rendering only when sprite effects or scale are used", () => {
    expect(emitAssetsHeader(sampleProject)).toContain("#define R96_ADVANCED_SPRITE_RENDERER 0");

    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.update = [
      { kind: "setSpriteScale", sprite: "player", scale: { kind: "integer", value: 200 } },
    ];

    expect(emitAssetsHeader(project)).toContain("#define R96_CUSTOM_SPRITE_RENDERER 0");
    expect(emitAssetsHeader(project)).toContain("#define R96_ADVANCED_SPRITE_RENDERER 1");
  });

  it("emits feature switches for the runtime preprocessor", () => {
    const header = emitAssetsHeader(sampleProject);

    expect(header).toContain("#define R96_INPUT_ENABLED 1");
    expect(header).toContain("#define R96_EVENTS_ENABLED 0");
    expect(header).toContain("#define R96_AUDIO_ENABLED 0");
    expect(header).toContain("#define R96_SPRITES_ENABLED 1");

    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.update = [];
    project.scripts[0].blocks.draw = [{ kind: "clearScreen", color: 0 }];
    project.scripts[0].blocks.start = [];
    project.sprites = [];
    project.sounds = [];

    const minimalHeader = emitAssetsHeader(project);
    expect(minimalHeader).toContain("#define R96_INPUT_ENABLED 0");
    expect(minimalHeader).toContain("#define R96_EVENTS_ENABLED 0");
    expect(minimalHeader).toContain("#define R96_AUDIO_ENABLED 0");
    expect(minimalHeader).toContain("#define R96_SPRITES_ENABLED 0");
  });

  it("emits BDF font and tilemap assets", () => {
    const project = structuredClone(sampleProject);
    project.tilemaps = [
      {
        id: "level_1",
        name: "Level 1",
        tilesetSpriteId: "player",
        width: 1,
        height: 1,
        tileWidth: 4,
        tileHeight: 4,
        tiles: [0],
        collisionTiles: [true],
      },
    ];
    project.fonts = [
      {
        id: "tiny",
        name: "Tiny",
        lineHeight: 8,
        glyphs: [{ code: 65, width: 1, height: 1, xOffset: 0, yOffset: 0, xAdvance: 2, bitmap: [1] }],
      },
    ];
    project.scripts[0].blocks.draw = [
      { kind: "clearScreen", color: 0x00102030 },
      { kind: "drawSprite", sprite: "player" },
      { kind: "drawText", fontId: "tiny", text: "A", x: 0, y: 0, color: 0x00ffffff },
    ];

    const header = emitAssetsHeader(project);

    expect(header).toContain("#define FONT_TINY 0");
    expect(header).toContain("#define TILEMAP_LEVEL_1 0");
    expect(header).toContain("static const r96_font_def_t r96_font_defs[]");
    expect(header).toContain("static const int r96_font_glyph_codes[]");
    expect(header).toContain("  65,");
    expect(header).toContain("static const int r96_font_glyph_x_advances[]");
    expect(header).toContain("  2,");
    expect(header).toContain("static const r96_u8_t r96_font_row_bytes[]");
    expect(header).toContain("  1,");
    expect(header).toContain("{.line_height = 8, .glyph_count = 1, .glyph_offset = 0}");
    expect(header).toContain("static const unsigned short tilemap_level_1_tiles[]");
    expect(header).toContain("static const unsigned short tilemap_level_1_collision_tiles[]");
    expect(header).toContain(".collision_tiles = tilemap_level_1_collision_tiles");
    expect(header).toContain("static const r96_tilemap_def_t r96_tilemap_defs[]");
  });

  it("compacts tile-only tilesets to used frames in generated assets", () => {
    const project = structuredClone(sampleProject);
    project.sprites.push({
      id: "tileset",
      name: "Tileset",
      width: 1,
      height: 1,
      palette: [
        { index: 0, color: 0x00000000 },
        { index: 1, color: 0x00ff0000 },
        { index: 2, color: 0x0000ff00 },
        { index: 3, color: 0x000000ff },
      ],
      transparentIndex: 0,
      frames: [
        { id: "red", colorIndexes: [1] },
        { id: "green", colorIndexes: [2] },
        { id: "blue", colorIndexes: [3] },
      ],
      colliders: [],
    });
    project.tilemaps = [
      {
        id: "level_1",
        name: "Level 1",
        tilesetSpriteId: "tileset",
        width: 2,
        height: 2,
        tileWidth: 1,
        tileHeight: 1,
        tiles: [2, 0, 2, 0],
      },
    ];

    const header = emitAssetsHeader(project);

    expect(header).not.toContain("#define SPRITE_TILESET");
    expect(header).toContain("static const unsigned int sprite_tilemap_level_1_tileset_frame_0_pixels[1 * 1]");
    expect(header).toContain("static const unsigned int sprite_tilemap_level_1_tileset_frame_1_pixels[1 * 1]");
    expect(header).toContain("0x00ff0000");
    expect(header).toContain("0x000000ff");
    expect(header).not.toContain("0x0000ff00");
    expect(header).not.toContain("tilemap_level_1_collision_tiles[]");
    expect(header).toContain(".collision_tiles = 0");
    expect(header).toContain("  1, 0,");
  });

  it("emits an empty tile as a transparent frame", () => {
    const project = structuredClone(sampleProject);
    project.tilemaps = [
      {
        id: "empty_level",
        name: "Empty level",
        tilesetSpriteId: "player",
        width: 2,
        height: 1,
        tileWidth: 8,
        tileHeight: 8,
        tiles: [-1, 0],
      },
    ];
    project.scripts[0].blocks.draw = [];

    const header = emitAssetsHeader(project);

    expect(header).toContain("static const unsigned int sprite_tilemap_empty_level_tileset_frame_0_pixels[4 * 4]");
    expect(header).toContain("  0x00000000, 0x00000000, 0x00000000, 0x00000000,");
    expect(header).toContain("  0, 1,");
  });
});
