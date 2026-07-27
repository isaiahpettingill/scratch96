# WASM Artifacts

Browser runtime artifacts live here and are committed when they are part of scratch96's reproducible toolchain.

Expected v0 files:

- `tcc-wasm.wasm`
- `tcc-wasm.js`
- `tcc-wasm.manifest.json`
- `risc96_embed.js`
- `risc96_embed.wasm`
- `risc96-web-component.js`
- `risc96-embed.manifest.json`

The TCC artifact is generated from the `vendor/tinycc` submodule with `npm run codegen:tcc-wasm`. The manifest records the TinyCC commit, Emscripten toolchain, loader, and WASM hashes.

The Risc96 runtime artifact comes from the `risc96_embed` Emscripten target recorded in `risc96-embed.manifest.json`. It exposes a JavaScript-controlled runtime and `<risc96-runtime>` web component for scratch96 previews.
