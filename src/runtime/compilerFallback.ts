import type { CartridgeElf, SourceFile, TccCompiler } from "./adapters.ts";

export class CprocFallbackCompiler implements TccCompiler {
  constructor(
    private readonly tccCompiler: TccCompiler,
    private readonly cprocCompiler: TccCompiler,
    private readonly useCproc: () => boolean,
  ) {}

  async compile(sourceFiles: SourceFile[]): Promise<CartridgeElf> {
    if (!this.useCproc()) {
      return this.tccCompiler.compile(sourceFiles);
    }

    try {
      return await this.cprocCompiler.compile(sourceFiles);
    } catch {
      return this.tccCompiler.compile(sourceFiles);
    }
  }
}
