# Platform

Platform adapters isolate host differences.

The website is the primary target. Tauri v2 should reuse the same web app and compiler code, with platform-specific adapters only where needed.

Planned adapters:

- Browser file download and upload.
- Tauri file open/save dialogs.
- Shared WASM artifact loading.
- Persistent project storage.
