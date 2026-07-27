# scratch96

scratch96 is a Scratch-like cartridge IDE for Risc96. It lets a user build a small game with blocks, assets, and sounds, then compiles the project into a freestanding RISC-V ELF cartridge that runs in the Risc96 runtime.

The editor should feel like Scratch. The compiler should emit plain C against a tiny Risc96 game SDK. Blockly users should not see RISC-V, syscalls, pointers, framebuffer layout, or audio buffer details.

## Product Shape

```text
┌────────────────────────────────────────────────────────────────────┐
│ Top bar                                                            │
│ [Run] [Stop] [Build ELF] [Download Cartridge] [Save Project]        │
├───────────────┬───────────────────────────────┬────────────────────┤
│ Game Preview  │ Blockly Workspace             │ Inspector / Assets  │
│               │                               │                    │
│ Risc96 WASM   │ Scratch-like blocks            │ Sprites            │
│ runtime       │                               │ Frames             │
│ running ELF   │ Optional generated C view      │ Sounds             │
│               │                               │ Cartridge info     │
├───────────────┴───────────────────────────────┴────────────────────┤
│ Console / debug log / compile errors                                │
└────────────────────────────────────────────────────────────────────┘
```

scratch96 is a cartridge IDE, not just Blockly wired to a toy compiler:

```text
Project JSON
  ├─ block scripts
  ├─ sprites / frames
  ├─ audio assets
  ├─ general project settings
  └─ generated C cartridge

Compile:
  Project JSON
    -> generated freestanding C + embedded assets
    -> TCC WASM
    -> RISC-V ELF
    -> Risc96 WASM runtime preview
```

## Core Pipeline

The browser app needs three independent pieces:

1. `editor app JS/TS`: project model, Blockly workspace, asset editors, compiler orchestration.
2. `tcc-wasm`: compiles generated freestanding C to a RISC-V ELF. It is generated from the `vendor/tinycc` submodule with `npm run codegen:tcc-wasm`.
3. `risc96-runtime.wasm`: runs the generated ELF in the game preview.

```text
Blockly state + assets
  -> scratch96 compiler
  -> generated C + embedded static asset arrays
  -> tcc-wasm
  -> cartridge.elf
  -> risc96-runtime.wasm preview
```

## Repository Layout

```text
docs/
  ARCHITECTURE.md       Product and compiler boundaries.
  V0_CHECKLIST.md       Build checklist for the first useful version.
public/
  wasm/README.md        Expected local WASM artifacts.
sdk/
  risc96_blockly_runtime.h
  risc96_blockly_runtime.c
src-tauri/              Tauri v2 desktop wrapper scaffold.
src/
  app.ts                Native Web Component browser shell.
  app.css               Initial three-panel IDE layout.
  main.ts               Vite entrypoint.
  assets/               Sprite, palette, audio, and import pipeline code.
  compiler/             Project validation and C emission.
  editor/               Blockly blocks, panels, and editor state.
  platform/             Web and Tauri host adapters.
  project/              JSON source-of-truth model and sample project.
  runtime/              TCC and Risc96 runtime adapter contracts.
vendor/
  README.md             Vendored dependency plan.
  risc96/README.md      Risc96 runtime vendoring plan.
  tcc-riscv32-wasm/README.md
  tcc-riscv32-wasm-backend/README.md
```

## Development

Prerequisites:

- Node.js 20+
- npm or another Node package manager
- Local Risc96 WASM runtime artifacts when preview integration starts.
- Local TCC WASM artifacts from `lupyuen/tcc-riscv32-wasm`, including the backend support files it needs at runtime/build time.
- Rust tooling when working on the Tauri v2 desktop wrapper.

Install and run:

```sh
npm install
npm run dev
```

Useful commands:

```sh
npm run check
npm run test
npm run typecheck
npm run build
```

