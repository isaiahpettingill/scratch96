import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const qbeDir = join(root, "vendor", "qbe");
const generatedDir = join(root, "build", "qbe-wasm", "generated");
const wasmDir = join(root, "public", "wasm");
const wrapperPath = join(root, "tools", "qbe-wasm", "qbe_wrapper.c");
const wasmPath = join(wasmDir, "qbe.wasm");
const loaderPath = join(wasmDir, "qbe.js");
const manifestPath = join(wasmDir, "qbe.manifest.json");

await mkdir(generatedDir, { recursive: true });
await mkdir(wasmDir, { recursive: true });
await writeFile(join(generatedDir, "config.h"), "#define Defasm Gaself\n#define Deftgt T_rv64\n");

const emcc = process.env.EMCC ?? "emcc";
const emccVersion = (commandOutput(emcc, ["--version"]).split("\n")[0] ?? emcc).trim();
const upstreamCommit = commandOutput("git", ["-C", qbeDir, "rev-parse", "HEAD"]);
const sources = [
  "main.c",
  "util.c",
  "parse.c",
  "cfg.c",
  "mem.c",
  "ssa.c",
  "alias.c",
  "load.c",
  "copy.c",
  "fold.c",
  "live.c",
  "spill.c",
  "rega.c",
  "gas.c",
  "amd64/targ.c",
  "amd64/sysv.c",
  "amd64/isel.c",
  "amd64/emit.c",
  "arm64/targ.c",
  "arm64/abi.c",
  "arm64/isel.c",
  "arm64/emit.c",
  "rv64/targ.c",
  "rv64/abi.c",
  "rv64/isel.c",
  "rv64/emit.c",
].map((source) => join(qbeDir, source));

run(emcc, [
  ...sources,
  wrapperPath,
  "-o",
  loaderPath,
  "-I",
  generatedDir,
  "-I",
  qbeDir,
  "-Dmain=qbe_main",
  "-Dexit=qbe_exit",
  "-std=c99",
  "-O2",
  "-fno-strict-aliasing",
  "-Wno-unused-result",
  "-sMODULARIZE=1",
  "-sEXPORT_ES6=1",
  "-sENVIRONMENT=web,worker",
  "-sALLOW_MEMORY_GROWTH=1",
  "-sINITIAL_MEMORY=67108864",
  "-sSTACK_SIZE=1048576",
  "-sFORCE_FILESYSTEM=1",
  "-sEXPORTED_FUNCTIONS=['_compile_qbe_to_assembly','_allocUint8','_freeUint8','_last_error','_malloc','_free']",
  "-sEXPORTED_RUNTIME_METHODS=['HEAPU8']",
  "--no-entry",
]);

const wasmBytes = await readFile(wasmPath);
const loaderBytes = await readFile(loaderPath);
const sha256 = createHash("sha256").update(wasmBytes).digest("hex");
const loaderSha256 = createHash("sha256").update(loaderBytes).digest("hex");
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      name: "qbe-wasm",
      upstream: "https://github.com/ibara/qbe",
      upstreamCommit,
      artifact: "qbe.wasm",
      loader: "qbe.js",
      sha256,
      loaderSha256,
      target: "wasm32-emscripten",
      exports: ["compile_qbe_to_assembly", "allocUint8"],
      buildToolchain: { emcc: emccVersion },
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${wasmPath}`);
console.log(`wrote ${loaderPath}`);
console.log(`wrote ${manifestPath}`);

function commandOutput(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}
