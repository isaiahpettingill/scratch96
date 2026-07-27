import { compileProjectToC } from "../compiler/emitC.ts";
import type { Risc96Project } from "../project/model.ts";
import type { CartridgeElf, Risc96PreviewRuntime, TccCompiler } from "./adapters.ts";

export type BuildCartridgeResult = {
  elf?: CartridgeElf;
  diagnostics: string[];
};

export type RunPreviewResult = BuildCartridgeResult & {
  ran: boolean;
};

export async function buildCartridge(
  project: Risc96Project,
  compiler: TccCompiler,
): Promise<BuildCartridgeResult> {
  const compiled = compileProjectToC(project);

  if (compiled.diagnostics.length > 0) {
    return { diagnostics: compiled.diagnostics };
  }

  try {
    return {
      elf: await compiler.compile(compiled.files),
      diagnostics: [],
    };
  } catch (error) {
    return {
      diagnostics: [error instanceof Error ? error.message : "Unknown TCC compile failure."],
    };
  }
}

export async function runPreview(
  project: Risc96Project,
  compiler: TccCompiler,
  runtime: Risc96PreviewRuntime,
): Promise<RunPreviewResult> {
  const build = await buildCartridge(project, compiler);

  if (!build.elf) {
    return { ...build, ran: false };
  }

  await runtime.load(build.elf);
  runtime.run();

  return { ...build, ran: true };
}
