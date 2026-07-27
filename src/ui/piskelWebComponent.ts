import type { SpriteAsset } from "../project/model.ts";

export type PiskelEditorData = {
  spriteId: string;
  name: string;
  width: number;
  height: number;
  transparentIndex: number;
  palette: { index: number; color: number }[];
  frames: { id: string; name?: string; colorIndexes: number[] }[];
};

export type PiskelEditorChange = PiskelEditorData;

const tagName = "scratch96-piskel-editor";

export function definePiskelEditorElement(): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, PiskelEditorElement);
  }
}

export function spriteToPiskelEditorData(sprite: SpriteAsset): PiskelEditorData {
  return {
    spriteId: sprite.id,
    name: sprite.name,
    width: sprite.width,
    height: sprite.height,
    transparentIndex: sprite.transparentIndex,
    palette: sprite.palette.map((entry) => ({ index: entry.index, color: entry.color })),
    frames: sprite.frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      colorIndexes: [...frame.colorIndexes],
    })),
  };
}

class PiskelEditorElement extends HTMLElement {
  private readonly iframe = document.createElement("iframe");
  private data?: PiskelEditorData;
  private readyPromise?: Promise<void>;
  private loadingData = false;
  private lastSnapshot = "";
  private emitTimer?: number;

  connectedCallback(): void {
    if (this.iframe.parentElement) return;

    this.classList.add("piskel-web-component-host");
    this.iframe.className = "piskel-web-component-frame";
    this.iframe.title = "Piskel sprite editor";
    this.iframe.src = "/vendor/piskel/index.html";
    this.iframe.addEventListener("load", () => void this.loadData());
    this.replaceChildren(this.iframe);
    void this.loadData();
  }

  disconnectedCallback(): void {
    if (this.emitTimer) window.clearTimeout(this.emitTimer);
  }

  set editorData(data: PiskelEditorData) {
    const snapshot = JSON.stringify(data);
    if (snapshot === this.lastSnapshot) return;

    this.data = cloneData(data);
    this.lastSnapshot = snapshot;
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    if (!this.data || !this.isConnected) return;

    await this.whenPiskelReady();
    const win = this.iframe.contentWindow as PiskelWindow | null;
    if (!win?.pskl?.app?.piskelController) return;

    this.loadingData = true;
    try {
      const piskel = createPiskel(win, this.data);
      win.pskl.app.piskelController.setPiskel(piskel, { noSnapshot: true });
      subscribeToPiskelChanges(win, () => this.queueEmitChange());
    } finally {
      this.loadingData = false;
    }
  }

  private async whenPiskelReady(): Promise<void> {
    this.readyPromise ??= new Promise((resolve) => {
      const poll = (): void => {
        const win = this.iframe.contentWindow as PiskelWindow | null;
        if (win?.pskl?.app?.piskelController && win.pskl.model?.Frame) {
          resolve();
        } else {
          window.setTimeout(poll, 50);
        }
      };
      poll();
    });

    return this.readyPromise;
  }

  private queueEmitChange(): void {
    if (this.loadingData || this.emitTimer) return;

    this.emitTimer = window.setTimeout(() => {
      this.emitTimer = undefined;
      this.emitChange();
    }, 150);
  }

  private emitChange(): void {
    const win = this.iframe.contentWindow as PiskelWindow | null;
    const piskel = win?.pskl?.app?.piskelController?.getPiskel?.();
    if (!win || !piskel || !this.data) return;

    const detail = piskelToEditorData(piskel, this.data);
    this.lastSnapshot = JSON.stringify(detail);
    this.dispatchEvent(
      new CustomEvent<PiskelEditorChange>("piskel-editor-change", {
        bubbles: true,
        detail,
      }),
    );
  }
}

function createPiskel(win: PiskelWindow, data: PiskelEditorData): unknown {
  const pskl = win.pskl;
  const descriptor = new pskl.model.piskel.Descriptor(data.name, "");
  const frames = data.frames.map((frame) =>
    pskl.model.Frame.fromPixelGrid(
      frame.colorIndexes.map((index) => colorIndexToPiskelInt(win, data, index)),
      data.width,
      data.height,
    ),
  );
  const layer = pskl.model.Layer.fromFrames("Layer 1", frames);
  return pskl.model.Piskel.fromLayers([layer], 12, descriptor);
}

