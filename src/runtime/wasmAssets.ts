export type VersionedWasmAssets = {
  tccWasmUrl: string;
  tccLoaderUrl?: string;
  cprocQbeWasmUrl: string;
  cprocQbeLoaderUrl: string;
  qbeWasmUrl: string;
  qbeLoaderUrl: string;
  risc96ComponentUrl: string;
  risc96EmbedJsUrl: string;
  risc96EmbedWasmUrl: string;
};

type TccManifest = {
  artifact: string;
  loader?: string;
  sha256: string;
  loaderSha256?: string;
};

type CompilerToolManifest = {
  artifact: string;
  loader: string;
  sha256: string;
  loaderSha256: string;
};

type Risc96Manifest = {
  sourceCommit: string;
  files: { path: string; sha256?: string }[];
};

const wasmRoot = "/wasm/";
const tccManifestUrl = `${wasmRoot}tcc-wasm.manifest.json`;
const cprocManifestUrl = `${wasmRoot}cproc-qbe.manifest.json`;
const qbeManifestUrl = `${wasmRoot}qbe.manifest.json`;
const risc96ManifestUrl = `${wasmRoot}risc96-embed.manifest.json`;
const cacheName = "scratch96-wasm-v1";

let assetsPromise: Promise<VersionedWasmAssets> | undefined;
let preloadPromise: Promise<void> | undefined;

export function getVersionedWasmAssets(): Promise<VersionedWasmAssets> {
  assetsPromise ??= loadVersionedWasmAssets();
  return assetsPromise;
}

export function preloadWasmAssets(documentRef: Document = document): Promise<void> {
  preloadPromise ??= getVersionedWasmAssets().then(async (assets) => {
    addPreloadLink(documentRef, "preload", assets.tccWasmUrl, "fetch", "application/wasm");
    if (assets.tccLoaderUrl) addPreloadLink(documentRef, "modulepreload", assets.tccLoaderUrl, "script");
    addPreloadLink(documentRef, "modulepreload", assets.risc96ComponentUrl, "script");
    addPreloadLink(documentRef, "modulepreload", assets.risc96EmbedJsUrl, "script");
    addPreloadLink(documentRef, "preload", assets.risc96EmbedWasmUrl, "fetch", "application/wasm");
    await cacheAssets([assets.tccWasmUrl, ...(assets.tccLoaderUrl ? [assets.tccLoaderUrl] : []), assets.risc96ComponentUrl, assets.risc96EmbedJsUrl, assets.risc96EmbedWasmUrl]);
  });

  return preloadPromise;
}

export async function fetchVersionedAsset(url: string): Promise<Response> {
  const cache = await openWasmCache();
  const cached = await cache?.match(url);

  if (cached) {
    return cached.clone();
  }

  const response = await fetch(url, { cache: "force-cache" });

  if (response.ok) {
    await cache?.put(url, response.clone());
  }

  return response;
}

export async function fetchVersionedAssetBytes(url: string): Promise<ArrayBuffer> {
  const cache = await openWasmCache();
  const cached = await cache?.match(url);

  if (cached) {
    return cached.arrayBuffer();
  }

  const response = await fetch(url, { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  await cache?.put(url, response.clone());
  return response.arrayBuffer();
}

export async function importVersionedRisc96Component(assets: VersionedWasmAssets): Promise<void> {
  const response = await fetchVersionedAsset(assets.risc96ComponentUrl);

  if (!response.ok) {
    throw new Error(`Failed to load Risc96 component from ${assets.risc96ComponentUrl}: ${response.status}`);
  }

  const source = (await response.text()).replace(
    /from\s+["']\.\/risc96_embed\.js["']/,
    `from "${assets.risc96EmbedJsUrl}"`,
  );
  const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));

  try {
    await import(/* @vite-ignore */ blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function loadVersionedWasmAssets(): Promise<VersionedWasmAssets> {
  const [tcc, cproc, qbe, risc96] = await Promise.all([
    fetchJson<TccManifest>(tccManifestUrl),
    fetchJson<CompilerToolManifest>(cprocManifestUrl),
    fetchJson<CompilerToolManifest>(qbeManifestUrl),
    fetchJson<Risc96Manifest>(risc96ManifestUrl),
  ]);
  const risc96Wasm = risc96.files.find((file) => file.path.endsWith(".wasm"));
  const engineVersion = (risc96Wasm?.sha256 ?? risc96.sourceCommit).slice(0, 16);

  return {
    tccWasmUrl: versionedUrl(`${wasmRoot}${tcc.artifact}`, tcc.sha256),
    tccLoaderUrl: tcc.loader ? versionedUrl(`${wasmRoot}${tcc.loader}`, tcc.loaderSha256 ?? tcc.sha256) : undefined,
    cprocQbeWasmUrl: versionedUrl(`${wasmRoot}${cproc.artifact}`, cproc.sha256),
    cprocQbeLoaderUrl: versionedUrl(`${wasmRoot}${cproc.loader}`, cproc.loaderSha256),
    qbeWasmUrl: versionedUrl(`${wasmRoot}${qbe.artifact}`, qbe.sha256),
    qbeLoaderUrl: versionedUrl(`${wasmRoot}${qbe.loader}`, qbe.loaderSha256),
    risc96ComponentUrl: versionedUrl(`${wasmRoot}risc96-web-component.js`, risc96.sourceCommit),
    risc96EmbedJsUrl: versionedUrl(`${wasmRoot}risc96_embed.js`, risc96.sourceCommit),
    risc96EmbedWasmUrl: versionedUrl(`${wasmRoot}${risc96Wasm?.path ?? "risc96_embed.wasm"}`, engineVersion),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(resolveBrowserUrl(url), { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Failed to load WASM manifest ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function addPreloadLink(
  documentRef: Document,
  rel: "preload" | "modulepreload",
  href: string,
  as: "fetch" | "script",
  type?: string,
): void {
  if (documentRef.querySelector(`link[href="${href}"]`)) {
    return;
  }

  const link = documentRef.createElement("link");
  link.rel = rel;
  link.href = href;
  link.as = as;

  if (as === "fetch") {
    link.crossOrigin = "anonymous";
  }

  if (type) {
    link.type = type;
  }

  documentRef.head.append(link);
}

async function cacheAssets(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await fetchVersionedAsset(url);
      } catch {
        // Preload is opportunistic; normal runtime loading will surface real failures.
      }
    }),
  );
}

async function openWasmCache(): Promise<Cache | undefined> {
  if (import.meta.env.MODE === "test" || !("caches" in globalThis) || !globalThis.isSecureContext) {
    return undefined;
  }

  return caches.open(cacheName);
}

function versionedUrl(path: string, version: string): string {
  const suffix = version.slice(0, 16);
  const url = new URL(path, globalThis.location?.href ?? "http://localhost/");
  url.searchParams.set("v", suffix);
  return url.toString();
}

function resolveBrowserUrl(url: string): string {
  return new URL(url, globalThis.location?.href ?? "http://localhost/").toString();
}
