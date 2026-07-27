import type { CartridgeElf, SourceFile, TccCompiler } from "./adapters.ts";
import { BrowserTccWasmCompiler, flattenTccSourceFiles } from "./browserAdapters.ts";
import { fetchVersionedAsset, fetchVersionedAssetBytes, getVersionedWasmAssets } from "./wasmAssets.ts";

type CprocToolModule = {
  HEAPU8: Uint8Array;
  _allocUint8(length: number): number;
  _compile_c_to_qbe(sourcePtr: number): number;
  _last_error(): number;
};

type QbeToolModule = {
  HEAPU8: Uint8Array;
  _allocUint8(length: number): number;
  _compile_qbe_to_assembly(irPtr: number): number;
  _last_error(): number;
};

type EmscriptenToolFactory<T> = (options: {
  locateFile(path: string): string;
  instantiateWasm(
    imports: WebAssembly.Imports,
    receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ): Record<string, never>;
}) => Promise<T>;

type ToolRuntime = {
  heap(): Uint8Array;
  allocUint8(length: number): number;
  run(inputPtr: number): number;
  lastError(): number;
};

type ToolAssetUrls = {
  loaderUrl: string;
  wasmUrl: string;
};

const defaultCprocLoaderUrl = "/wasm/cproc-qbe.js";
const defaultCprocWasmUrl = "/wasm/cproc-qbe.wasm";
const defaultQbeLoaderUrl = "/wasm/qbe.js";
const defaultQbeWasmUrl = "/wasm/qbe.wasm";

const r96Ecall7Assembly = `
.text
.globl r96_ecall7
.type r96_ecall7,@function
r96_ecall7:
  ecall
  ret
`;

export class BrowserCprocWasmCompiler implements TccCompiler {
  constructor(private readonly tccLinker = new BrowserTccWasmCompiler()) {}

  async compile(sourceFiles: SourceFile[]): Promise<CartridgeElf> {
    const source = prepareCprocSource(sourceFiles);
    const qbeIr = await this.compileCToQbe(source);
    const assembly = await this.compileQbeToAssembly(normalizeQbeIr(qbeIr));

    return this.tccLinker.linkAssembly(`${normalizeQbeAssembly(assembly)}\n${r96Ecall7Assembly}`);
  }

  private async compileCToQbe(source: string): Promise<string> {
    const urls = await resolveCprocAssetUrls();
    const runtime = await loadCprocTool(urls.loaderUrl, urls.wasmUrl);
    const output = runTextTool(runtime, source, "cproc did not emit QBE IR.");
    return new TextDecoder().decode(output);
  }

  private async compileQbeToAssembly(ir: string): Promise<string> {
    const urls = await resolveQbeAssetUrls();
    const runtime = await loadQbeTool(urls.loaderUrl, urls.wasmUrl);
    const output = runTextTool(runtime, ir, "QBE did not emit assembly.");
    return new TextDecoder().decode(output);
  }
}

export function prepareCprocSource(sourceFiles: SourceFile[]): string {
  return adaptSourceForCproc(preprocessGeneratedC(flattenTccSourceFiles(sourceFiles)));
}

