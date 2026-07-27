# tcc-riscv32-wasm Backend

scratch96 must vendor the backend pieces required by `https://github.com/lupyuen/tcc-riscv32-wasm`, not only the top-level JS/WASM compiler wrapper.

This folder should record the exact backend inputs needed to produce deterministic cartridges:

- RISC-V code generation backend sources.
- Generated backend tables or configuration headers.
- Freestanding libc headers expected by generated cartridge C.
- Runtime objects or startup files required by the TCC build.
- Local patches needed for the Risc96 ABI or cartridge target.

Open decisions:

- Whether this is a direct source vendor, submodule, or scripted fetch with pinned commit.
- Whether scratch96 targets RV32 first because of upstream, or carries the work needed for RV64.
- How backend files are packaged for both website and Tauri builds.
