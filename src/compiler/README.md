# Compiler

Compiler code turns project JSON into a cartridge build graph.

Planned stages:

- Validate project settings, scripts, sprites, and sounds.
- Lower Blockly state into compiler commands.
- Emit generated user C hooks.
- Emit `generated_assets.h` from indexed sprites and audio assets.
- Package SDK source files.
- Invoke the TCC WASM adapter.
- Return ELF bytes, generated C, diagnostics, and cartridge size estimates.
