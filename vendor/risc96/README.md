# Risc96 Runtime

scratch96 needs a Risc96 WASM runtime that can load a generated ELF, expose framebuffer/audio/controller buffers to the web preview, stream debug logs, and reset quickly after rebuilds.

Implementation options:

- Vendor or submodule the Risc96 repository here.
- Add a scratch96-specific WASM shell around the runtime.
- Or add a Risc96 compile flag that builds the WASM surface scratch96 needs.

The website and Tauri desktop wrapper should both consume the same runtime adapter contract in `src/runtime/adapters.ts`.
