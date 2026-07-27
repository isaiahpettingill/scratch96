# Vendored Dependencies

scratch96 needs reproducible browser compiler/runtime artifacts. Vendor source dependencies here, or replace these placeholders with submodules once the update policy is settled.

Planned dependencies:

- `tinycc`: upstream TinyCC source from `https://github.com/TinyCC/tinycc`, tracked as a git submodule and used by `npm run codegen:tcc-wasm`.
- `tcc-riscv32-wasm`: legacy browser TCC compiler snapshot from `https://github.com/lupyuen/tcc-riscv32-wasm`.
- `tcc-riscv32-wasm-backend`: backend support files needed by the TCC RISC-V compiler.
- `risc96`: Risc96 runtime source used to build the scratch96 preview WASM shell.

Do not commit generated WASM binaries here until source, license, and update flow are documented.