function preprocessGeneratedC(source: string): string {
  const macros = new Map<string, string>();
  const stack: Array<{ parentActive: boolean; active: boolean; matched: boolean }> = [];
  const output: string[] = [];

  for (const line of source.split(/\r?\n/)) {
    const directive = line.match(/^\s*#\s*(\w+)\b\s*(.*)$/);
    const active = stack.every((frame) => frame.active);

    if (!directive) {
      if (active) output.push(replaceObjectMacros(line, macros));
      continue;
    }

    const [, kind, rest = ""] = directive;
    if (kind === "define") {
      const match = rest.match(/^(\w+)\b\s*(.*)$/);
      if (active && match) macros.set(match[1], match[2].trim() || "1");
      continue;
    }
    if (kind === "include") continue;
    if (kind === "ifndef") {
      const include = active && !macros.has(rest.trim());
      stack.push({ parentActive: active, active: include, matched: include });
      continue;
    }
    if (kind === "if") {
      const include = active && evaluatePreprocessorCondition(rest, macros);
      stack.push({ parentActive: active, active: include, matched: include });
      continue;
    }
    if (kind === "else") {
      const current = stack.at(-1);
      if (current) {
        current.active = current.parentActive && !current.matched;
        current.matched = true;
      }
      continue;
    }
    if (kind === "endif") {
      stack.pop();
    }
  }

  return output.join("\n");
}

function adaptSourceForCproc(source: string): string {
  return source
    .replace(/static\s+r96_uintptr_t\s+r96_ecall7\s*\(/g, "r96_uintptr_t r96_ecall7(")
    .replace(
      /(r96_uintptr_t\s+r96_syscall2\([^{}]+\)\s*\{[^{}]+\}\s*)r96_uintptr_t\s+r96_ecall7\([^{}]+\)\s*\{[\s\S]*?__asm__\s+volatile\("ecall"\);\s*\}/,
      "$1",
    )
    .replace(/\bvolatile\s+/g, "");
}

function normalizeQbeIr(ir: string): string {
  return ir.replace(/\bextern \$/g, "$");
}

function normalizeQbeAssembly(assembly: string): string {
  const registers: Record<string, string> = {
    zero: "x0",
    ra: "x1",
    sp: "x2",
    gp: "x3",
    tp: "x4",
    t0: "x5",
    t1: "x6",
    t2: "x7",
    s0: "x8",
    fp: "x8",
    s1: "x9",
    a0: "x10",
    a1: "x11",
    a2: "x12",
    a3: "x13",
    a4: "x14",
    a5: "x15",
    a6: "x16",
    a7: "x17",
    s2: "x18",
    s3: "x19",
    s4: "x20",
    s5: "x21",
    s6: "x22",
    s7: "x23",
    s8: "x24",
    s9: "x25",
    s10: "x26",
    s11: "x27",
    t3: "x28",
    t4: "x29",
    t5: "x30",
    t6: "x31",
  };
  let normalized = localizeTextFunctionGlobals(moveDataBlocksAfterText(assembly));

  // TCC's `call` pseudo-instruction expands to auipc ra, hi; jalr zero, lo(ra)
  // which discards the return address (writes to zero instead of ra).
  // Fix: use jal ra, sym which correctly saves the return address.
  normalized = normalized.replace(/^(\s*)call\s+([A-Za-z_.$][A-Za-z0-9_.$]*)\s*$/gm, "$1jal ra, $2");

  // The risc96 runtime only supports 3 LOAD segments. Strip .note.GNU-stack and
  // .eh_frame references to reduce segment count.
  normalized = normalized.replace(/^\.section\s+\.note\.GNU-stack.*$/gm, "");
  normalized = normalized.replace(/^\s*\.section\s+\.eh_frame.*$/gm, "");

  for (const [alias, register] of Object.entries(registers)) {
    normalized = normalized.replace(new RegExp(`\\b${alias}\\b`, "g"), register);
  }

  return normalized
    .replace(/^(\s*)zext\.w\s+(x\d+),\s*(x\d+)$/gm, "$1slli $2, $3, 32\n$1srli $2, $2, 32")
    .replace(/^(\s*)sext\.w\s+(x\d+),\s*(x\d+)$/gm, "$1addiw $2, $3, 0")
    .replace(/^(\s*)add\s+(x\d+),\s*(x\d+),\s*(-?\d+)$/gm, "$1addi $2, $3, $4")
    .replace(/^(\s*)addw\s+(x\d+),\s*(x\d+),\s*(-?\d+)$/gm, "$1addiw $2, $3, $4")
    .replace(/^(\s*)xor\s+(x\d+),\s*(x\d+),\s*(-?\d+)$/gm, "$1xori $2, $3, $4")
    .replace(/^(\s*)or\s+(x\d+),\s*(x\d+),\s*(-?\d+)$/gm, "$1ori $2, $3, $4")
    .replace(/^(\s*)and\s+(x\d+),\s*(x\d+),\s*(-?\d+)$/gm, "$1andi $2, $3, $4")
    .replace(/^(\s*)sll\s+(x\d+),\s*(x\d+),\s*(\d+)$/gm, "$1slli $2, $3, $4")
    .replace(/^(\s*)srl\s+(x\d+),\s*(x\d+),\s*(\d+)$/gm, "$1srli $2, $3, $4")
    .replace(/^(\s*)sra\s+(x\d+),\s*(x\d+),\s*(\d+)$/gm, "$1srai $2, $3, $4")
    .replace(/^(\s*)slt\s+(x\d+),\s*(x\d+),\s*(-?\d+)$/gm, "$1slti $2, $3, $4")
    .replace(/^(\s*)sltu\s+(x\d+),\s*(x\d+),\s*(-?\d+)$/gm, "$1sltiu $2, $3, $4")
    .replace(
      /^(\s*)(l(?:b|bu|h|hu|w|wu|d))\s+(x\d+),\s*([A-Za-z_.$][A-Za-z0-9_.$]*(?:[+-]\d+)?)$/gm,
      "$1lla $3, $4\n$1$2 $3, 0($3)",
    )
    .replace(
      /^(\s*)(s(?:b|h|w|d))\s+(x\d+),\s*([A-Za-z_.$][A-Za-z0-9_.$]*(?:[+-]\d+)?),\s*(x\d+)$/gm,
      "$1lla $5, $4\n$1$2 $3, 0($5)",
    );
}

function moveDataBlocksAfterText(assembly: string): string {
  const lines = assembly.split("\n");
  const code: string[] = [];
  const dataBlocks: string[] = [];
  const dataLabels: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim() !== ".data") {
      code.push(lines[index]);
      continue;
    }

    const block: string[] = [];
    while (index < lines.length) {
      block.push(lines[index]);
      const label = lines[index].match(/^([A-Za-z_.$][A-Za-z0-9_.$]*):$/);
      if (label) dataLabels.push(label[1]);
      if (lines[index].includes("/* end data */")) break;
      index++;
    }
    dataBlocks.push(block.join("\n"));
  }

  return `${dataLabels.map((label) => `.globl ${label}`).join("\n")}\n${code.join("\n")}\n${dataBlocks.join("\n")}`;
}

