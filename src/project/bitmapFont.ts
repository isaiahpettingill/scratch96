import type { FontAsset, FontGlyph, FontGlyphRun } from "./model.ts";

type ParsedFont = { lineHeight: number; glyphs: FontGlyph[] };

export function createBitmapFontAsset(file: File, bytes: number[], existing: FontAsset[]): FontAsset {
  const contents = new TextDecoder().decode(new Uint8Array(bytes));
  const parsed = isYaff(file.name, contents) ? parseYaff(contents) : parseBdf(contents);
  const id = uniqueId(existing, file.name);

  return {
    id,
    name: cleanName(file.name),
    source: { filename: file.name, mimeType: file.type || mimeTypeFor(file.name), data: bytes },
    lineHeight: parsed.lineHeight,
    glyphs: parsed.glyphs.map(compileBitmapGlyph),
  };
}

export function parseBdf(contents: string): ParsedFont {
  const lines = contents.split(/\r?\n/);
  const glyphs: FontGlyph[] = [];
  let lineHeight = 8;
  let current: Partial<FontGlyph> & { rows?: string[] } | undefined;
  let readingBitmap = false;

  for (const line of lines) {
    const [key, ...rest] = line.trim().split(/\s+/);
    const values = rest.map(Number);

    if (key === "FONTBOUNDINGBOX" && Number.isFinite(values[1])) lineHeight = values[1];
    if (key === "STARTCHAR") current = { rows: [] };
    if (!current) continue;

    if (key === "ENCODING") current.code = values[0];
    if (key === "DWIDTH") current.xAdvance = values[0];
    if (key === "BBX") {
      current.width = values[0];
      current.height = values[1];
      current.xOffset = values[2];
      current.yOffset = values[3];
    }
    if (key === "BITMAP") readingBitmap = true;
    else if (key === "ENDCHAR") {
      readingBitmap = false;
      const glyph = finalizeGlyph(current);
      if (glyph) glyphs.push(glyph);
      current = undefined;
    } else if (readingBitmap) {
      current.rows?.push(key);
    }
  }

  return { lineHeight, glyphs };
}

export function parseYaff(contents: string): ParsedFont {
  const lines = contents.split(/\r?\n/);
  const glyphs: FontGlyph[] = [];
  let lineHeight = 8;
  let rasterWidth = 0;
  let pendingCodes: { code: number; preferred: boolean }[] = [];
  let rows: string[] = [];
  let xAdvance: number | undefined;

  const flush = () => {
    if (!pendingCodes.length || !rows.length) return;
    const width = Math.max(...rows.map((row) => row.length));
    const code = pendingCodes.find((entry) => entry.preferred)?.code ?? pendingCodes[0].code;

    glyphs.push(compileBitmapGlyph({
      code,
      width,
      height: rows.length,
      xOffset: 0,
      yOffset: 0,
      xAdvance: xAdvance ?? (rasterWidth || width),
      bitmap: rows.flatMap((row) => paddedRow(row, width).map((pixel) => (pixel === "." ? 0 : 1))),
    }));
    pendingCodes = [];
    rows = [];
    xAdvance = undefined;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const codeLabel = parseYaffCodeLabel(trimmed);
    if (codeLabel) {
      if (rows.length) flush();
      pendingCodes.push(codeLabel);
      continue;
    }

    const bitmapRow = parseYaffBitmapRow(trimmed);
    if (bitmapRow) {
      rows.push(bitmapRow);
      continue;
    }

    const [key, value = ""] = trimmed.split(/:\s*/, 2);
    if (key === "raster-size") {
      const [width, height] = value.split(/\s+/).map(Number);
      if (Number.isFinite(width)) rasterWidth = width;
      if (Number.isFinite(height)) lineHeight = height;
    } else if (key === "line-height") {
      const valueNumber = Number(value);
      if (Number.isFinite(valueNumber)) lineHeight = valueNumber;
    } else if (key === "shift" && pendingCodes.length) {
      const [advance] = value.split(/\s+/).map(Number);
      if (Number.isFinite(advance)) xAdvance = advance;
    }
  }
  flush();

  return { lineHeight, glyphs };
}

