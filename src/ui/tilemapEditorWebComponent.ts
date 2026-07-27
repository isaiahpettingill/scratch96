import Konva from "konva";

import type { Risc96Project, SpriteAsset, TilemapAsset } from "../project/model.ts";

export type TilemapEditorData = {
  tilemap: TilemapAsset;
  tileset?: SpriteAsset;
};

export type TilemapEditorChange = TilemapAsset;

const tagName = "scratch96-tilemap-editor";
const minTileScale = 1;
const maxTileScale = 16;
const maxMapDimension = 8192;

export function defineTilemapEditorElement(): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, TilemapEditorElement);
  }
}

export function tilemapToEditorData(project: Risc96Project, tilemap: TilemapAsset): TilemapEditorData {
  return {
    tilemap: cloneTilemap(tilemap),
    tileset: project.sprites.find((sprite) => sprite.id === tilemap.tilesetSpriteId),
  };
}

class TilemapEditorElement extends HTMLElement {
  private data?: TilemapEditorData;
  private stage?: Konva.Stage;
  private mapLayer?: Konva.Layer;
  private overlayLayer?: Konva.Layer;
  private mapImage?: Konva.Image;
  private hoverCell?: Konva.Rect;
  private mapCanvas?: HTMLCanvasElement;
  private frameCanvases: HTMLCanvasElement[] = [];
  private selectedTile = -1;
  private tool: "paint" | "collision" = "paint";
  private tileScale = 4;
  private painting = false;
  private lastPaintedCell?: number;

  connectedCallback(): void {
    this.classList.add("tilemap-editor-host");
    this.render();
  }

  disconnectedCallback(): void {
    this.destroyStage();
  }

  set editorData(data: TilemapEditorData) {
    this.data = {
      tilemap: cloneTilemap(data.tilemap),
      tileset: data.tileset,
    };
    this.selectedTile =
      this.selectedTile < 0 ? -1 : Math.min(this.selectedTile, Math.max(0, (data.tileset?.frames.length ?? 1) - 1));
    if (this.isConnected) this.render();
  }