This project uses Vite+ from `https://viteplus.dev/` as the unified Rust-backed toolchain for dev, check, test, and build. Tests use Vite+'s Vitest re-export imports from `vite-plus/test`.

The main version is a website built with native Web Components and vanilla TypeScript. Non-Blockly editor UI should use Carbon Web Components from `https://web-components.carbondesignsystem.com/`. The desktop version should use Tauri v2 and share the web app, compiler, project model, and WASM integration code wherever possible.

The scaffold currently emits a deterministic generated C preview from a sample project. The Blockly, TCC WASM, and Risc96 WASM integrations are intentionally isolated behind adapter contracts so they can be added without rewriting the project model or compiler boundary.

## Project Model

The project JSON is the source of truth. Blocks, sprites, sounds, settings, and generated C all derive from this model.

```ts
type Risc96Project = {
  version: 1;
  metadata: {
    name: string;
    author?: string;
  };
  settings: {
    width: number;
    height: number;
    fps: 60;
  };
  sprites: SpriteAsset[];
  sounds: SoundAsset[];
  scripts: Script[];
};
```

Resolution is specified on the general project settings page. It is not a block. The compiler emits settings-derived startup code such as `r96_set_resolution(width, height)` before user block code runs.

Sprites are stored as indexed-color images: each sprite owns a palette, frames store palette indexes, and the compiler expands those indexes into static cartridge pixel data. This keeps the editor palette-oriented and avoids treating sprites as raw RGB bitmaps.

For v0, sprite alpha stays editor-side through a transparent palette index. Compile should bake transparent pixels into masks or use a color key.

Audio v0 starts with tone sequences and PCM-ready cartridge data. The editor should eventually allow upload of common source formats such as WAV, MP3, OGG, and FLAC, but those imports should be converted into `pcm_s16_stereo_48000` before cartridge compilation. Treat broad audio upload as a v1 feature unless it blocks v0 testing.

## Initial Blockly Surface

- Events: `when game starts`, `forever`
- Looks: `set background color`, `show sprite`, `hide sprite`
- Motion: `set sprite x y`, `move sprite by dx dy`
- Control: `if`, `repeat forever`
- Sensing: `player [n] button [x] pressed`, `sprite touching?`
- Sound: `play sound`
- Debug: `log`

Initial lowering:

- `when game starts` emits `r96_user_start()`.
- `forever` emits `r96_user_update()`.
- Synthetic button events lower to checks inside `r96_user_update()`.

## Generated C Shape

The block compiler emits only user hooks and generated asset data. The engine loop comes from the generated/inlined SDK.

```c
#include "generated_assets.h"
#include "risc96_blockly_runtime.h"

static r96_sprite_t player;

void r96_user_start(void) {
  // Emitted from project settings, not from a Blockly block.
  r96_set_resolution(320, 224);
  r96_stage_set_background(0x00102030);
  player = r96_sprite_create(SPRITE_PLAYER, 100, 80);
}

void r96_user_update(void) {
  if (r96_button_down(0, R96_BUTTON_RIGHT)) {
    r96_sprite_move(&player, 2, 0);
  }
}

void _start(void) {
  r96_engine_main();
}
```

## v0 Milestone

The first useful version should support this end-to-end flow:

1. User drags `when game starts`.
2. User adds `debug log Hello`.
3. User adds `set background color`.
4. User adds `create sprite at x y`.
5. User adds `forever`.
6. User adds `if right pressed, move sprite by 2`.
7. User presses `Run`.
8. Browser compiles ELF with TCC WASM.
9. Risc96 WASM runtime previews it.

See `docs/V0_CHECKLIST.md` for the implementation checklist.

## Design Rule

```text
Scratch-like blocks
  -> Risc96 game SDK calls
  -> freestanding C
  -> RV64 ELF
```

Keep Risc96 ABI details inside the generated SDK/runtime layer. Keep the editor focused on projects, blocks, assets, compile output, and preview orchestration.
