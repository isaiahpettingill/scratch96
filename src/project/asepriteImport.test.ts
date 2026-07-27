import { deflateSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { importAsepriteSprite, parseAseprite } from "./asepriteImport.ts";

describe("Aseprite import", () => {
  it("imports current multi-frame files with UUID layers, linked cels, and repeated tags", async () => {
    const originalFetch = globalThis.fetch;
    const wasmBytes = await readFile(join(process.cwd(), "src/project/asepriteWasm/aseprite_import_bg.wasm"));
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("aseprite_import_bg.wasm")) return new Response(wasmBytes, { headers: { "Content-Type": "application/wasm" } });
      return originalFetch(input);
    };

    const bytes = createAsepriteFixture();
    try {
      await expect(parseAseprite(bytes)).resolves.toMatchObject({ frames: [{}, {}, {}] });

      const sprite = await importAsepriteSprite(new File([bytes.buffer as ArrayBuffer], "hero.aseprite"), [...bytes], []);

      expect(sprite.width).toBe(2);
      expect(sprite.height).toBe(1);
      expect(sprite.frames).toHaveLength(3);
      expect(sprite.palette.map((entry) => entry.color)).toEqual([0x00000000, 0xff0000, 0x0000ff]);
      expect(sprite.frames.map((frame) => frame.colorIndexes)).toEqual([
        [1, 0],
        [0, 1],
        [0, 2],
      ]);
      expect(sprite.animations).toEqual([
        { id: "idle_loop", name: "idle-loop", from: 0, to: 1, direction: "pingpong", repeat: 0 },
        { id: "burst", name: "burst", from: 1, to: 2, direction: "reverse", repeat: 2 },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function createAsepriteFixture(): Uint8Array {
  const chunks = [
    [layerChunk("sprite", true), paletteChunk(), celChunk({ x: 0, y: 0, colorIndex: 1 })],
    [linkedCelChunk({ x: 1, y: 0, link: 0 }), tagsChunk()],
    [celChunk({ x: 1, y: 0, colorIndex: 2 })],
  ];
  return aseFile(chunks.map((frameChunks, index) => frame(frameChunks, index === 1)));
}

function aseFile(frames: Uint8Array[]): Uint8Array {
  const header = new Writer();
  const size = 128 + frames.reduce((sum, item) => sum + item.byteLength, 0);
  header.u32(size);
  header.u16(0xa5e0);
  header.u16(frames.length);
  header.u16(2);
  header.u16(1);
  header.u16(8);
  header.u32(4);
  header.u16(100);
  header.u32(0);
  header.u32(0);
  header.u8(0);
  header.bytes(new Uint8Array(3));
  header.u16(3);
  header.u8(1);
  header.u8(1);
  header.i16(0);
  header.i16(0);
  header.u16(0);
  header.u16(0);
  header.bytes(new Uint8Array(84));
  return concat([header.finish(), ...frames]);
}

function frame(chunks: Uint8Array[], useOldChunkCount: boolean): Uint8Array {
  const body = concat(chunks);
  const writer = new Writer();
  writer.u32(16 + body.byteLength);
  writer.u16(0xf1fa);
  writer.u16(useOldChunkCount ? chunks.length : 0xffff);
  writer.u16(100);
  writer.u16(0);
  writer.u32(useOldChunkCount ? 0 : chunks.length);
  writer.bytes(body);
  return writer.finish();
}

function layerChunk(name: string, visible: boolean): Uint8Array {
  return chunk(0x2004, (writer) => {
    writer.u16(visible ? 1 : 0);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u8(255);
    writer.bytes(new Uint8Array(3));
    writer.string(name);
    writer.bytes(new Uint8Array(16));
  });
}

function paletteChunk(): Uint8Array {
  return chunk(0x2019, (writer) => {
    writer.u32(3);
    writer.u32(1);
    writer.u32(2);
    writer.bytes(new Uint8Array(8));
    writer.u16(0);
    writer.u8(255);
    writer.u8(0);
    writer.u8(0);
    writer.u8(255);
    writer.u16(0);
    writer.u8(0);
    writer.u8(0);
    writer.u8(255);
    writer.u8(255);
  });
}

function celChunk(options: { x: number; y: number; colorIndex: number }): Uint8Array {
  return chunk(0x2005, (writer) => {
    writer.u16(0);
    writer.i16(options.x);
    writer.i16(options.y);
    writer.u8(255);
    writer.u16(2);
    writer.i16(0);
    writer.bytes(new Uint8Array(5));
    writer.u16(1);
    writer.u16(1);
    writer.bytes(deflateSync(new Uint8Array([options.colorIndex])));
  });
}

function linkedCelChunk(options: { x: number; y: number; link: number }): Uint8Array {
  return chunk(0x2005, (writer) => {
    writer.u16(0);
    writer.i16(options.x);
    writer.i16(options.y);
    writer.u8(255);
    writer.u16(1);
    writer.i16(0);
    writer.bytes(new Uint8Array(5));
    writer.u16(options.link);
  });
}

function tagsChunk(): Uint8Array {
  return chunk(0x2018, (writer) => {
    writer.u16(2);
    writer.bytes(new Uint8Array(8));
    tag(writer, { from: 0, to: 1, direction: 2, repeat: 0, name: "idle-loop" });
    tag(writer, { from: 1, to: 2, direction: 1, repeat: 2, name: "burst" });
  });
}

function tag(writer: Writer, options: { from: number; to: number; direction: number; repeat: number; name: string }): void {
  writer.u16(options.from);
  writer.u16(options.to);
  writer.u8(options.direction);
  writer.u16(options.repeat);
  writer.bytes(new Uint8Array(6));
  writer.bytes(new Uint8Array(3));
  writer.u8(0);
  writer.string(options.name);
}

function chunk(type: number, write: (writer: Writer) => void): Uint8Array {
  const body = new Writer();
  write(body);
  const data = body.finish();
  const writer = new Writer();
  writer.u32(6 + data.byteLength);
  writer.u16(type);
  writer.bytes(data);
  return writer.finish();
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

class Writer {
  private data: number[] = [];

  u8(value: number): void {
    this.data.push(value & 0xff);
  }

  u16(value: number): void {
    this.u8(value);
    this.u8(value >> 8);
  }

  i16(value: number): void {
    this.u16(value < 0 ? 0x10000 + value : value);
  }

  u32(value: number): void {
    this.u8(value);
    this.u8(value >> 8);
    this.u8(value >> 16);
    this.u8(value >> 24);
  }

  string(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.u16(encoded.byteLength);
    this.bytes(encoded);
  }

  bytes(value: Uint8Array): void {
    this.data.push(...value);
  }

  finish(): Uint8Array {
    return new Uint8Array(this.data);
  }
}
