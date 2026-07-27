# Tauri Desktop Wrapper

This folder is reserved for the Tauri v2 desktop version of scratch96.

The desktop app should share nearly all code with the website:

- Vite app shell.
- Native Web Components.
- Project model.
- Blockly integration.
- Compiler orchestration.
- TCC WASM adapter.
- Risc96 preview runtime adapter.

Tauri should add only desktop-specific capabilities:

- Native file open/save dialogs.
- Stable project paths.
- Desktop packaging.
- Optional local cache management for WASM artifacts.

Initialize with Tauri v2 when ready: `npm create tauri-app@latest` or the current Tauri v2 setup flow from `https://v2.tauri.app/`.
