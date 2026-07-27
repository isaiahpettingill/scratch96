/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vite-plus/test";

import { BrowserTccWasmCompiler } from "./browserAdapters.ts";

describe("WASM artifacts", () => {
  it("ships a loadable TCC WASM module with the browser compiler export", async () => {
    const wasm = await readFile(join(process.cwd(), "public/wasm/tcc-wasm.wasm"));
    const module = await WebAssembly.compile(wasm);
    const exports = WebAssembly.Module.exports(module).map((entry) => entry.name);

    expect(exports).toContain("compile_program");
  });

  it("compiles a tiny C source with the TCC WASM artifact", async () => {
    const [loader, wasm] = await Promise.all([
      readFile(join(process.cwd(), "public/wasm/tcc-wasm.js")),
      readFile(join(process.cwd(), "public/wasm/tcc-wasm.wasm")),
    ]);
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes("tcc-wasm.js")) return Promise.resolve(new Response(loader, { headers: { "Content-Type": "text/javascript" } }));
      if (url.includes("tcc-wasm.wasm")) return Promise.resolve(new Response(wasm, { headers: { "Content-Type": "application/wasm" } }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const result = await new BrowserTccWasmCompiler().compile([
      { path: "main.c", contents: "void _start(void) {}" },
    ]);

    expect(result.bytes.length).toBeGreaterThan(0);
    fetch.mockRestore();
  });
});

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}