function finalizeGlyph(glyph: Partial<FontGlyph> & { rows?: string[] }): FontGlyph | undefined {
  if (glyph.code === undefined || !glyph.width || !glyph.height) return undefined;
  const bitmap: number[] = [];

  for (const row of glyph.rows ?? []) {
    const value = Number.parseInt(row, 16);
    for (let bit = 0; bit < glyph.width; bit += 1) {
      bitmap.push((value >> (Math.ceil(glyph.width / 8) * 8 - bit - 1)) & 1);
    }
  }

  return compileBitmapGlyph({
    code: glyph.code,
    width: glyph.width,
    height: glyph.height,
    xOffset: glyph.xOffset ?? 0,
    yOffset: glyph.yOffset ?? 0,
    xAdvance: glyph.xAdvance ?? glyph.width,
    bitmap,
  });
}

export function compileBitmapGlyph(glyph: FontGlyph): FontGlyph {
  return { ...glyph, runs: compileGlyphRuns(glyph), rowMasks: compileGlyphRowMasks(glyph) };
}

export function glyphRuns(glyph: FontGlyph): FontGlyphRun[] {
  return glyph.runs ?? compileGlyphRuns(glyph);
}

export function glyphRowMasks(glyph: FontGlyph): number[] {
  return glyph.rowMasks ?? compileGlyphRowMasks(glyph);
}

function compileGlyphRuns(glyph: FontGlyph): FontGlyphRun[] {
  const runs: FontGlyphRun[] = [];

  for (let y = 0; y < glyph.height; y += 1) {
    let x = 0;
    while (x < glyph.width) {
      while (x < glyph.width && glyph.bitmap[y * glyph.width + x] === 0) x += 1;
      const start = x;
      while (x < glyph.width && glyph.bitmap[y * glyph.width + x] !== 0) x += 1;
      if (x > start) runs.push({ x: glyph.xOffset + start, y: glyph.yOffset + y, width: x - start });
    }
  }

  return runs;
}

function compileGlyphRowMasks(glyph: FontGlyph): number[] {
  const masks: number[] = [];

  for (let y = 0; y < glyph.height; y += 1) {
    let mask = 0;
    for (let x = 0; x < Math.min(glyph.width, 32); x += 1) {
      if (glyph.bitmap[y * glyph.width + x] !== 0) mask += 2 ** x;
    }
    masks.push(mask >>> 0);
  }

  return masks;
}

function parseYaffCodeLabel(label: string): { code: number; preferred: boolean } | undefined {
  const unicode = label.match(/^u\+([0-9a-f]+):$/i);
  if (unicode) return { code: Number.parseInt(unicode[1], 16), preferred: true };

  const hex = label.match(/^0x([0-9a-f]+):$/i);
  if (hex) return { code: Number.parseInt(hex[1], 16), preferred: false };

  const decimal = label.match(/^([0-9]+):$/);
  if (decimal) return { code: Number.parseInt(decimal[1], 10), preferred: false };

  const quoted = label.match(/^"(.)":$/u);
  if (quoted) return { code: quoted[1].codePointAt(0) ?? 0, preferred: true };

  return undefined;
}

function parseYaffBitmapRow(row: string): string | undefined {
  return /^[.@]+$/.test(row) ? row : undefined;
}

function paddedRow(row: string, width: number): string[] {
  return row.padEnd(width, ".").split("");
}

function isYaff(filename: string, contents: string): boolean {
  return filename.toLowerCase().endsWith(".yaff") || /^\s*(name|yaff|raster-size):/m.test(contents);
}

function mimeTypeFor(filename: string): string {
  return filename.toLowerCase().endsWith(".yaff") ? "font/yaff" : "font/bdf";
}

function uniqueId(items: { id: string }[], filename: string): string {
  const base = cleanName(filename).toLowerCase().replace(/[^a-z0-9_]+/g, "_") || "font";
  let id = base;
  let index = 2;

  while (items.some((item) => item.id === id)) {
    id = `${base}_${index}`;
    index += 1;
  }

  return id;
}

function cleanName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled font";
}
