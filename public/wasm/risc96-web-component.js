import createRisc96Embed from "./risc96_embed.js";

const buttonIndexes = {
  up: 0,
  down: 1,
  left: 2,
  right: 3,
  a: 4,
  b: 5,
  x: 6,
  y: 7,
  l1: 8,
  r1: 9,
  start: 10,
  select: 11,
};

function cartridgeHash(bytes) {
  let hash = 2166136261 >>> 0;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function bytesToStorage(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return btoa(text);
}

function storageToBytes(text, size) {
  const binary = atob(text);
  const bytes = new Uint8Array(Math.min(size, binary.length));
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class Risc96RuntimeController extends EventTarget {
  #module;
  #canvas;
  #context;
  #imageData;
  #sramKey;

  static async create(options = {}) {
    const module = await createRisc96Embed(options.module ?? {});
    return new Risc96RuntimeController(module, options.canvas);
  }

  constructor(module, canvas) {
    super();
    this.#module = module;
    this.attachCanvas(canvas ?? document.createElement("canvas"));
  }

  get module() {
    return this.#module;
  }

  get canvas() {
    return this.#canvas;
  }

  attachCanvas(canvas) {
    this.#canvas = canvas;
    this.#context = canvas.getContext("2d", { alpha: false });
    this.#imageData = undefined;
  }

  loadCartridge(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.#sramKey = `risc96:sram:${cartridgeHash(data)}:${data.byteLength}`;
    const ptr = this.#module._malloc(data.byteLength);
    this.#module.HEAPU8.set(data, ptr);
    const ok = this.#module._risc96_load_cartridge(ptr, data.byteLength) === 1;
    this.#module._free(ptr);
    if (ok) this.#loadSram();
    this.#emitLogs();
    if (!ok) throw new Error(this.lastError() || "Failed to load Risc96 cartridge.");
  }

  reset() {
    this.#saveSram();
    const ok = this.#module._risc96_reset() === 1;
    if (ok) this.#loadSram();
    this.#emitLogs();
    return ok;
  }

  unload() {
    this.#saveSram();
    this.#module._risc96_unload();
  }

  runFrame(options = {}) {
    const result = this.#module._risc96_run_frame(options.maxSlices ?? 16, options.maxInstructionsPerSlice ?? 2000000);
    this.drawFrame();
    this.#saveSram();
    this.#emitLogs();
    this.dispatchEvent(new CustomEvent("frame", { detail: { result } }));
    return result;
  }

  runSlice(maxInstructions = 2000000) {
    const result = this.#module._risc96_run_slice(maxInstructions);
    this.#emitLogs();
    return result;
  }

  stepInstruction() {
    const result = this.#module._risc96_debug_step();
    this.#emitLogs();
    return result;
  }

  debugSnapshot() {
    const ptr = this.#module._risc96_debug_snapshot_json();
    return JSON.parse(this.#module.UTF8ToString(ptr));
  }

  readMemory(address, length) {
    const ptr = this.#module._malloc(length);
    const ok = this.#module._risc96_debug_read_memory(BigInt(address), ptr, length) === 1;
    const bytes = this.#module.HEAPU8.slice(ptr, ptr + length);
    this.#module._free(ptr);
    if (!ok) throw new Error("Failed to read guest memory.");
    return bytes;
  }

  setControllerButton(port, button, level) {
    const index = typeof button === "string" ? buttonIndexes[button] : button;
    if (index === undefined) throw new Error(`Unknown Risc96 button: ${button}`);
    this.#module._risc96_set_controller_button(port, index, level);
  }

  clearController(port) {
    this.#module._risc96_clear_controller(port);
  }

  drainLogs() {
    const ptr = this.#module._risc96_drain_logs();
    return this.#module.UTF8ToString(ptr);
  }

  lastError() {
    const ptr = this.#module._risc96_last_error();
    return this.#module.UTF8ToString(ptr);
  }

  drawFrame() {
    const width = this.#module._risc96_framebuffer_width();
    const height = this.#module._risc96_framebuffer_height();
    const pitch = this.#module._risc96_framebuffer_pitch();
    const ptr = this.#module._risc96_framebuffer_ptr();
    if (!ptr || !this.#context) return;

    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
      this.#imageData = undefined;
    }

    if (!this.#imageData || this.#imageData.width !== width || this.#imageData.height !== height) {
      this.#imageData = this.#context.createImageData(width, height);
    }

    const out = this.#imageData.data;
    for (let y = 0; y < height; y++) {
      const row = ptr + y * pitch;
      for (let x = 0; x < width; x++) {
        const pixel = this.#module.HEAPU32[(row >> 2) + x];
        const target = (y * width + x) * 4;
        out[target] = (pixel >> 16) & 0xff;
        out[target + 1] = (pixel >> 8) & 0xff;
        out[target + 2] = pixel & 0xff;
        out[target + 3] = 0xff;
      }
    }
    this.#context.putImageData(this.#imageData, 0, 0);
  }

  #emitLogs() {
    const text = this.drainLogs();
    if (text.length > 0) {
      this.dispatchEvent(new CustomEvent("risc96-log", { detail: { text } }));
    }
  }

  #loadSram() {
    if (!this.#sramKey || globalThis.localStorage === undefined) return;
    const ptr = this.#module._risc96_sram_ptr();
    const size = this.#module._risc96_sram_size();
    if (!ptr || !size) return;
    const text = localStorage.getItem(this.#sramKey);
    if (!text) return;
    try {
      this.#module.HEAPU8.set(storageToBytes(text, size), ptr);
    } catch {
      localStorage.removeItem(this.#sramKey);
    }
  }

  #saveSram() {
    if (!this.#sramKey || globalThis.localStorage === undefined) return;
    const ptr = this.#module._risc96_sram_ptr();
    const size = this.#module._risc96_sram_size();
    if (!ptr || !size) return;
    try {
      localStorage.setItem(this.#sramKey, bytesToStorage(this.#module.HEAPU8.slice(ptr, ptr + size)));
    } catch {
      // Storage may be disabled or full; SRAM persistence is best-effort in browsers.
    }
  }
}

export class Risc96RuntimeElement extends HTMLElement {
  #controller;
  #canvas;

  connectedCallback() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>:host{display:inline-block}canvas{display:block;width:100%;height:auto;image-rendering:pixelated;background:#000}</style><canvas part="canvas"></canvas>`;
    this.#canvas = shadow.querySelector("canvas");
  }

  async ready(options = {}) {
    if (!this.#controller) {
      this.#controller = await Risc96RuntimeController.create({ ...options, canvas: this.#canvas });
      this.#controller.addEventListener("risc96-log", (event) => {
        this.dispatchEvent(new CustomEvent("risc96-log", { detail: event.detail }));
      });
      this.dispatchEvent(new CustomEvent("risc96-ready", { detail: { runtime: this.#controller } }));
    }
    return this.#controller;
  }

  async loadCartridge(bytes) {
    const runtime = await this.ready();
    runtime.loadCartridge(bytes);
  }

  async runFrame(options) {
    const runtime = await this.ready();
    return runtime.runFrame(options);
  }

  async debugSnapshot() {
    const runtime = await this.ready();
    return runtime.debugSnapshot();
  }
}

export function defineRisc96RuntimeElement(tagName = "risc96-runtime") {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, Risc96RuntimeElement);
  }
}

defineRisc96RuntimeElement();
