import type {
  CartridgeElf,
  ControllerState,
  Risc96PreviewRuntime,
  SourceFile,
  TccCompiler,
} from "./adapters.ts";
import { fetchVersionedAsset, fetchVersionedAssetBytes, getVersionedWasmAssets, importVersionedRisc96Component } from "./wasmAssets.ts";

type TccWasmExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  allocUint8(length: number): number;
  compile_program(optionsPtr: number, codePtr: number): number;
  link_assembly(optionsPtr: number, assemblyPtr: number): number;
  last_error(): number;
};

type EmscriptenTccModule = {
  HEAPU8: Uint8Array;
  _allocUint8(length: number): number;
  _compile_program(optionsPtr: number, codePtr: number): number;
  _link_assembly(optionsPtr: number, assemblyPtr: number): number;
  _last_error(): number;
};

type EmscriptenTccFactory = (options: {
  locateFile(path: string): string;
  instantiateWasm(
    imports: WebAssembly.Imports,
    receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ): Record<string, never>;
}) => Promise<EmscriptenTccModule>;

type TccRuntime = {
  heap(): Uint8Array;
  allocUint8(length: number): number;
  compileProgram(optionsPtr: number, codePtr: number): number;
  linkAssembly(optionsPtr: number, assemblyPtr: number): number;
  lastError(): number;
};

type TccAssetUrls = {
  wasmUrl: string;
  loaderUrl?: string;
};

const defaultTccWasmUrl = "/wasm/tcc-wasm.wasm";
const defaultTccLoaderUrl = "/wasm/tcc-wasm.js";
const defaultRisc96ComponentUrl = "/wasm/risc96-web-component.js";
const defaultRisc96WasmBaseUrl = "/wasm/";

type Risc96RuntimeController = {
  loadCartridge(bytes: Uint8Array): void;
  runFrame(options?: { maxSlices?: number; maxInstructionsPerSlice?: number }): number;
  reset(): boolean;
  unload(): void;
  setControllerButton(port: number, button: string, level: number): void;
  clearController(port: number): void;
};

type Risc96RuntimeElement = HTMLElement & {
  ready(options?: {
    module?: { locateFile?(path: string): string };
  }): Promise<Risc96RuntimeController>;
};

export class BrowserTccWasmCompiler implements TccCompiler {
  private readonly wasmUrl: string;
  private readonly loaderUrl?: string;
  private wasmBytes?: ArrayBuffer;

  constructor(wasmUrl = defaultTccWasmUrl, loaderUrl?: string) {
    this.wasmUrl = wasmUrl;
    this.loaderUrl = loaderUrl;
  }

  async compile(sourceFiles: SourceFile[]): Promise<CartridgeElf> {
    const runtime = await this.instantiate();
    const optionsPtr = allocateString(runtime, JSON.stringify(["-nostdlib", "-static"]));
    const codePtr = allocateString(runtime, flattenTccSourceFiles(sourceFiles));
    const outputPtr = runtime.compileProgram(optionsPtr, codePtr);
    const bytes = readLengthPrefixedBytes(runtime, outputPtr);

    if (bytes.length === 0) {
      throw new Error(readTccFailure(runtime, "TCC WASM did not emit a cartridge object."));
    }

    return { bytes };
  }

  async linkAssembly(assembly: string): Promise<CartridgeElf> {
    const runtime = await this.instantiate();
    const optionsPtr = allocateString(runtime, JSON.stringify(["-nostdlib", "-static", "-fno-asynchronous-unwind-tables"]));
    const assemblyPtr = allocateString(runtime, assembly);
    const outputPtr = runtime.linkAssembly(optionsPtr, assemblyPtr);
    const bytes = readLengthPrefixedBytes(runtime, outputPtr);

    if (bytes.length === 0) {
      throw new Error(readTccFailure(runtime, "TCC WASM did not link a cartridge object."));
    }

    return { bytes };
  }

