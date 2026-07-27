import { describe, expect, it } from "vitest";

import { createSpriteFromDecodedImage, createSpriteFromDecodedSpritesheet, parseSpritesheetMetadata } from "./spritesheetImport.ts";

describe("spritesheet import", () => {
  it("parses Pixelorama project JSON as a grid when frame rects are absent", () => {
    const metadata = parseSpritesheetMetadata(JSON.stringify({ fps: 6, frames: [{ duration: 1 }, { duration: 1 }] }), 112, 49);

    expect(metadata.frames).toEqual([
      { name: "Frame 1", x: 0, y: 0, w: 56, h: 49, duration: 1 },
      { name: "Frame 2", x: 56, y: 0, w: 56, h: 49, duration: 1 },
    ]);
    expect(metadata.animations).toEqual([{ id: "default", name: "Default", from: 0, to: 1, direction: "forward", repeat: 0 }]);
  });

  it("parses common Aseprite JSON array frames and frame tags", () => {
    const metadata = parseSpritesheetMetadata(
      JSON.stringify({
        frames: [
          { filename: "idle 0", frame: { x: 0, y: 0, w: 8, h: 8 }, duration: 100 },
          { filename: "idle 1", frame: { x: 8, y: 0, w: 8, h: 8 }, duration: 100 },
        ],
        meta: { frameTags: [{ name: "idle", from: 0, to: 1, direction: "pingpong" }] },
      }),
      16,
      8,
    );

    expect(metadata.frames.map((frame) => frame.name)).toEqual(["idle 0", "idle 1"]);
    expect(metadata.frames[1]).toMatchObject({ x: 8, y: 0, w: 8, h: 8 });
    expect(metadata.animations).toEqual([{ id: "idle", name: "idle", from: 0, to: 1, direction: "pingpong", repeat: 0 }]);
  });

  it("parses common hash frame metadata", () => {
    const metadata = parseSpritesheetMetadata(
      JSON.stringify({ frames: { "run-0.png": { frame: { x: 0, y: 0, w: 4, h: 4 } } } }),
      4,
      4,
    );

    expect(metadata.frames).toEqual([{ name: "run-0.png", x: 0, y: 0, w: 4, h: 4, duration: undefined }]);
  });

  it("parses Aseprite JSON hash exports with tags", () => {
    const metadata = parseSpritesheetMetadata(
      JSON.stringify({
        frames: {
          "walk 0.aseprite": { frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 80 },
          "walk 1.aseprite": { frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 90 },
        },
        meta: { frameTags: [{ name: "walk", from: 0, to: 1, direction: "forward" }] },
      }),
      32,
      16,
    );

    expect(metadata.frames).toEqual([
      { name: "walk 0.aseprite", x: 0, y: 0, w: 16, h: 16, duration: 80 },
      { name: "walk 1.aseprite", x: 16, y: 0, w: 16, h: 16, duration: 90 },
    ]);
    expect(metadata.animations).toEqual([{ id: "walk", name: "walk", from: 0, to: 1, direction: "forward", repeat: 0 }]);
  });

  it("parses Piskel project metadata as a spritesheet grid", () => {
    const metadata = parseSpritesheetMetadata(
      JSON.stringify({
        modelVersion: 2,
        piskel: {
          name: "hero",
          width: 12,
          height: 10,
          fps: 8,
          layers: [JSON.stringify({ name: "Layer 1", frameCount: 3 })],
        },
      }),
      36,
      10,
    );

    expect(metadata.frames).toEqual([
      { name: "Frame 1", x: 0, y: 0, w: 12, h: 10, duration: undefined },
      { name: "Frame 2", x: 12, y: 0, w: 12, h: 10, duration: undefined },
      { name: "Frame 3", x: 24, y: 0, w: 12, h: 10, duration: undefined },
    ]);
    expect(metadata.animations).toEqual([{ id: "default", name: "Default", from: 0, to: 2, direction: "forward", repeat: 0 }]);
  });

  it("parses PixiEditor-style grid metadata", () => {
    const metadata = parseSpritesheetMetadata(
      JSON.stringify({ frameWidth: 8, frameHeight: 8, frameCount: 4, columns: 2 }),
      16,
      16,
    );

    expect(metadata.frames).toEqual([
      { name: "Frame 1", x: 0, y: 0, w: 8, h: 8, duration: undefined },
      { name: "Frame 2", x: 8, y: 0, w: 8, h: 8, duration: undefined },
      { name: "Frame 3", x: 0, y: 8, w: 8, h: 8, duration: undefined },
      { name: "Frame 4", x: 8, y: 8, w: 8, h: 8, duration: undefined },
    ]);
  });

  it("parses SpritePaint-style cell metadata", () => {
    const metadata = parseSpritesheetMetadata(
      JSON.stringify({ cellWidth: 6, cellHeight: 6, framesCount: 2, cols: 1, frames: [{ name: "idle" }, { name: "blink" }] }),
      6,
      12,
    );

    expect(metadata.frames).toEqual([
      { name: "idle", x: 0, y: 0, w: 6, h: 6, duration: undefined },
      { name: "blink", x: 0, y: 6, w: 6, h: 6, duration: undefined },
    ]);
  });

  it("parses nested rectangle descriptors from other sprite sheet tools", () => {
    const metadata = parseSpritesheetMetadata(
      JSON.stringify({ sprites: [{ name: "jump", bounds: { left: 4, top: 8, width: 16, height: 12 } }] }),
      32,
      32,
    );

    expect(metadata.frames).toEqual([{ name: "jump", x: 4, y: 8, w: 16, h: 12, duration: undefined }]);
  });

  it("creates indexed frames and auto-adds used colors", () => {
    const imageFile = new File([new Uint8Array([1])], "sprite.png", { type: "image/png" });
    const jsonText = JSON.stringify({ frames: [{}, {}] });
    const jsonFile = new File([jsonText], "sprite.json", { type: "application/json" });
    const sprite = createSpriteFromDecodedSpritesheet(
      imageFile,
      [1],
      jsonFile,
      [...new TextEncoder().encode(jsonText)],
      {
        width: 4,
        height: 2,
        pixels: new Uint8ClampedArray([
          255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 255, 0, 0, 0, 0,
          0, 0, 255, 255, 0, 0, 0, 0, 255, 255, 0, 255, 0, 0, 0, 0,
        ]),
      },
      [],
    );

    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(2);
    expect(sprite.palette.map((entry) => entry.color)).toEqual([0x00000000, 0xff0000, 0x0000ff, 0x00ff00, 0xffff00]);
    expect(sprite.frames).toHaveLength(2);
    expect(sprite.frames[0].colorIndexes).toEqual([1, 0, 2, 0]);
    expect(sprite.frames[1].colorIndexes).toEqual([3, 0, 4, 0]);
    expect(sprite.animations?.[0]).toMatchObject({ name: "Default", from: 0, to: 1 });
  });

  it("imports a plain image as a single decoded sprite frame", () => {
    const imageFile = new File([new Uint8Array([1])], "tile.png", { type: "image/png" });
    const sprite = createSpriteFromDecodedImage(
      imageFile,
      [1],
      {
        width: 2,
        height: 1,
        pixels: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]),
      },
      [],
    );

    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(1);
    expect(sprite.frames).toHaveLength(1);
    expect(sprite.frames[0].colorIndexes).toEqual([1, 0]);
  });
});
