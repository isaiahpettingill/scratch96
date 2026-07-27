import { describe, expect, it, vi } from "vite-plus/test";

import { sampleProject } from "../project/sampleProject.ts";
import type { CartridgeElf, Risc96PreviewRuntime, SourceFile, TccCompiler } from "./adapters.ts";
import { MissingRisc96PreviewRuntime, MissingTccWasmCompiler } from "./browserAdapters.ts";
import { buildCartridge, runPreview } from "./buildPipeline.ts";

describe("buildCartridge", () => {
  it("passes generated cartridge files to the TCC compiler adapter", async () => {
    const elf: CartridgeElf = { bytes: new Uint8Array([1, 2, 3]) };
    const compile = vi.fn(async (_sourceFiles: SourceFile[]) => elf);
    const compiler: TccCompiler = {
      compile,
    };

    const result = await buildCartridge(sampleProject, compiler);

    expect(result).toEqual({ elf, diagnostics: [] });
    expect(compile).toHaveBeenCalledOnce();
    expect(compile.mock.calls[0][0].map((file) => file.path)).toEqual([
      "risc96_blockly_runtime.h",
      "generated_assets.h",
      "risc96_blockly_runtime.c",
      "main.c",
    ]);
  });

  it("surfaces missing TCC WASM as a diagnostic", async () => {
    const result = await buildCartridge(sampleProject, new MissingTccWasmCompiler());

    expect(result.elf).toBeUndefined();
    expect(result.diagnostics[0]).toContain("TCC WASM is not wired yet");
  });
});

describe("runPreview", () => {
  it("loads and runs the ELF when build succeeds", async () => {
    const elf: CartridgeElf = { bytes: new Uint8Array([1, 2, 3]) };
    const compiler: TccCompiler = { compile: vi.fn(async () => elf) };
    const load = vi.fn(async () => {});
    const run = vi.fn();
    const runtime: Risc96PreviewRuntime = {
      load,
      run,
      stop: vi.fn(),
      reset: vi.fn(async () => {}),
      setControllerState: vi.fn(),
    };

    const result = await runPreview(sampleProject, compiler, runtime);

    expect(result.ran).toBe(true);
    expect(load).toHaveBeenCalledWith(elf);
    expect(run).toHaveBeenCalledOnce();
  });

  it("does not run the preview if compilation fails", async () => {
    const runtime = new MissingRisc96PreviewRuntime();
    const result = await runPreview(sampleProject, new MissingTccWasmCompiler(), runtime);

    expect(result.ran).toBe(false);
    expect(result.diagnostics[0]).toContain("TCC WASM is not wired yet");
  });
});
