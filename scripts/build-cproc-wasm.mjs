import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cprocDir = join(root, "vendor", "cproc");
const wasmDir = join(root, "public", "wasm");
const wrapperPath = join(root, "tools", "cproc-wasm", "cproc_qbe_wrapper.c");
const wasmPath = join(wasmDir, "cproc-qbe.wasm");
const loaderPath = join(wasmDir, "cproc-qbe.js");
const manifestPath = join(wasmDir, "cproc-qbe.manifest.json");

await mkdir(wasmDir, { recursive: true });

const emcc = process.env.EMCC ?? "emcc";
const emccVersion = (commandOutput(emcc, ["--version"]).split("\n")[0] ?? emcc).trim();
const upstreamCommit = commandOutput("git", ["-C", cprocDir, "rev-parse", "HEAD"]);
const sources = [
  "attr.c",
  "decl.c",
  "eval.c",
  "expr.c",
  "init.c",
  "main.c",
  "map.c",
  "pp.c",
  "scan.c",
  "scope.c",
  "stmt.c",
  "targ.c",
  "token.c",
  "tree.c",
  "type.c",
  "utf.c",
  "util.c",
  "qbe.c",
].map((source) => join(cprocDir, source));

run(emcc, [
  ...sources,
  wrapperPath,
  "-o",
  loaderPath,
  "-I",
  cprocDir,
  "-Dmain=cproc_qbe_main",
  "-Dexit=cproc_exit",
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
  "-sEXPORTED_FUNCTIONS=['_compile_c_to_qbe','_allocUint8','_freeUint8','_last_error','_malloc','_free']",
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
      name: "cproc-qbe-wasm",
      upstream: "https://github.com/michaelforney/cproc",
      upstreamCommit,
      artifact: "cproc-qbe.wasm",
      loader: "cproc-qbe.js",
      sha256,
      loaderSha256,
      target: "wasm32-emscripten",
      exports: ["compile_c_to_qbe", "allocUint8"],
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
