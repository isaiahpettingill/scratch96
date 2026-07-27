import type { DecodedSpritesheetImage } from "./spritesheetImport.ts";

type FfmpegCoreManifest = { core: string; chunks: string[]; bytes: number };

let ffmpegInstance: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | undefined;
let ffmpegCoreURLs: Promise<{ coreURL: string; wasmURL: string }> | undefined;
let decodeIndex = 0;

export async function decodeImageWithFfmpeg(file: File): Promise<DecodedSpritesheetImage> {
  const ffmpeg = await loadFfmpeg();
  const inputPath = `input-${decodeIndex}${fileExtension(file.name)}`;
  const outputPath = `output-${decodeIndex}.png`;
  decodeIndex += 1;

  try {
    const { fetchFile } = await import("@ffmpeg/util");
    await ffmpeg.writeFile(inputPath, await fetchFile(file));
    const exitCode = await ffmpeg.exec(["-i", inputPath, "-frames:v", "1", outputPath]);
    if (exitCode !== 0) throw new Error(`FFmpeg image decode failed with exit code ${exitCode}.`);

    const data = await ffmpeg.readFile(outputPath);
    return decodePngBytes(data instanceof Uint8Array ? data : new TextEncoder().encode(data));
  } finally {
    await deleteIfExists(ffmpeg, inputPath);
    await deleteIfExists(ffmpeg, outputPath);
  }
}

async function loadFfmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  ffmpegInstance ??= import("@ffmpeg/ffmpeg").then(async ({ FFmpeg }) => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load(await loadFfmpegCoreURLs());
    return ffmpeg;
  });
  return ffmpegInstance;
}

async function loadFfmpegCoreURLs(): Promise<{ coreURL: string; wasmURL: string }> {
  ffmpegCoreURLs ??= loadChunkedFfmpegCore();
  return ffmpegCoreURLs;
}

async function loadChunkedFfmpegCore(): Promise<{ coreURL: string; wasmURL: string }> {
  const baseURL = new URL(`${import.meta.env.BASE_URL}ffmpeg-core/`, window.location.href);
  const manifest = await fetchJson<FfmpegCoreManifest>(new URL("manifest.json", baseURL));
  const chunks = await Promise.all(
    manifest.chunks.map(async (chunk) => new Uint8Array(await fetchBytes(new URL(chunk, baseURL)))),
  );
  const wasmBytes = concatenateChunks(chunks, manifest.bytes);
  const wasmURL = URL.createObjectURL(new Blob([wasmBytes], { type: "application/wasm" }));
  return { coreURL: new URL(manifest.core, baseURL).toString(), wasmURL };
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url.pathname}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchBytes(url: URL): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url.pathname}: ${response.status}`);
  return response.arrayBuffer();
}

function concatenateChunks(chunks: Uint8Array[], expectedBytes: number): ArrayBuffer {
  const bytes = new Uint8Array(expectedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (offset !== expectedBytes) throw new Error("FFmpeg core WASM chunks did not match the manifest size.");
  return bytes.buffer;
}

async function decodePngBytes(bytes: Uint8Array): Promise<DecodedSpritesheetImage> {
  const pngBytes = Uint8Array.from(bytes).buffer;
  const bitmap = await createImageBitmap(new Blob([pngBytes], { type: "image/png" }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.drawImage(bitmap, 0, 0);
  return {
    width: bitmap.width,
    height: bitmap.height,
    pixels: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
  };
}

async function deleteIfExists(ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg, path: string): Promise<void> {
  await ffmpeg.deleteFile(path).catch(() => undefined);
}

function fileExtension(filename: string): string {
  const match = /\.[^./\\]+$/.exec(filename);
  return match?.[0] ?? ".img";
}
