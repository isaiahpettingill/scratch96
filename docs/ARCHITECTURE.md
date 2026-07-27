# Architecture

scratch96 has three main boundaries: editor, compiler, and cartridge runtime SDK.

The main product is a website built with native Web Components and vanilla TypeScript. Non-Blockly editor UI should use Carbon Web Components from `https://web-components.carbondesignsystem.com/`. The desktop product is a Tauri v2 wrapper around the same web app and compiler code, not a separate implementation.

## Editor Owns

- Project JSON source of truth.
- General settings page for resolution, fps, title, author, target, and cartridge metadata.
- Blockly workspace state.
- Sprite and audio asset editors.
- Code generation orchestration.
- TCC WASM compile invocation.
- ELF download.
- Risc96 preview boot, reload, input capture, and debug log display.

## Generated Cartridge Owns

- Game state.
- Engine loop.
- Sprite list.
- Collision checks.
- Framebuffer drawing.
- Audio mixing.

## Risc96 Runtime Owns

- Guest memory.
- Framebuffer, audio, and controller buffers.
- Syscall handling.
- Deterministic stepping.
- Preview execution.

## Compile Stages

```text
Project JSON
  -> validation
  -> settings-derived startup code
  -> generated_assets.h
  -> generated user C hooks
  -> risc96_blockly_runtime.c/.h
  -> tcc-wasm
  -> RV64 ELF
  -> Risc96 WASM runtime
```

## Blockly Lowering

The initial compiler lowers only two event bodies:

- `when game starts` -> `r96_user_start()`
- `forever` -> `r96_user_update()`

Button events are syntactic sugar for checks inside `r96_user_update()`.

Resolution is not exposed as a block. It lives in project settings and compiles into startup code before user blocks run.

## SDK ABI Boundary

The SDK maps friendly game APIs to Risc96 syscalls.

| SDK call                | Risc96 syscall |
| ----------------------- | -------------- |
| `r96_framebuffer()`     | `500`          |
| `r96_audio_buffer()`    | `501`          |
| `r96_controller_ptr(n)` | `502`-`505`    |
| `r96_present()`         | `506`          |
| `r96_set_resolution()`  | `507`          |
| `r96_elapsed_ms()`      | `493`          |
| `r96_debug_log()`       | `495`          |
| `r96_exit()`            | `93`           |

Blockly should never expose those syscalls directly.

## Asset Embedding

Generated C embeds assets as static arrays because cartridges have no runtime filesystem. Sprite editor data is indexed-color: frames store palette indexes, and compile expands palette indexes into Risc96 pixel values.

```c
#define SPRITE_PLAYER 0

static const unsigned char sprite_player_indexes[16 * 16] = {
  0, 1
};

static const unsigned int sprite_player_pixels[16 * 16] = {
  0x00000000, 0x00ff0000
};

static const r96_sprite_def_t r96_sprite_defs[] = {
  {.width = 16, .height = 16, .pixels = sprite_player_pixels}
};
```

## v0 Constraints

- RV64 target only.
- 60 fps only.
- AABB collision only.
- Indexed-color sprite editor with color-key transparency only.
- Tone sequence audio only.
- Generated C tab is visible for debugging but not the main user surface.

## v1 Asset Import

Aseprite import should use `https://github.com/jyoung4242/aseprite-parser` and convert `.ase` / `.aseprite` files into the same indexed-color sprite asset model used by the editor. Imported palettes, frames, layers, frame durations, and tags should be preserved as project metadata rather than treated as flattened RGB bitmaps.

## Future Cartridge Metadata Packing

Risc96 supports embedded cart metadata sections in ELF32 or ELF64 binaries: `.risc96.meta` JSON and `.risc96.cover` R96C indexed cover data. scratch96 should eventually run a WASM build of the Rust `r96` metadata patcher so browser builds can embed title, author, version, description, and cover art directly into exported cartridges.

This is intentionally not implemented yet in scratch96. Current scratch96 output remains the compiled Risc96 ELF from TCC WASM. The planned browser pipeline is:

- compile generated C/assets to a Risc96 ELF with TCC WASM
- generate or import a 320x180 indexed cover from project artwork
- run the WASM `r96 pack` equivalent in-browser
- export the packed `.r96` ELF with `.risc96.meta` and `.risc96.cover`

The patcher must preserve Risc96's constraint that metadata packing does not relink, compile, transform code, or edit guest-loadable segments.

## WASM Dependencies

- TCC should be pulled from `https://github.com/lupyuen/tcc-riscv32-wasm` unless a better maintained equivalent is chosen later.
- The TCC RISC-V backend support files must be vendored too, not just a thin JS/WASM launcher. The repo should record exactly which backend sources, generated tables, libc headers, and runtime objects are required to produce scratch96 cartridges reproducibly.
- Risc96 should be vendored or submoduled under `vendor/risc96`.
- scratch96 needs either a custom Risc96 WASM shell or a Risc96 build flag that produces the runtime surface needed by the editor preview.
- The browser and Tauri desktop app should both call the same TypeScript compiler orchestration and runtime adapter contracts.

## Desktop Wrapper

The `src-tauri/` folder is reserved for Tauri v2. It should load the same Vite app used by the website, using Tauri only for native shell capabilities such as file dialogs, persistent local paths, and desktop packaging.
