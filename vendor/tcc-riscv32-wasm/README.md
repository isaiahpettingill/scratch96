# tcc-riscv32-wasm

Planned upstream: `https://github.com/lupyuen/tcc-riscv32-wasm`.

Vendored source is under `upstream/` at commit `8cffa69ed303d80206b7cb6e6e3737506243777c`.

This dependency provides the browser-side TCC compiler used by scratch96 to compile generated freestanding C into a RISC-V ELF cartridge.

The browser artifact is checked in at `public/wasm/tcc-wasm.wasm` with metadata in `public/wasm/tcc-wasm.manifest.json`.

Rebuild notes:

1. Use WSL Debian rather than Windows shell paths; Windows configure paths break C string literals.
2. Use Zig `0.12.0`, matching the upstream build era.
3. Build from a temporary copy with LF-normalized sources if the vendored checkout has CRLF scripts.
4. Run upstream `configure`, generate the RISC-V cross backend files with `make cross-riscv64`, then link `zig/tcc-wasm.zig` with `tcc.o` for `wasm32-freestanding`.

Local patch:

- `zig/tcc-wasm.zig` streams source reads in chunks instead of assuming the complete C source fits in one TCC read buffer.

Open decisions:

- Whether RV64 support needs local patches or a separate compiler path.
- License and attribution placement.