function localizeTextFunctionGlobals(assembly: string): string {
  const lines = assembly.split("\n");
  const output: string[] = [];
  let inText = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === ".text") inText = true;
    if (trimmed === ".data") inText = false;

    const global = line.match(/^\s*\.globl\s+([A-Za-z_.$][A-Za-z0-9_.$]*)\s*$/);
    if (inText && global) {
      const label = global[1];
      if (label !== "_start" && lines[index + 1]?.trim() === `${label}:`) continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function replaceObjectMacros(line: string, macros: Map<string, string>): string {
  let replaced = line;
  const names = [...macros.keys()].sort((left, right) => right.length - left.length);

  for (const name of names) {
    replaced = replaced.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), macros.get(name) ?? "");
  }

  return replaced;
}

function evaluatePreprocessorCondition(expression: string, macros: Map<string, string>): boolean {
  const replaced = expression
    .replace(/\b[A-Z][A-Z0-9_]*\b/g, (name) => macros.get(name) ?? "0")
    .replace(/([0-9])u\b/gi, "$1")
    .trim();
  const number = parseIntegerLiteral(replaced);
  if (number !== undefined) return number !== 0;

  const comparison = replaced.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!comparison) return false;

  const left = parseIntegerLiteral(comparison[1].trim());
  const right = parseIntegerLiteral(comparison[3].trim());
  if (left === undefined || right === undefined) return false;

  switch (comparison[2]) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case "<":
      return left < right;
    default:
      return false;
  }
}

function parseIntegerLiteral(value: string): number | undefined {
  if (/^0x[0-9a-f]+$/i.test(value)) return Number.parseInt(value, 16);
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  return undefined;
}

async function resolveCprocAssetUrls(): Promise<ToolAssetUrls> {
  if (import.meta.env.MODE === "test") {
    return {
      loaderUrl: resolveBrowserUrl(defaultCprocLoaderUrl),
      wasmUrl: resolveBrowserUrl(defaultCprocWasmUrl),
    };
  }

  try {
    const assets = await getVersionedWasmAssets();
    return { loaderUrl: assets.cprocQbeLoaderUrl, wasmUrl: assets.cprocQbeWasmUrl };
  } catch {
    return {
      loaderUrl: resolveBrowserUrl(defaultCprocLoaderUrl),
      wasmUrl: resolveBrowserUrl(defaultCprocWasmUrl),
    };
  }
}

