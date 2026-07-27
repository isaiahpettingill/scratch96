import { describe, expect, it } from "vite-plus/test";

import { parseBdf, parseYaff } from "./bitmapFont.ts";

describe("parseYaff", () => {
  it("parses Unicode labels, raster metrics, and bitmap rows", () => {
    const parsed = parseYaff([
      "name: Tiny YAFF",
      "spacing: character-cell",
      "raster-size: 4 6",
      "",
      "0x41:",
      "u+0041:",
      "    .@@.",
      "    @..@",
      "    @@@@",
      "    @..@",
      "",
    ].join("\n"));

    expect(parsed.lineHeight).toBe(6);
    expect(parsed.glyphs).toHaveLength(1);
    expect(parsed.glyphs[0]).toMatchObject({ code: 65, width: 4, height: 4, xAdvance: 4 });
    expect(parsed.glyphs[0].bitmap.join("")).toBe("0110100111111001");
  });

  it("uses per-glyph shift as advance when present", () => {
    const parsed = parseYaff([
      "raster-size: 8 8",
      "u+0021:",
      "shift: 3 0",
      "    @",
      "    @",
      "",
    ].join("\n"));

    expect(parsed.glyphs[0]).toMatchObject({ code: 33, width: 1, height: 2, xAdvance: 3 });
  });
});

describe("parseBdf", () => {
  it("keeps existing BDF parsing behavior", () => {
    const parsed = parseBdf([
      "STARTFONT 2.1",
      "FONTBOUNDINGBOX 5 8 0 0",
      "STARTCHAR A",
      "ENCODING 65",
      "DWIDTH 6 0",
      "BBX 5 7 0 0",
      "BITMAP",
      "20",
      "50",
      "88",
      "F8",
      "88",
      "88",
      "88",
      "ENDCHAR",
      "ENDFONT",
    ].join("\n"));

    expect(parsed.lineHeight).toBe(8);
    expect(parsed.glyphs[0]).toMatchObject({ code: 65, width: 5, height: 7, xAdvance: 6 });
  });
});
