import { describe, expect, it, vi } from "vite-plus/test";

import type { CartridgeElf, SourceFile, TccCompiler } from "./adapters.ts";
import { CprocFallbackCompiler } from "./compilerFallback.ts";

const sourceFiles: SourceFile[] = [{ path: "main.c", contents: "int main(void) { return 0; }" }];

describe("CprocFallbackCompiler", () => {
  it("uses TinyCC when cproc is disabled", async () => {
    const tccElf: CartridgeElf = { bytes: new Uint8Array([1]) };
    const tccCompile = vi.fn(async (_sourceFiles: SourceFile[]) => tccElf);
    const cprocCompile = vi.fn(async (_sourceFiles: SourceFile[]) => ({ bytes: new Uint8Array([2]) }));
    const compiler = createCompiler(tccCompile, cprocCompile, false);

    await expect(compiler.compile(sourceFiles)).resolves.toBe(tccElf);

    expect(tccCompile).toHaveBeenCalledWith(sourceFiles);
    expect(cprocCompile).not.toHaveBeenCalled();
  });

  it("uses cproc output when cproc succeeds", async () => {
    const cprocElf: CartridgeElf = { bytes: new Uint8Array([2]) };
    const tccCompile = vi.fn(async (_sourceFiles: SourceFile[]) => ({ bytes: new Uint8Array([1]) }));
    const cprocCompile = vi.fn(async (_sourceFiles: SourceFile[]) => cprocElf);
    const compiler = createCompiler(tccCompile, cprocCompile, true);

    await expect(compiler.compile(sourceFiles)).resolves.toBe(cprocElf);

    expect(cprocCompile).toHaveBeenCalledWith(sourceFiles);
    expect(tccCompile).not.toHaveBeenCalled();
  });

  it("falls back to TinyCC when cproc fails", async () => {
    const tccElf: CartridgeElf = { bytes: new Uint8Array([1]) };
    const tccCompile = vi.fn(async (_sourceFiles: SourceFile[]) => tccElf);
    const cprocCompile = vi.fn(async (_sourceFiles: SourceFile[]) => {
      throw new Error("cproc failed");
    });
    const compiler = createCompiler(tccCompile, cprocCompile, true);

    await expect(compiler.compile(sourceFiles)).resolves.toBe(tccElf);

    expect(cprocCompile).toHaveBeenCalledWith(sourceFiles);
    expect(tccCompile).toHaveBeenCalledWith(sourceFiles);
  });
});

function createCompiler(
  tccCompile: TccCompiler["compile"],
  cprocCompile: TccCompiler["compile"],
  useCproc: boolean,
): CprocFallbackCompiler {
  return new CprocFallbackCompiler(
    { compile: tccCompile },
    { compile: cprocCompile },
    () => useCproc,
  );
}
