import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const chunkBytes = 4 * 1024 * 1024;
const require = createRequire(import.meta.url);
const corePath = require.resolve("@ffmpeg/core");
const coreDir = dirname(corePath);
const wasmPath = join(coreDir, "ffmpeg-core.wasm");
const outputDir = new URL("../public/ffmpeg-core/", import.meta.url);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await writeFile(new URL(basename(corePath), outputDir), await readFile(corePath));

const wasm = await readFile(wasmPath);
const chunks = [];
for (let offset = 0, index = 0; offset < wasm.length; offset += chunkBytes, index += 1) {
  const filename = `ffmpeg-core.wasm.${String(index).padStart(2, "0")}.part`;
  chunks.push(filename);
  await writeFile(new URL(filename, outputDir), wasm.subarray(offset, offset + chunkBytes));
}

await writeFile(
  new URL("manifest.json", outputDir),
  `${JSON.stringify({ core: basename(corePath), chunks, bytes: wasm.length, chunkBytes }, null, 2)}\n`,
);