  private render(): void {
    this.destroyStage();

    if (!this.data) {
      this.replaceChildren();
      return;
    }

    if (!supportsCanvas()) {
      this.innerHTML = '<p class="tilemap-editor-unavailable">Canvas is unavailable in this browser.</p>';
      return;
    }

    this.innerHTML = `
      <section class="tilemap-editor-shell">
        <header class="tilemap-editor-toolbar">
          <div class="tilemap-editor-heading">
            <p class="eyebrow">Tilemap editor</p>
            <strong data-tilemap-editor-name></strong>
          </div>
          <div class="tilemap-editor-tools" role="toolbar" aria-label="Tilemap tools">
            <button type="button" data-tilemap-tool="paint" title="Paint selected tile">Paint</button>
            <button type="button" data-tilemap-tool="collision" title="Edit solid collision cells">Collision</button>
            <label class="tilemap-editor-dimension">Map W <input type="number" min="1" data-tilemap-width /></label>
            <label class="tilemap-editor-dimension">Map H <input type="number" min="1" data-tilemap-height /></label>
            <label class="tilemap-editor-dimension">Tile W <input type="number" min="1" data-tilemap-tile-width /></label>
            <label class="tilemap-editor-dimension">Tile H <input type="number" min="1" data-tilemap-tile-height /></label>
            <span class="tilemap-editor-presets" aria-label="Standard tile sizes">
              <button type="button" data-tilemap-preset="8">8×8</button>
              <button type="button" data-tilemap-preset="16">16×16</button>
              <button type="button" data-tilemap-preset="24">24×24</button>
            </span>
            <button type="button" data-tilemap-zoom="out" aria-label="Zoom out">−</button>
            <output data-tilemap-zoom-output></output>
            <button type="button" data-tilemap-zoom="in" aria-label="Zoom in">+</button>
          </div>
        </header>
        <div class="tilemap-editor-layout">
          <aside class="tilemap-editor-palette" aria-label="Tileset palette">
            <div class="tilemap-editor-palette-heading">
              <strong>Tiles</strong>
              <span data-tilemap-selection></span>
            </div>
            <div class="tilemap-editor-tiles" data-tilemap-palette></div>
          </aside>
          <div class="tilemap-editor-canvas-panel">
            <p class="tilemap-editor-help" data-tilemap-editor-help></p>
            <div class="tilemap-editor-viewport" data-tilemap-viewport>
              <div class="tilemap-editor-stage" data-tilemap-stage tabindex="0" aria-label="Tilemap canvas"></div>
            </div>
          </div>
        </div>
      </section>
    `;

    this.querySelector<HTMLElement>("[data-tilemap-editor-name]")!.textContent = this.data.tilemap.name;
    const width = this.querySelector<HTMLInputElement>("[data-tilemap-width]")!;
    const height = this.querySelector<HTMLInputElement>("[data-tilemap-height]")!;
    const tileWidth = this.querySelector<HTMLInputElement>("[data-tilemap-tile-width]")!;
    const tileHeight = this.querySelector<HTMLInputElement>("[data-tilemap-tile-height]")!;
    width.value = String(this.data.tilemap.width);
    height.value = String(this.data.tilemap.height);
    tileWidth.value = String(this.data.tilemap.tileWidth);
    tileHeight.value = String(this.data.tilemap.tileHeight);
    width.addEventListener("change", () => this.updateDimensions(width.value, this.data?.tilemap.height, this.data?.tilemap.tileWidth, this.data?.tilemap.tileHeight));
    height.addEventListener("change", () => this.updateDimensions(this.data?.tilemap.width, height.value, this.data?.tilemap.tileWidth, this.data?.tilemap.tileHeight));
    tileWidth.addEventListener("change", () => this.updateDimensions(this.data?.tilemap.width, this.data?.tilemap.height, tileWidth.value, this.data?.tilemap.tileHeight));
    tileHeight.addEventListener("change", () => this.updateDimensions(this.data?.tilemap.width, this.data?.tilemap.height, this.data?.tilemap.tileWidth, tileHeight.value));
    this.querySelectorAll<HTMLButtonElement>("[data-tilemap-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const size = button.dataset.tilemapPreset ?? "";
        this.updateDimensions(this.data?.tilemap.width, this.data?.tilemap.height, size, size);
      });
    });
    this.querySelectorAll<HTMLButtonElement>("[data-tilemap-tool]").forEach((button) => {
      button.addEventListener("click", () => this.selectTool(button.dataset.tilemapTool as "paint" | "collision"));
    });
    this.querySelectorAll<HTMLButtonElement>("[data-tilemap-zoom]").forEach((button) => {
      button.addEventListener("click", () => this.changeZoom(button.dataset.tilemapZoom === "in" ? 1 : -1));
    });

    this.renderPalette();
    this.mountStage();
    this.syncControls();
  }

  private renderPalette(): void {
    const palette = this.querySelector<HTMLElement>("[data-tilemap-palette]");
    if (!palette || !this.data) return;

    palette.replaceChildren();
    this.frameCanvases = createFrameCanvases(this.data.tileset);
    palette.append(this.createPaletteButton(-1, "Empty"));

    if (this.frameCanvases.length === 0) {
      const message = document.createElement("p");
      message.textContent = "Choose a tileset sprite to paint tiles.";
      palette.append(message);
      return;
    }

    this.frameCanvases.forEach((frameCanvas, index) => palette.append(this.createPaletteButton(index, String(index), frameCanvas)));
  }

  private createPaletteButton(index: number, labelText: string, frameCanvas?: HTMLCanvasElement): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tilemap-editor-tile";
    button.dataset.tilemapTile = String(index);
    button.title = index < 0 ? "Clear tile" : `Tile ${index}`;
    button.setAttribute("aria-label", index < 0 ? "Select empty tile" : `Select tile ${index}`);

    if (frameCanvas) {
      const preview = document.createElement("canvas");
      const scale = Math.max(1, Math.floor(48 / Math.max(frameCanvas.width, frameCanvas.height)));
      preview.className = "tilemap-editor-tile-preview";
      preview.width = frameCanvas.width * scale;
      preview.height = frameCanvas.height * scale;
      const context = preview.getContext("2d");
      if (context) {
        context.imageSmoothingEnabled = false;
        context.drawImage(frameCanvas, 0, 0, preview.width, preview.height);
      }
      button.append(preview);
    } else {
      const empty = document.createElement("span");
      empty.className = "tilemap-editor-empty-preview";
      empty.textContent = "∅";
      button.append(empty);
    }

    const label = document.createElement("span");
    label.textContent = labelText;
    button.append(label);
    button.addEventListener("click", () => {
      this.selectedTile = index;
      this.tool = "paint";
      this.syncControls();
    });
    return button;
  }

  private mountStage(): void {
    const host = this.querySelector<HTMLDivElement>("[data-tilemap-stage]");
    if (!host || !this.data) return;

    const stageWidth = this.data.tilemap.width * this.displayTileWidth();
    const stageHeight = this.data.tilemap.height * this.displayTileHeight();
    this.stage = new Konva.Stage({ container: host, width: stageWidth, height: stageHeight });
    this.mapLayer = new Konva.Layer({ listening: false });
    this.overlayLayer = new Konva.Layer();
    this.stage.add(this.mapLayer, this.overlayLayer);

    this.mapCanvas = document.createElement("canvas");
    this.redrawMap();
    this.mapImage = new Konva.Image({
      image: this.mapCanvas,
      width: stageWidth,
      height: stageHeight,
      imageSmoothingEnabled: false,
      listening: false,
    });
    this.mapLayer.add(this.mapImage);
    this.addGrid(stageWidth, stageHeight);

    this.hoverCell = new Konva.Rect({
      stroke: "#78a9ff",
      strokeWidth: 2,
      width: this.displayTileWidth(),
      height: this.displayTileHeight(),
      visible: false,
      listening: false,
    });
    this.overlayLayer.add(this.hoverCell);

    host.addEventListener("contextmenu", (event) => event.preventDefault());
    host.addEventListener("keydown", (event) => this.handleKeyboardShortcut(event));
    this.stage.on("pointerdown", (event) => this.beginPaint(event));
    this.stage.on("pointermove", (event) => this.continuePaint(event));
    this.stage.on("pointerup pointerleave", () => this.endPaint());
  }

  private addGrid(width: number, height: number): void {
    if (!this.mapLayer || !this.data) return;

    for (let x = 0; x <= this.data.tilemap.width; x += 1) {
      this.mapLayer.add(
        new Konva.Line({
          points: [x * this.displayTileWidth(), 0, x * this.displayTileWidth(), height],
          stroke: "rgba(224, 224, 224, 0.32)",
          strokeWidth: 1,
          listening: false,
        }),
      );
    }
    for (let y = 0; y <= this.data.tilemap.height; y += 1) {
      this.mapLayer.add(
        new Konva.Line({
          points: [0, y * this.displayTileHeight(), width, y * this.displayTileHeight()],
          stroke: "rgba(224, 224, 224, 0.32)",
          strokeWidth: 1,
          listening: false,
        }),
      );
    }
  }

  private redrawMap(): void {
    if (!this.mapCanvas || !this.data) return;

    const { tilemap } = this.data;
    this.mapCanvas.width = tilemap.width * tilemap.tileWidth;
    this.mapCanvas.height = tilemap.height * tilemap.tileHeight;
    const context = this.mapCanvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;
    context.fillStyle = "#161616";
    context.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);

    for (let y = 0; y < tilemap.height; y += 1) {
      for (let x = 0; x < tilemap.width; x += 1) {
        const index = y * tilemap.width + x;
        const frame = this.frameCanvases[tilemap.tiles[index] ?? -1];
        const left = x * tilemap.tileWidth;
        const top = y * tilemap.tileHeight;
        if (frame) context.drawImage(frame, left, top, tilemap.tileWidth, tilemap.tileHeight);
        if (tilemap.collisionTiles?.[index]) {
          context.fillStyle = "rgba(218, 30, 40, 0.48)";
          context.fillRect(left, top, tilemap.tileWidth, tilemap.tileHeight);
        }
      }
    }
  }

  private beginPaint(event: Konva.KonvaEventObject<PointerEvent>): void {
    event.evt.preventDefault();
    this.painting = true;
    this.lastPaintedCell = undefined;
    this.paintAtPointer(event.evt.button === 2);
  }

  private continuePaint(event: Konva.KonvaEventObject<PointerEvent>): void {
    const cell = this.cellAtPointer();
    this.updateHover(cell);
    if (!this.painting) return;

    const rightButton = (event.evt.buttons & 2) === 2;
    this.paintCell(cell, rightButton);
  }

  private endPaint(): void {
    this.painting = false;
    this.lastPaintedCell = undefined;
  }

  private paintAtPointer(erase: boolean): void {
    this.paintCell(this.cellAtPointer(), erase);
  }

  private paintCell(cell: { x: number; y: number; index: number } | undefined, erase: boolean): void {
    if (!cell || !this.data || cell.index === this.lastPaintedCell) return;
    this.lastPaintedCell = cell.index;

    if (this.tool === "collision") {
      const collisionTiles = [...(this.data.tilemap.collisionTiles ?? Array.from({ length: this.data.tilemap.tiles.length }, () => false))];
      const nextValue = !erase;
      if (collisionTiles[cell.index] === nextValue) return;
      collisionTiles[cell.index] = nextValue;
      this.data.tilemap = { ...this.data.tilemap, collisionTiles };
    } else {
      const tile = erase ? -1 : this.selectedTile;
      if (this.data.tilemap.tiles[cell.index] === tile) return;
      const tiles = [...this.data.tilemap.tiles];
      tiles[cell.index] = tile;
      this.data.tilemap = { ...this.data.tilemap, tiles };
    }

    this.redrawMap();
    this.mapLayer?.batchDraw();
    this.emitChange();
  }

  private cellAtPointer(): { x: number; y: number; index: number } | undefined {
    if (!this.stage || !this.data) return undefined;
    const position = this.stage.getPointerPosition();
    if (!position) return undefined;

    const x = Math.floor(position.x / this.displayTileWidth());
    const y = Math.floor(position.y / this.displayTileHeight());
    if (x < 0 || y < 0 || x >= this.data.tilemap.width || y >= this.data.tilemap.height) return undefined;
    return { x, y, index: y * this.data.tilemap.width + x };
  }

  private updateHover(cell: { x: number; y: number } | undefined): void {
    if (!this.hoverCell) return;
    if (!cell) {
      this.hoverCell.hide();
    } else {
      this.hoverCell.position({ x: cell.x * this.displayTileWidth(), y: cell.y * this.displayTileHeight() });
      this.hoverCell.show();
    }
    this.overlayLayer?.batchDraw();
  }

  private selectTool(tool: "paint" | "collision"): void {
    this.tool = tool;
    this.syncControls();
  }

  private changeZoom(delta: number): void {
    const next = Math.max(minTileScale, Math.min(maxTileScale, this.tileScale + delta));
    if (next === this.tileScale) return;
    this.tileScale = next;
    this.destroyStage();
    this.mountStage();
    this.syncControls();
  }

  private updateDimensions(
    widthValue: string | number | undefined,
    heightValue: string | number | undefined,
    tileWidthValue: string | number | undefined,
    tileHeightValue: string | number | undefined,
  ): void {
    if (!this.data) return;
    const width = clampDimension(widthValue, this.data.tilemap.width);
    const height = clampDimension(heightValue, this.data.tilemap.height);
    const tileWidth = clampDimension(tileWidthValue, this.data.tilemap.tileWidth);
    const tileHeight = clampDimension(tileHeightValue, this.data.tilemap.tileHeight);
    if (
      width === this.data.tilemap.width &&
      height === this.data.tilemap.height &&
      tileWidth === this.data.tilemap.tileWidth &&
      tileHeight === this.data.tilemap.tileHeight
    )
      return;

    this.data.tilemap = {
      ...this.data.tilemap,
      width,
      height,
      tileWidth,
      tileHeight,
      tiles: resizeCells(this.data.tilemap.tiles, this.data.tilemap.width, this.data.tilemap.height, width, height, -1),
      collisionTiles: resizeCells(this.data.tilemap.collisionTiles ?? [], this.data.tilemap.width, this.data.tilemap.height, width, height, false),
    };
    this.emitChange();
    this.render();
  }

  private displayTileWidth(): number {
    return (this.data?.tilemap.tileWidth ?? 1) * this.tileScale;
  }

  private displayTileHeight(): number {
    return (this.data?.tilemap.tileHeight ?? 1) * this.tileScale;
  }

  private syncControls(): void {
    const data = this.data;
    if (!data) return;

    this.querySelectorAll<HTMLButtonElement>("[data-tilemap-tool]").forEach((button) => {
      const active = button.dataset.tilemapTool === this.tool;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.querySelectorAll<HTMLButtonElement>("[data-tilemap-tile]").forEach((button) => {
      const active = Number(button.dataset.tilemapTile) === this.selectedTile;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    this.querySelector<HTMLOutputElement>("[data-tilemap-zoom-output]")!.value = `${this.tileScale}×`;
    this.querySelector<HTMLElement>("[data-tilemap-selection]")!.textContent =
      this.selectedTile < 0 ? "Empty" : `Tile ${this.selectedTile}`;
    this.querySelector<HTMLElement>("[data-tilemap-editor-help]")!.textContent =
      this.tool === "collision"
        ? "Drag to mark solid cells. Right-click-drag clears collision."
        : "Drag to paint. Right-click-drag clears to an empty cell. Integer zoom keeps pixels sharp.";
  }

  private handleKeyboardShortcut(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === "p") this.selectTool("paint");
    if (event.key.toLowerCase() === "c") this.selectTool("collision");
    if (event.key === "+" || event.key === "=") this.changeZoom(1);
    if (event.key === "-") this.changeZoom(-1);
  }

  private emitChange(): void {
    if (!this.data) return;
    this.dispatchEvent(
      new CustomEvent<TilemapEditorChange>("tilemap-editor-change", {
        bubbles: true,
        detail: cloneTilemap(this.data.tilemap),
      }),
    );
  }

  private destroyStage(): void {
    this.stage?.destroy();
    this.stage = undefined;
    this.mapLayer = undefined;
    this.overlayLayer = undefined;
    this.mapImage = undefined;
    this.hoverCell = undefined;
    this.mapCanvas = undefined;
  }
}

function createFrameCanvases(sprite: SpriteAsset | undefined): HTMLCanvasElement[] {
  if (!sprite) return [];
  const palette = new Map(sprite.palette.map((entry) => [entry.index, entry.color]));

  return sprite.frames.map((frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const context = canvas.getContext("2d");
    if (!context) return canvas;

    const image = context.createImageData(sprite.width, sprite.height);
    frame.colorIndexes.forEach((colorIndex, pixelIndex) => {
      const offset = pixelIndex * 4;
      const color = palette.get(colorIndex) ?? 0;
      image.data[offset] = (color >> 16) & 0xff;
      image.data[offset + 1] = (color >> 8) & 0xff;
      image.data[offset + 2] = color & 0xff;
      image.data[offset + 3] = colorIndex === sprite.transparentIndex ? 0 : 255;
    });
    context.putImageData(image, 0, 0);
    return canvas;
  });
}

function resizeCells<T>(source: T[], oldWidth: number, oldHeight: number, width: number, height: number, fallback: T): T[] {
  return Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    return x < oldWidth && y < oldHeight ? (source[y * oldWidth + x] ?? fallback) : fallback;
  });
}

function clampDimension(value: string | number | undefined, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(1, Math.min(maxMapDimension, parsed)) : fallback;
}

function supportsCanvas(): boolean {
  return document.createElement("canvas").getContext("2d") !== null;
}

function cloneTilemap(tilemap: TilemapAsset): TilemapAsset {
  return {
    ...tilemap,
    tiles: [...tilemap.tiles],
    collisionTiles: tilemap.collisionTiles ? [...tilemap.collisionTiles] : undefined,
  };
}
