import { describe, expect, it } from "vite-plus/test";

import { BrowserRisc96PreviewRuntime, flattenTccSourceFiles } from "./browserAdapters.ts";

describe("flattenTccSourceFiles", () => {
  it("places headers before C sources and strips local includes", () => {
    const source = flattenTccSourceFiles([
      {
        path: "main.c",
        contents: '#include "runtime.h"\nint main(void) { return RUNTIME_VALUE; }',
      },
      { path: "runtime.h", contents: "#define RUNTIME_VALUE 96" },
    ]);

    expect(source).toContain("#define RUNTIME_VALUE 96");
    expect(source).toContain("int main(void) { return RUNTIME_VALUE; }");
    expect(source).not.toContain('#include "runtime.h"');
  });

  it("decodes binary source contents", () => {
    const source = flattenTccSourceFiles([
      { path: "main.c", contents: new TextEncoder().encode("int answer = 96;") },
    ]);

    expect(source).toBe("int answer = 96;");
  });
});

describe("BrowserRisc96PreviewRuntime", () => {
  it("loads cartridges through the embedded runtime element", async () => {
    const host = document.createElement("div");
    const calls: string[] = [];
    const globals = globalThis as typeof globalThis & {
      __scratch96Risc96Controller?: {
        loadCartridge(bytes: Uint8Array): void;
        runFrame(): number;
        reset(): boolean;
        unload(): void;
        setControllerButton(port: number, button: string, level: number): void;
        clearController(port: number): void;
      };
    };

    globals.__scratch96Risc96Controller = {
      loadCartridge(bytes) {
        calls.push(`load:${bytes.join(",")}`);
      },
      runFrame() {
        calls.push("frame");
        return 1;
      },
      reset() {
        calls.push("reset");
        return true;
      },
      unload() {},
      setControllerButton(port, button, level) {
        calls.push(`${port}:${button}:${level}`);
      },
      clearController() {},
    };

    const moduleUrl = `data:text/javascript,${encodeURIComponent(`
      if (!globalThis.customElements.get("risc96-runtime")) {
        globalThis.customElements.define("risc96-runtime", class extends globalThis.HTMLElement {
          async ready() { return globalThis.__scratch96Risc96Controller; }
        });
      }
    `)}`;
    const runtime = new BrowserRisc96PreviewRuntime(host, moduleUrl);

    await runtime.load({ bytes: new Uint8Array([1, 2, 3]) });
    runtime.setControllerState(0, {
      up: true,
      down: false,
      left: false,
      right: false,
      a: true,
      b: false,
      x: false,
      y: false,
      l: false,
      r: false,
      select: false,
      start: true,
    });

    expect(host.querySelector("risc96-runtime")).not.toBeNull();
    expect(calls).toContain("load:1,2,3");
    expect(calls).toContain("frame");
    expect(calls).toContain("0:up:3");
    expect(calls).toContain("0:a:3");
    expect(calls).toContain("0:start:3");

    delete globals.__scratch96Risc96Controller;
  });
});
