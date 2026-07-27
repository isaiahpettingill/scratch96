import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const crateDir = join(root, "tools", "aseprite-wasm");
const outDir = join(root, "src", "project", "asepriteWasm");
const wasmTarget = join(crateDir, "target", "wasm32-unknown-unknown", "release", "scratch96_aseprite_wasm.wasm");
const generatedWasm = join(outDir, "aseprite_import_bg.wasm");
const generatedJs = join(outDir, "aseprite_import.js");
const manifestPath = join(outDir, "aseprite_import.manifest.json");

await mkdir(outDir, { recursive: true });

run("cargo", ["build", "--manifest-path", join(crateDir, "Cargo.toml"), "--release", "--target", "wasm32-unknown-unknown"]);
run("wasm-bindgen", [wasmTarget, "--target", "web", "--out-dir", outDir, "--out-name", "aseprite_import"]);

const wasmBytes = await readFile(generatedWasm);
const jsBytes = await readFile(generatedJs);
const upstreamCommit = commandOutput("git", ["-C", join(root, "vendor", "aseprite-io"), "rev-parse", "HEAD"]);

await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      name: "aseprite-import-wasm",
      upstream: "https://github.com/spebern/aseprite-io",
      upstreamCommit,
      wasm: "aseprite_import_bg.wasm",
      js: "aseprite_import.js",
      wasmSha256: createHash("sha256").update(wasmBytes).digest("hex"),
      jsSha256: createHash("sha256").update(jsBytes).digest("hex"),
      target: "wasm32-unknown-unknown",
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${generatedJs}`);
console.log(`wrote ${generatedWasm}`);
console.log(`wrote ${manifestPath}`);

function commandOutput(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}