  private async instantiate(): Promise<TccRuntime> {
    const urls = await this.resolveTccAssetUrls();
    if (urls.loaderUrl) return loadEmscriptenTcc(urls.loaderUrl, urls.wasmUrl);

    const bytes = await this.loadWasmBytes(urls.wasmUrl);
    const decoder = new TextDecoder();
    let instance: WebAssembly.Instance | undefined;
    let logBuffer = "";
    const imports = {
      env: {
        jsConsoleLogWrite(ptr: number, len: number): void {
          if (!instance) return;
          const memory = (instance.exports as TccWasmExports).memory;
          logBuffer += decoder.decode(new Uint8Array(memory.buffer, ptr, len));
        },
        jsConsoleLogFlush(): void {
          if (logBuffer.length > 0) {
            console.debug(logBuffer);
            logBuffer = "";
          }
        },
      },
    };
    const result = await WebAssembly.instantiate(bytes, imports);
    instance = result.instance;
    const exports = instance.exports as TccWasmExports;
    return {
      heap: () => new Uint8Array(exports.memory.buffer),
      allocUint8: (length) => exports.allocUint8(length),
      compileProgram: (optionsPtr, codePtr) => exports.compile_program(optionsPtr, codePtr),
      linkAssembly: (optionsPtr, assemblyPtr) => exports.link_assembly(optionsPtr, assemblyPtr),
      lastError: () => exports.last_error(),
    };
  }

  private async loadWasmBytes(wasmUrl: string): Promise<ArrayBuffer> {
    if (this.wasmBytes) {
      return this.wasmBytes.slice(0);
    }

    try {
      this.wasmBytes = await fetchVersionedAssetBytes(wasmUrl);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message.replace(/^Failed to load .*: /, `Failed to load TCC WASM from ${this.wasmUrl}: `) : `Failed to load TCC WASM from ${this.wasmUrl}`);
    }
    return this.wasmBytes.slice(0);
  }

  private async resolveTccAssetUrls(): Promise<TccAssetUrls> {
    if (this.loaderUrl) {
      return { wasmUrl: resolveBrowserUrl(this.wasmUrl), loaderUrl: resolveBrowserUrl(this.loaderUrl) };
    }

    if (this.wasmUrl !== defaultTccWasmUrl) {
      return { wasmUrl: resolveBrowserUrl(this.wasmUrl) };
    }

    if (import.meta.env.MODE === "test") {
      return { wasmUrl: resolveBrowserUrl(defaultTccWasmUrl), loaderUrl: resolveBrowserUrl(defaultTccLoaderUrl) };
    }

    try {
      const assets = await getVersionedWasmAssets();
      return { wasmUrl: assets.tccWasmUrl, loaderUrl: assets.tccLoaderUrl };
    } catch {
      return { wasmUrl: resolveBrowserUrl(defaultTccWasmUrl), loaderUrl: resolveBrowserUrl(defaultTccLoaderUrl) };
    }
  }
}

export class BrowserRisc96PreviewRuntime implements Risc96PreviewRuntime {
  private element?: Risc96RuntimeElement;
  private runtime?: Risc96RuntimeController;
  private frameHandle?: number;

  constructor(
    private readonly host: HTMLElement,
    private readonly componentUrl = defaultRisc96ComponentUrl,
    private readonly wasmBaseUrl = defaultRisc96WasmBaseUrl,
  ) {}

  async load(elf: CartridgeElf): Promise<void> {
    const runtime = await this.ready();
    this.stop();
    runtime.loadCartridge(elf.bytes);
    runtime.runFrame();
  }

  run(): void {
    if (this.frameHandle !== undefined) {
      return;
    }

    const tick = (): void => {
      this.runtime?.runFrame();
      this.frameHandle = requestAnimationFrame(tick);
    };

    this.frameHandle = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.frameHandle === undefined) {
      return;
    }

    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = undefined;
  }

  async reset(): Promise<void> {
    const runtime = await this.ready();
    runtime.reset();
    runtime.runFrame();
  }

  setControllerState(port: number, state: ControllerState): void {
    if (!this.runtime) {
      return;
    }

    const buttons = {
      up: state.up,
      down: state.down,
      left: state.left,
      right: state.right,
      a: state.a,
      b: state.b,
      x: state.x,
      y: state.y,
      l1: state.l,
      r1: state.r,
      select: state.select,
      start: state.start,
    };

    for (const [button, pressed] of Object.entries(buttons)) {
      this.runtime.setControllerButton(port, button, pressed ? 3 : 0);
    }
  }

  private async ready(): Promise<Risc96RuntimeController> {
    if (this.runtime) {
      return this.runtime;
    }

    const assets = this.componentUrl === defaultRisc96ComponentUrl ? await getVersionedWasmAssets() : undefined;

    if (assets) {
      await importVersionedRisc96Component(assets);
    } else {
      await import(/* @vite-ignore */ resolveBrowserUrl(this.componentUrl));
    }

    this.element = document.createElement("risc96-runtime") as Risc96RuntimeElement;
    this.host.replaceChildren(this.element);
    this.runtime = await this.element.ready({
      module: {
        locateFile: (path) =>
          assets && path.endsWith(".wasm")
            ? assets.risc96EmbedWasmUrl
            : new URL(path, resolveBrowserUrl(this.wasmBaseUrl)).toString(),
      },
    });
    return this.runtime;
  }
}