async function resolveQbeAssetUrls(): Promise<ToolAssetUrls> {
  if (import.meta.env.MODE === "test") {
    return {
      loaderUrl: resolveBrowserUrl(defaultQbeLoaderUrl),
      wasmUrl: resolveBrowserUrl(defaultQbeWasmUrl),
    };
  }

  try {
    const assets = await getVersionedWasmAssets();
    return { loaderUrl: assets.qbeLoaderUrl, wasmUrl: assets.qbeWasmUrl };
  } catch {
    return {
      loaderUrl: resolveBrowserUrl(defaultQbeLoaderUrl),
      wasmUrl: resolveBrowserUrl(defaultQbeWasmUrl),
    };
  }
}

async function loadCprocTool(loaderUrl: string, wasmUrl: string): Promise<ToolRuntime> {
  const module = await loadEmscriptenTool<CprocToolModule>(loaderUrl, wasmUrl);
  return {
    heap: () => module.HEAPU8,
    allocUint8: (length) => module._allocUint8(length),
    run: (inputPtr) => module._compile_c_to_qbe(inputPtr),
    lastError: () => module._last_error(),
  };
}

async function loadQbeTool(loaderUrl: string, wasmUrl: string): Promise<ToolRuntime> {
  const module = await loadEmscriptenTool<QbeToolModule>(loaderUrl, wasmUrl);
  return {
    heap: () => module.HEAPU8,
    allocUint8: (length) => module._allocUint8(length),
    run: (inputPtr) => module._compile_qbe_to_assembly(inputPtr),
    lastError: () => module._last_error(),
  };
}

async function loadEmscriptenTool<T>(loaderUrl: string, wasmUrl: string): Promise<T> {
  const response = await fetchVersionedAsset(loaderUrl);
  if (!response.ok) throw new Error(`Failed to load cproc tool loader from ${loaderUrl}: ${response.status}`);

  const source = await response.text();
  const moduleUrl = `data:text/javascript;base64,${base64Encode(new TextEncoder().encode(source))}`;
  const imported = (await import(/* @vite-ignore */ moduleUrl)) as { default: EmscriptenToolFactory<T> };
  return imported.default({
    locateFile: () => wasmUrl,
    instantiateWasm(imports, receiveInstance) {
      imports.wasi_snapshot_preview1 ??= { proc_exit() {} };
      void fetchVersionedAssetBytes(wasmUrl)
        .then((bytes) => WebAssembly.instantiate(bytes, imports))
        .then((result) => receiveInstance(result.instance, result.module));
      return {};
    },
  });
}

function runTextTool(runtime: ToolRuntime, input: string, fallback: string): Uint8Array {
  const inputPtr = allocateString(runtime, input);
  const outputPtr = runtime.run(inputPtr);
  const output = readLengthPrefixedBytes(runtime, outputPtr);

  if (output.length === 0) {
    throw new Error(readToolFailure(runtime, fallback));
  }

  return output;
}

function allocateString(runtime: ToolRuntime, value: string): number {
  const encoded = new TextEncoder().encode(value);
  const pointer = runtime.allocUint8(encoded.length + 1);
  const target = runtime.heap().subarray(pointer, pointer + encoded.length + 1);
  target.set(encoded);
  target[encoded.length] = 0;
  return pointer;
}

function readLengthPrefixedBytes(runtime: ToolRuntime, pointer: number): Uint8Array {
  const heap = runtime.heap();
  const view = new DataView(heap.buffer, pointer, 4);
  const length = view.getUint32(0, true);
  return new Uint8Array(heap.buffer.slice(pointer + 4, pointer + 4 + length));
}

function readToolFailure(runtime: ToolRuntime, fallback: string): string {
  const lastError = readCString(runtime, runtime.lastError()).trim();
  return lastError.length > 0 ? lastError : fallback;
}

function readCString(runtime: ToolRuntime, pointer: number): string {
  if (pointer === 0) return "";

  const heap = runtime.heap();
  let end = pointer;
  while (end < heap.length && heap[end] !== 0) end++;
  return new TextDecoder().decode(heap.subarray(pointer, end));
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveBrowserUrl(url: string): string {
  return new URL(url, globalThis.location?.href ?? "http://localhost/").toString();
}
