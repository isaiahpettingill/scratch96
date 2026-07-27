# v0 Checklist

The first useful version demonstrates a complete browser-to-cartridge loop: blocks create a tiny game, TCC WASM compiles it to ELF, and Risc96 WASM previews it.

## Project Foundation

- [x] Define repository layout.
- [x] Define TypeScript project model.
- [x] Add sample project JSON in code.
- [x] Add initial generated C emitter.
- [x] Add TCC and Risc96 runtime adapter contracts.
- [x] Add C SDK skeleton.
- [x] Specify resolution as project settings-generated code, not a block.
- [x] Specify indexed-color sprite assets.
- [x] Scaffold Tauri v2 desktop wrapper folder.
- [x] Document vendored TCC and Risc96 runtime plan.
- [x] Document that the TCC RISC-V backend must be vendored too.
- [x] Add basic source-tree scaffold for editor, assets, compiler targets, and platform adapters.
- [x] Adopt Carbon Web Components for non-Blockly UI.
- [x] Add project save/load from local JSON.
- [x] Add stable project JSON runtime validator.
- [x] Add unit and integration tests through Vite+.

## Editor Shell

- [x] Add top bar controls.
- [x] Add stage, workspace, inspector, and console layout.
- [x] Use Carbon Web Components for current top bar controls.
- [x] Wire top bar buttons to actions.
- [x] Add generated C tab.
- [x] Add generated assets/compiler output view.
- [x] Add general settings page for resolution, fps, title, author, target, and cartridge estimate.
- [ ] Add debug log stream.
- [ ] Add keyboard input capture for preview.

## Blockly v0

- [x] Install Blockly dependency.
- [x] Mount Blockly workspace.
- [x] Define `when game starts` block.
- [x] Define `forever` block.
- [x] Define `debug log` block.
- [x] Define `set background color` block.
- [x] Define `create sprite at x y` block.
- [x] Define `player [n] button [x] pressed` block.
- [x] Define `move sprite by dx dy` block.
- [ ] Serialize Blockly state into project JSON.
- [x] Lower Blockly state into compiler commands.

## Compiler v0

- [x] Emit `r96_user_start()`.
- [x] Emit `r96_user_update()`.
- [x] Emit basic debug, background, sprite create, and button move calls.
- [x] Emit `generated_assets.h` sprite definitions.
- [x] Expand indexed sprite frames into color-keyed static pixel arrays.
- [x] Emit tone sequence sound definitions.
- [ ] Convert uploaded source audio to `pcm_s16_stereo_48000` before cartridge compile.
- [x] Bundle SDK source into TCC input files.
- [x] Surface diagnostics in the console panel.
- [ ] Estimate cartridge size.

## SDK v0

- [x] Define friendly sprite, input, sound, and engine APIs.
- [x] Add engine loop skeleton.
- [x] Add AABB collision.
- [x] Add controller bit decoding helper.
- [ ] Implement Risc96 syscall wrappers.
- [ ] Implement framebuffer clear.
- [ ] Implement sprite drawing with color-key transparency.
- [ ] Implement input polling from controller syscalls.
- [ ] Implement debug log syscall.
- [ ] Implement present syscall.
- [ ] Implement tone sequence mixer.

## WASM Integration

- [ ] Vendor or script retrieval for `https://github.com/lupyuen/tcc-riscv32-wasm`.
- [ ] Vendor the TCC RISC-V backend support files needed by that compiler.
- [ ] Document exact TCC/backend source revisions and local patches.
- [ ] Place local TCC WASM artifact under `public/wasm/`.
- [ ] Vendor Risc96 under `vendor/risc96` or set it as a submodule.
- [ ] Add custom Risc96 WASM shell or build flag for scratch96 preview.
- [ ] Place local Risc96 runtime artifact under `public/wasm/`.
- [ ] Implement `TccCompiler` adapter.
- [ ] Implement `Risc96PreviewRuntime` adapter.
- [ ] Compile generated files to RV64 ELF in browser.
- [ ] Load generated ELF into preview runtime.
- [ ] Reset preview when a new ELF is built.
- [x] Add `cartridge.elf` download path once an ELF exists.

## First Milestone Acceptance Test

- [ ] Drag `when game starts`.
- [ ] Add `debug log Hello`.
- [ ] Add `set background color`.
- [ ] Add `create sprite at x y`.
- [ ] Add `forever`.
- [ ] Add `if right pressed, move sprite by 2`.
- [ ] Press `Run`.
- [ ] Browser compiles an ELF.
- [ ] Risc96 WASM runtime previews the game.
- [ ] Right arrow moves the sprite.
- [ ] Debug log shows expected output.

## Desktop v1 Track

- [x] Add `src-tauri/` scaffold.
- [ ] Initialize real Tauri v2 config and Rust crate.
- [ ] Ensure desktop loads the same Vite app as the website.
- [ ] Share browser compiler and WASM adapter code with desktop.
- [ ] Add native file open/save through Tauri commands.

## Asset Import v1 Track

- [ ] Add Aseprite `.ase` / `.aseprite` import using `https://github.com/jyoung4242/aseprite-parser`.
- [ ] Convert imported Aseprite palettes, layers, and frames into scratch96 indexed-color sprite assets.
- [ ] Preserve frame timing and tags for animation metadata.
