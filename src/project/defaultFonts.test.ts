import { describe, expect, it } from "vite-plus/test";

import { defaultMsxFont } from "./defaultFonts.ts";

describe("defaultMsxFont", () => {
  it("includes printable ASCII glyphs from MSX International", () => {
    const glyphs = new Map(defaultMsxFont.glyphs.map((glyph) => [String.fromCharCode(glyph.code), glyph]));

    expect(defaultMsxFont).toMatchObject({ id: "msx_international_8x8", name: "MSX International 8x8", lineHeight: 8 });
    expect(glyphs.size).toBe(95);
    expect(glyphs.get("H")).toMatchObject({ width: 8, height: 8, xAdvance: 8 });
    expect(rowsFor("H")).toEqual(["10001000", "10001000", "10001000", "11111000", "10001000", "10001000", "10001000", "00000000"]);
    expect(rowsFor("e")).toEqual(["00000000", "00000000", "01110000", "10001000", "11111000", "10000000", "01110000", "00000000"]);
    expect(rowsFor(" ")).toEqual(["00000000", "00000000", "00000000", "00000000", "00000000", "00000000", "00000000", "00000000"]);
  });

  it("stores matching YAFF source data", () => {
    const source = new TextDecoder().decode(new Uint8Array(defaultMsxFont.source?.data ?? []));

    expect(defaultMsxFont.source).toMatchObject({ filename: "msx-international.yaff", mimeType: "font/yaff" });
    expect(source).toContain("raster-size: 8 8");
    expect(source).toContain("hoard-of-bitfonts msx/msx-international.yaff");
    expect(source).toContain("u+0048:");
    expect(source).toContain("    @...@...");
  });
});

function rowsFor(character: string): string[] {
  const glyph = defaultMsxFont.glyphs.find((candidate) => candidate.code === character.charCodeAt(0));
  if (!glyph) return [];

  const rows: string[] = [];
  for (let y = 0; y < glyph.height; y++) {
    rows.push(glyph.bitmap.slice(y * glyph.width, y * glyph.width + glyph.width).join(""));
  }
  return rows;
}