function resolveBrowserUrl(url: string): string {
  return new URL(url, globalThis.location?.href ?? "http://localhost/").toString();
}

async function loadEmscriptenTcc(loaderUrl: string, wasmUrl: string): Promise<TccRuntime> {
  const response = await fetchVersionedAsset(loaderUrl);
  if (!response.ok) throw new Error(`Failed to load TCC WASM loader from ${loaderUrl}: ${response.status}`);

  const source = await response.text();
  const moduleUrl = `data:text/javascript;base64,${base64Encode(new TextEncoder().encode(source))}`;
  const imported = (await import(/* @vite-ignore */ moduleUrl)) as { default: EmscriptenTccFactory };
  const module = await imported.default({
    locateFile: () => wasmUrl,
    instantiateWasm(imports, receiveInstance) {
      imports.wasi_snapshot_preview1 ??= { proc_exit() {} };
      void fetchVersionedAssetBytes(wasmUrl)
        .then((bytes) => WebAssembly.instantiate(bytes, imports))
        .then((result) => receiveInstance(result.instance, result.module));
      return {};
    },
  });

  return {
    heap: () => module.HEAPU8,
    allocUint8: (length) => module._allocUint8(length),
    compileProgram: (optionsPtr, codePtr) => module._compile_program(optionsPtr, codePtr),
    linkAssembly: (optionsPtr, assemblyPtr) => module._link_assembly(optionsPtr, assemblyPtr),
    lastError: () => module._last_error(),
  };
}

export function flattenTccSourceFiles(sourceFiles: SourceFile[]): string {
  return sourceFiles
    .map((file) => decodeSourceFile(file))
    .map((file) => stripLocalIncludes(file.contents))
    .join("\n\n");
}

function decodeSourceFile(file: SourceFile): SourceFile & { contents: string } {
  if (typeof file.contents === "string") {
    return { ...file, contents: file.contents };
  }

  return { ...file, contents: new TextDecoder().decode(file.contents) };
}

function stripLocalIncludes(source: string): string {
  return source.replace(/^\s*#include\s+"[^"]+"\s*$/gm, "");
}

function allocateString(runtime: TccRuntime, value: string): number {
  const encoded = new TextEncoder().encode(value);
  const pointer = runtime.allocUint8(encoded.length + 1);
  const target = runtime.heap().subarray(pointer, pointer + encoded.length + 1);
  target.set(encoded);
  target[encoded.length] = 0;
  return pointer;
}

function readLengthPrefixedBytes(runtime: TccRuntime, pointer: number): Uint8Array {
  const heap = runtime.heap();
  const view = new DataView(heap.buffer, pointer, 4);
  const length = view.getUint32(0, true);
  return new Uint8Array(heap.buffer.slice(pointer + 4, pointer + 4 + length));
}

function readTccFailure(runtime: TccRuntime, fallback: string): string {
  const lastError = readCString(runtime, runtime.lastError()).trim();
  return lastError.length > 0 ? lastError : fallback;
}

function readCString(runtime: TccRuntime, pointer: number): string {
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

export class MissingTccWasmCompiler implements TccCompiler {
  async compile(_sourceFiles: SourceFile[]): Promise<CartridgeElf> {
    throw new Error(
      "TCC WASM is not wired yet. Vendor tcc-riscv32-wasm and its backend, then provide a real TccCompiler adapter.",
    );
  }
}

export class MissingRisc96PreviewRuntime implements Risc96PreviewRuntime {
  async load(_elf: CartridgeElf): Promise<void> {
    throw new Error(
      "Risc96 WASM runtime is not wired yet. Vendor Risc96 and build the scratch96 preview shell.",
    );
  }

  run(): void {}

  stop(): void {}

  async reset(): Promise<void> {}

  setControllerState(): void {}
}
