import { describe, expect, it } from "vitest";

import { quantizeSpritePixels } from "./paletteQuantize.ts";

describe("palette quantization", () => {
  it("keeps transparent index and reduces high color images to 256 palette colors", () => {
    const width = 32;
    const height = 16;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      pixels[offset] = (index * 17) & 0xff;
      pixels[offset + 1] = (index * 31) & 0xff;
      pixels[offset + 2] = (index * 47) & 0xff;
      pixels[offset + 3] = 255;
    }
    pixels[3] = 0;

    const result = quantizeSpritePixels({ width, height, pixels }, [{ x: 0, y: 0, w: width, h: height }]);

    expect(result.palette).toHaveLength(256);
    expect(result.palette[0]).toEqual({ index: 0, color: 0 });
    expect(result.frames[0]?.colorIndexes).toHaveLength(width * height);
    expect(result.frames[0]?.colorIndexes[0]).toBe(0);
    expect(Math.max(...(result.frames[0]?.colorIndexes ?? []))).toBeLessThan(256);
  });

  it("keeps exact colors when the image already fits the palette", () => {
    const result = quantizeSpritePixels(
      {
        width: 3,
        height: 1,
        pixels: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0]),
      },
      [{ x: 0, y: 0, w: 3, h: 1 }],
    );

    expect(result.palette.map((entry) => entry.color)).toEqual([0, 0xff0000, 0x00ff00]);
    expect(result.frames[0]?.colorIndexes).toEqual([1, 2, 0]);
  });
});
