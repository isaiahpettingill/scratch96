import { describe, expect, it, vi } from "vite-plus/test";

import { getVersionedWasmAssets, preloadWasmAssets } from "./wasmAssets.ts";

describe("versioned WASM assets", () => {
  it("derives cache-busting suffixes from artifact manifests", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(mockManifestFetch);

    const assets = await getVersionedWasmAssets();

    expect(assets.tccWasmUrl).toContain("/wasm/tcc-wasm.wasm?v=667ceded4a293487");
    expect(assets.tccLoaderUrl).toContain("/wasm/tcc-wasm.js?v=abc123loaderhash");
    expect(assets.cprocQbeWasmUrl).toContain("/wasm/cproc-qbe.wasm?v=cprocwasmhash123");
    expect(assets.qbeWasmUrl).toContain("/wasm/qbe.wasm?v=qbewasmhash1234");
    expect(assets.risc96ComponentUrl).toContain("/wasm/risc96-web-component.js?v=66b384b9ed186");
    expect(assets.risc96EmbedWasmUrl).toContain("/wasm/risc96_embed.wasm?v=a189b1e4d86c7dd6");

    fetch.mockRestore();
  });

  it("adds preload hints for versioned runtime artifacts", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(mockManifestAndAssetFetch);
    const documentRef = document.implementation.createHTMLDocument("scratch96");

    await preloadWasmAssets(documentRef);

    expect([...documentRef.querySelectorAll("link")].map((link) => link.href)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/wasm/tcc-wasm.wasm?v=667ceded4a293487"),
        expect.stringContaining("/wasm/tcc-wasm.js?v=abc123loaderhash"),
        expect.stringContaining("/wasm/risc96_embed.wasm?v=a189b1e4d86c7dd6"),
      ]),
    );

    fetch.mockRestore();
  });
});

function mockManifestFetch(input: string | URL | Request): Promise<Response> {
  const url = requestUrl(input);

  if (url.includes("tcc-wasm.manifest.json")) {
    return Promise.resolve(
      Response.json({
        artifact: "tcc-wasm.wasm",
        loader: "tcc-wasm.js",
        sha256: "667ceded4a29348730a",
        loaderSha256: "abc123loaderhash456",
      }),
    );
  }

  if (url.includes("risc96-embed.manifest.json")) {
    return Promise.resolve(
      Response.json({
        sourceCommit: "66b384b9ed186f52913515aa73650eadb1cca9d6",
        files: [{ path: "risc96_embed.wasm", sha256: "a189b1e4d86c7dd6044c" }],
      }),
    );
  }

  if (url.includes("cproc-qbe.manifest.json")) {
    return Promise.resolve(
      Response.json({
        artifact: "cproc-qbe.wasm",
        loader: "cproc-qbe.js",
        sha256: "cprocwasmhash123456",
        loaderSha256: "cprocloaderhash12",
      }),
    );
  }

  if (url.includes("qbe.manifest.json")) {
    return Promise.resolve(
      Response.json({
        artifact: "qbe.wasm",
        loader: "qbe.js",
        sha256: "qbewasmhash123456",
        loaderSha256: "qbeloaderhash1234",
      }),
    );
  }

  return Promise.resolve(new Response(null, { status: 404 }));
}

function mockManifestAndAssetFetch(input: string | URL | Request): Promise<Response> {
  const manifest = mockManifestFetch(input);
  const url = requestUrl(input);

  if (!url.includes("manifest.json")) {
    return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
  }

  return manifest;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
