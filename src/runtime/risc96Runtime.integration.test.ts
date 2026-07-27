/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleProject } from "../project/sampleProject.ts";
import { lowerStarterWorkspaceToBlocks } from "../editor/blocks/v0StarterWorkspace.ts";
import { createBitmapFontAsset } from "../project/bitmapFont.ts";
import type { Risc96Project } from "../project/model.ts";
import type { TccCompiler } from "./adapters.ts";
import { BrowserTccWasmCompiler } from "./browserAdapters.ts";
import { BrowserCprocWasmCompiler } from "./browserCprocCompiler.ts";
import { buildCartridge } from "./buildPipeline.ts";

// @ts-expect-error The vendored Emscripten module is plain JS without local types.
import createRisc96Embed from "../../public/wasm/risc96_embed.js";

describe("Risc96 runtime", () => {
  it.each([
    ["sample project", sampleProject],
    [
      "starter workspace",
      { ...sampleProject, scripts: [{ ...sampleProject.scripts[0], blocks: lowerStarterWorkspaceToBlocks() }] },
    ],
  ])("runs one frame of the default template cartridge from %s", async (_name, project) => {
    await expectProjectRunsOneFrame(project);
  });

  it("runs one frame of the default template cartridge compiled by cproc", async () => {
    await expectProjectRunsOneFrame(sampleProject, new BrowserCprocWasmCompiler());
  });

  it("renders an uploaded YAFF font through direct drawText without trapping", async () => {
    const font = createBitmapFontAsset(
      new File(
        [
          [
            "name: Uploaded Tiny",
            "raster-size: 4 4",
            "u+0041:",
            "@@@@",
            "@..@",
            "@@@@",
            "@..@",
            "",
          ].join("\n"),
        ],
        "uploaded-tiny.yaff",
        { type: "font/yaff" },
      ),
      Array.from(
        new TextEncoder().encode(
          [
            "name: Uploaded Tiny",
            "raster-size: 4 4",
            "u+0041:",
            "@@@@",
            "@..@",
            "@@@@",
            "@..@",
            "",
          ].join("\n"),
        ),
      ),
      sampleProject.fonts,
    );
    const project: Risc96Project = {
      ...sampleProject,
      fonts: [...sampleProject.fonts, font],
      scripts: [
        {
          ...sampleProject.scripts[0],
          blocks: {
            start: [{ kind: "setResolution", width: 320, height: 224 }],
            update: [],
            draw: [
              { kind: "clearScreen", color: 0x00000000 },
              { kind: "drawText", fontId: font.id, text: "A", x: 319, y: 223, color: 0x00abcdef },
            ],
          },
        },
      ],
    };

    const module = await runProjectOneFrame(project);
    const framebuffer = module._risc96_framebuffer_ptr();
    const pitch = module._risc96_framebuffer_pitch();
    const pixel = module.HEAPU32[((framebuffer + 223 * pitch) >> 2) + 319];

    expect(pixel).toBe(0x00abcdef);
  });
});

async function expectProjectRunsOneFrame(
  project: Risc96Project,
  compiler: TccCompiler = new BrowserTccWasmCompiler(),
): Promise<void> {
  await runProjectOneFrame(project, compiler);
}

async function runProjectOneFrame(
  project: Risc96Project,
  compiler: TccCompiler = new BrowserTccWasmCompiler(),
): Promise<Risc96EmbedModule> {
  const [tccLoader, tccWasm, cprocLoader, cprocWasm, qbeLoader, qbeWasm] = await Promise.all([
    readFile(join(process.cwd(), "public/wasm/tcc-wasm.js")),
    readFile(join(process.cwd(), "public/wasm/tcc-wasm.wasm")),
    readFile(join(process.cwd(), "public/wasm/cproc-qbe.js")),
    readFile(join(process.cwd(), "public/wasm/cproc-qbe.wasm")),
    readFile(join(process.cwd(), "public/wasm/qbe.js")),
    readFile(join(process.cwd(), "public/wasm/qbe.wasm")),
  ]);
  const risc96Wasm = await readFile(join(process.cwd(), "public/wasm/risc96_embed.wasm"));
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("risc96_embed")) {
      return new Response(risc96Wasm, { headers: { "Content-Type": "application/wasm" } });
    }
    if (url.includes("tcc-wasm.js")) {
      return new Response(tccLoader, { headers: { "Content-Type": "text/javascript" } });
    }
    if (url.includes("tcc-wasm.wasm")) {
      return new Response(tccWasm, { headers: { "Content-Type": "application/wasm" } });
    }
    if (url.includes("cproc-qbe.js")) {
      return new Response(cprocLoader, { headers: { "Content-Type": "text/javascript" } });
    }
    if (url.includes("cproc-qbe.wasm")) {
      return new Response(cprocWasm, { headers: { "Content-Type": "application/wasm" } });
    }
    if (url.includes("qbe.js")) {
      return new Response(qbeLoader, { headers: { "Content-Type": "text/javascript" } });
    }
    if (url.includes("qbe.wasm")) {
      return new Response(qbeWasm, { headers: { "Content-Type": "application/wasm" } });
    }
    return new Response(null, { status: 404 });
  });
  const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

  try {
    const build = await buildCartridge(project, compiler);
    expect(build.diagnostics).toEqual([]);
    expect(build.elf).toBeDefined();

    const wasmUrl = pathToFileURL(join(process.cwd(), "public/wasm/risc96_embed.wasm")).href;
    const module = await createRisc96Embed({ locateFile: () => wasmUrl });
    const bytes = build.elf?.bytes ?? new Uint8Array();
    const ptr = module._malloc(bytes.byteLength);
    module.HEAPU8.set(bytes, ptr);
    expect(module._risc96_load_cartridge(ptr, bytes.byteLength)).toBe(1);
    module._free(ptr);

    expect(() => module._risc96_run_frame(16, 2_000_000)).not.toThrow();
    return module;
  } finally {
    fetch.mockRestore();
    debug.mockRestore();
  }
}

type Risc96EmbedModule = {
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  _malloc(length: number): number;
  _free(ptr: number): void;
  _risc96_load_cartridge(ptr: number, length: number): number;
  _risc96_run_frame(maxSlices: number, maxInstructionsPerSlice: number): number;
  _risc96_framebuffer_ptr(): number;
  _risc96_framebuffer_pitch(): number;
};