function piskelToEditorData(piskel: PiskelModel, current: PiskelEditorData): PiskelEditorData {
  const layer = piskel.getLayerAt(0);
  const palette = [...current.palette].sort((a, b) => a.index - b.index);
  const colorIndexByRgba = new Map<string, number>();
  for (const entry of palette) {
    colorIndexByRgba.set(entry.index === current.transparentIndex ? "0,0,0,0" : colorToKey(entry.color, 255), entry.index);
  }

  const frames = layer.getFrames().map((frame, frameIndex) => {
    const source = current.frames[frameIndex];
    return {
      id: source?.id ?? `frame-${frameIndex + 1}`,
      name: source?.name ?? `Frame ${frameIndex + 1}`,
      colorIndexes: Array.from(frame.getPixels()).map((pixel) =>
        piskelIntToColorIndex(pixel, current.transparentIndex, palette, colorIndexByRgba),
      ),
    };
  });

  return {
    spriteId: current.spriteId,
    name: piskel.getDescriptor().name || current.name,
    width: piskel.getWidth(),
    height: piskel.getHeight(),
    transparentIndex: current.transparentIndex,
    palette,
    frames,
  };
}

function piskelIntToColorIndex(
  pixel: number,
  transparentIndex: number,
  palette: { index: number; color: number }[],
  colorIndexByRgba: Map<string, number>,
): number {
  const rgba = piskelIntToRgba(pixel);
  if (rgba.a === 0) return transparentIndex;

  const key = colorToKey((rgba.r << 16) | (rgba.g << 8) | rgba.b, rgba.a);
  const existing = colorIndexByRgba.get(key);
  if (existing !== undefined) return existing;

  const index = nextPaletteIndex(palette);
  palette.push({ index, color: (rgba.r << 16) | (rgba.g << 8) | rgba.b });
  colorIndexByRgba.set(key, index);
  return index;
}

function colorIndexToPiskelInt(win: PiskelWindow, data: PiskelEditorData, colorIndex: number): number {
  if (colorIndex === data.transparentIndex) return 0;

  const color = data.palette.find((entry) => entry.index === colorIndex)?.color ?? 0;
  return win.pskl.utils.colorToInt(`#${color.toString(16).padStart(6, "0")}`);
}

function piskelIntToRgba(pixel: number): { r: number; g: number; b: number; a: number } {
  return {
    r: pixel & 0xff,
    g: (pixel >> 8) & 0xff,
    b: (pixel >> 16) & 0xff,
    a: ((pixel >> 24) >>> 0) & 0xff,
  };
}

function colorToKey(color: number, alpha: number): string {
  return `${(color >> 16) & 0xff},${(color >> 8) & 0xff},${color & 0xff},${alpha}`;
}

function nextPaletteIndex(palette: { index: number }[]): number {
  return Math.max(-1, ...palette.map((entry) => entry.index)) + 1;
}

function subscribeToPiskelChanges(win: PiskelWindow, callback: () => void): void {
  if (win.__scratch96PiskelBridgeSubscribed) return;

  win.__scratch96PiskelBridgeSubscribed = true;
  win.$?.subscribe?.(win.Events.PISKEL_SAVE_STATE, callback);
  win.$?.subscribe?.(win.Events.PISKEL_RESET, callback);
  win.$?.subscribe?.(win.Events.PISKEL_DESCRIPTOR_UPDATED, callback);
}

function cloneData(data: PiskelEditorData): PiskelEditorData {
  return {
    ...data,
    palette: data.palette.map((entry) => ({ ...entry })),
    frames: data.frames.map((frame) => ({ ...frame, colorIndexes: [...frame.colorIndexes] })),
  };
}

type PiskelWindow = Window & {
  $?: { subscribe?: (eventName: string, callback: () => void) => void };
  Events: Record<string, string>;
  __scratch96PiskelBridgeSubscribed?: boolean;
  pskl: {
    app: { piskelController: { setPiskel: (piskel: unknown, options?: unknown) => void; getPiskel: () => PiskelModel } };
    model: {
      piskel: { Descriptor: new (name: string, description: string) => unknown };
      Frame: { fromPixelGrid: (pixels: number[], width: number, height: number) => PiskelFrame };
      Layer: { fromFrames: (name: string, frames: PiskelFrame[]) => unknown };
      Piskel: { fromLayers: (layers: unknown[], fps: number, descriptor: unknown) => unknown };
    };
    utils: { colorToInt: (color: string) => number };
  };
};

type PiskelFrame = {
  getPixels: () => Uint32Array;
};

type PiskelModel = {
  getDescriptor: () => { name: string };
  getFrameCount: () => number;
  getHeight: () => number;
  getLayerAt: (index: number) => { getFrames: () => PiskelFrame[] };
  getWidth: () => number;
};
