/// <reference types="node" />

import { mkdir, readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleProject } from "../project/sampleProject.ts";
import type { Risc96Project } from "../project/model.ts";
import { compileProjectToC } from "../compiler/emitC.ts";
import { BrowserTccWasmCompiler, flattenTccSourceFiles } from "./browserAdapters.ts";
import { BrowserCprocWasmCompiler } from "./browserCprocCompiler.ts";
import { buildCartridge } from "./buildPipeline.ts";

describe("DSL to risc96 binary", () => {
  it("links RISC-V assembly into an executable ELF via TCC WASM", async () => {
    const fetch = await mockTccFetch();
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    try {
      const result = await new BrowserTccWasmCompiler().linkAssembly(`
.data
.balign 8
scratch96_self_pointer:
  .quad _start+0

.text
.globl _start
_start:
  ecall
`);

      expect(parseElfHeader(result.bytes)).toMatchObject({
        className: "ELF64",
        data: "little-endian",
        type: "EXEC",
        machine: "RISC-V",
        programHeaders: expect.any(Number),
      });
      expect(parseElfHeader(result.bytes).programHeaders).toBeGreaterThan(0);
    } finally {
      fetch.mockRestore();
      debug.mockRestore();
    }
  });

  it("compiles project metadata, scripts, and assets into a RISC-V executable ELF via TCC WASM", async () => {
    const fetch = await mockTccFetch();
    const logs: string[] = [];
    const debug = vi.spyOn(console, "debug").mockImplementation((message) => {
      logs.push(String(message));
    });

    const result = await buildCartridge(sampleProject, new BrowserTccWasmCompiler());

    if (result.diagnostics.length > 0) {
      const compiled = compileProjectToC(sampleProject);
      await mkdir(join(process.cwd(), "build-proof"), { recursive: true });
      await writeFile(
        join(process.cwd(), "build-proof/sample-from-dsl.c"),
        flattenTccSourceFiles(compiled.files),
      );
      await writeFile(join(process.cwd(), "build-proof/sample-from-dsl.tcc.log"), logs.join("\n"));
    }

    expect(result.diagnostics).toEqual([]);
    expect(result.elf).toBeDefined();
    await mkdir(join(process.cwd(), "build-proof"), { recursive: true });
    await writeFile(
      join(process.cwd(), "build-proof/sample-from-dsl.elf"),
      result.elf?.bytes ?? new Uint8Array(),
    );
    expect(parseElfHeader(result.elf?.bytes ?? new Uint8Array())).toMatchObject({
      className: "ELF64",
      data: "little-endian",
      type: "EXEC",
      machine: "RISC-V",
      programHeaders: expect.any(Number),
    });
    expect(parseElfHeader(result.elf?.bytes ?? new Uint8Array()).programHeaders).toBeGreaterThan(0);

    fetch.mockRestore();
    debug.mockRestore();
  });

  it("compiles project metadata, scripts, and assets into a RISC-V executable ELF via cproc WASM", async () => {
    const fetch = await mockTccFetch();
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    try {
      const result = await buildCartridge(sampleProject, new BrowserCprocWasmCompiler());

      expect(result.diagnostics).toEqual([]);
      expect(result.elf).toBeDefined();
      expect(parseElfHeader(result.elf?.bytes ?? new Uint8Array())).toMatchObject({
        className: "ELF64",
        data: "little-endian",
        type: "EXEC",
        machine: "RISC-V",
        programHeaders: expect.any(Number),
      });
    } finally {
      fetch.mockRestore();
      debug.mockRestore();
    }
  });

  it("compiles tilemap draw commands via TCC WASM", async () => {
    const fetch = await mockTccFetch();
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const project = structuredClone(sampleProject);
    project.tilemaps = [
      { id: "level_1", name: "Level 1", tilesetSpriteId: "player", width: 1, height: 1, tileWidth: 4, tileHeight: 4, tiles: [0] },
    ];
    project.scripts[0].blocks.update = [];
    project.scripts[0].blocks.draw = [
      { kind: "drawTilemap", tilemapId: "level_1", x: 0, y: 0 },
      {
        kind: "drawRect",
        x: { kind: "integer", value: 4 },
        y: { kind: "integer", value: 4 },
        width: { kind: "integer", value: 8 },
        height: { kind: "integer", value: 6 },
        color: 0x00ff00ff,
        filled: true,
      },
    ];

    try {
      const result = await buildCartridge(project, new BrowserTccWasmCompiler());

      if (result.diagnostics.length > 0) {
        const compiled = compileProjectToC(project);
        await mkdir(join(process.cwd(), "build-proof"), { recursive: true });
        await writeFile(join(process.cwd(), "build-proof/font-tilemap-from-dsl.c"), flattenTccSourceFiles(compiled.files));
      }

      expect(result.diagnostics).toEqual([]);
      expect(result.elf).toBeDefined();
    } finally {
      fetch.mockRestore();
      debug.mockRestore();
    }
  });

  it("compiles sprite tilemap collision commands via TCC WASM", async () => {
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
    project.scripts[0].blocks.draw = [];
    project.scripts[0].blocks.update = [
      {
        kind: "if",
        condition: {
          kind: "spriteTouchingTilemap",
          sprite: "player",
          tilemapId: "level_1",
          x: { kind: "integer", value: 0 },
          y: { kind: "integer", value: 0 },
        },
        thenCommands: [{ kind: "debugLog", text: "solid" }],
        elseCommands: [],
      },
    ];

    await expectTccBuilds(project, "tilemap-collision-from-dsl.c");
  });

  it("compiles advanced sprite scale and effects rendering via TCC WASM", async () => {
    const fetch = await mockTccFetch();
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.draw = [];
    project.scripts[0].blocks.update = [
      { kind: "setSpriteScale", sprite: "player", scale: { kind: "integer", value: 200 } },
      { kind: "setSpriteEffect", sprite: "player", effect: "invert", value: { kind: "integer", value: 1 } },
    ];

    try {
      const result = await buildCartridge(project, new BrowserTccWasmCompiler());

      if (result.diagnostics.length > 0) {
        const compiled = compileProjectToC(project);
        await mkdir(join(process.cwd(), "build-proof"), { recursive: true });
        await writeFile(join(process.cwd(), "build-proof/advanced-rendering-from-dsl.c"), flattenTccSourceFiles(compiled.files));
      }

      expect(result.diagnostics).toEqual([]);
      expect(result.elf).toBeDefined();
    } finally {
      fetch.mockRestore();
      debug.mockRestore();
    }
  });

  it.each([
    {
      name: "scale only",
      update: [{ kind: "setSpriteScale", sprite: "player", scale: { kind: "integer", value: 200 } }] as const,
    },
    {
      name: "invert effect only",
      update: [{ kind: "setSpriteEffect", sprite: "player", effect: "invert", value: { kind: "integer", value: 1 } }] as const,
    },
    {
      name: "brightness effect only",
      update: [{ kind: "setSpriteEffect", sprite: "player", effect: "brightness", value: { kind: "integer", value: 4 } }] as const,
    },
    {
      name: "clear effects after scale",
      update: [
        { kind: "setSpriteScale", sprite: "player", scale: { kind: "integer", value: 200 } },
        { kind: "clearSpriteEffects", sprite: "player" },
      ] as const,
    },
  ])("compiles advanced sprite combination via TCC WASM: $name", async ({ name, update }) => {
    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.draw = [];
    project.scripts[0].blocks.update = [...update];

    await expectTccBuilds(project, `advanced-${name.replace(/\s+/g, "-")}.c`);
  });

  const nestedAdvancedCases: NestedAdvancedCase[] = [
    {
      name: "repeat body",
      configure(project) {
        project.scripts[0].blocks.update = [
          {
            kind: "repeat",
            times: { kind: "integer", value: 1 },
            commands: [{ kind: "setSpriteScale", sprite: "player", scale: { kind: "integer", value: 200 } }],
          },
        ];
      },
    },
    {
      name: "event handler",
      configure(project) {
        project.scripts[0].blocks.update = [];
        project.scripts[0].blocks.events = [
          { event: "zoom", commands: [{ kind: "setSpriteEffect", sprite: "player", effect: "invert", value: { kind: "integer", value: 1 } }] },
        ];
      },
    },
    {
      name: "timer handler",
      configure(project) {
        project.scripts[0].blocks.update = [];
        project.scripts[0].blocks.timerEvents = [
          { timer: "main", ticks: 30, commands: [{ kind: "clearSpriteEffects", sprite: "player" }] },
        ];
      },
    },
    {
      name: "procedure body",
      configure(project) {
        project.scripts[0].blocks.update = [{ kind: "callProcedure", name: "grow" }];
        project.scripts[0].blocks.procedures = [
          { name: "grow", commands: [{ kind: "changeSpriteScale", sprite: "player", amount: { kind: "integer", value: 10 } }] },
        ];
      },
    },
  ];

  it.each(nestedAdvancedCases)("compiles advanced sprite command in nested script via TCC WASM: $name", async (testCase) => {
    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.draw = [];
    testCase.configure(project);

    await expectTccBuilds(project, `advanced-nested-${testCase.name.replace(/\s+/g, "-")}.c`);
  });
});

type NestedAdvancedCase = {
  name: string;
  configure: (project: Risc96Project) => void;
};

async function expectTccBuilds(project: Risc96Project, dumpName: string): Promise<void> {
  const fetch = await mockTccFetch();
  const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

  try {
    const result = await buildCartridge(project, new BrowserTccWasmCompiler());

    if (result.diagnostics.length > 0) {
      const compiled = compileProjectToC(project);
      await mkdir(join(process.cwd(), "build-proof"), { recursive: true });
      await writeFile(join(process.cwd(), "build-proof", dumpName), flattenTccSourceFiles(compiled.files));
    }

    expect(result.diagnostics).toEqual([]);
    expect(result.elf).toBeDefined();
  } finally {
    fetch.mockRestore();
    debug.mockRestore();
  }
}

async function mockTccFetch() {
  const [loader, wasm, cprocLoader, cprocWasm, qbeLoader, qbeWasm] = await Promise.all([
    readFile(join(process.cwd(), "public/wasm/tcc-wasm.js")),
    readFile(join(process.cwd(), "public/wasm/tcc-wasm.wasm")),
    readFile(join(process.cwd(), "public/wasm/cproc-qbe.js")),
    readFile(join(process.cwd(), "public/wasm/cproc-qbe.wasm")),
    readFile(join(process.cwd(), "public/wasm/qbe.js")),
    readFile(join(process.cwd(), "public/wasm/qbe.wasm")),
  ]);

  return vi.spyOn(globalThis, "fetch").mockImplementation((input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.includes("tcc-wasm.js")) {
      return Promise.resolve(new Response(loader, { headers: { "Content-Type": "text/javascript" } }));
    }
    if (url.includes("tcc-wasm.wasm")) {
      return Promise.resolve(new Response(wasm, { headers: { "Content-Type": "application/wasm" } }));
    }
    if (url.includes("cproc-qbe.js")) {
      return Promise.resolve(new Response(cprocLoader, { headers: { "Content-Type": "text/javascript" } }));
    }
    if (url.includes("cproc-qbe.wasm")) {
      return Promise.resolve(new Response(cprocWasm, { headers: { "Content-Type": "application/wasm" } }));
    }
    if (url.includes("qbe.js")) {
      return Promise.resolve(new Response(qbeLoader, { headers: { "Content-Type": "text/javascript" } }));
    }
    if (url.includes("qbe.wasm")) {
      return Promise.resolve(new Response(qbeWasm, { headers: { "Content-Type": "application/wasm" } }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function parseElfHeader(bytes: Uint8Array): {
  className: "ELF32" | "ELF64";
  data: "little-endian" | "big-endian";
  type: "REL" | "EXEC" | "OTHER";
  machine: "RISC-V" | "OTHER";
  programHeaders: number;
} {
  expect(Array.from(bytes.slice(0, 4))).toEqual([0x7f, 0x45, 0x4c, 0x46]);

  const className = bytes[4] === 1 ? "ELF32" : "ELF64";
  const data = bytes[5] === 1 ? "little-endian" : "big-endian";
  const littleEndian = data === "little-endian";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const typeValue = view.getUint16(16, littleEndian);
  const machineValue = view.getUint16(18, littleEndian);
  const programHeaders =
    className === "ELF64" ? view.getUint16(56, littleEndian) : view.getUint16(44, littleEndian);

  return {
    className,
    data,
    type: typeValue === 1 ? "REL" : typeValue === 2 ? "EXEC" : "OTHER",
    machine: machineValue === 0xf3 ? "RISC-V" : "OTHER",
    programHeaders,
  };
}
