import type { Risc96Project, SpriteAsset } from "../../project/model.ts";
import { escapeAttr, escapeHtml } from "../html.ts";
import { renderSpritePreview } from "../spritePreview.ts";

export function renderCollidersTab(
  project: Risc96Project,
  selectedSpriteId: string,
  selectedFrameId = "",
): string {
  const selectedSprite =
    project.sprites.find((sprite) => sprite.id === selectedSpriteId) ?? project.sprites[0];

  return `
    <section class="assets-layout">
      <section class="panel asset-editor collider-asset-editor">
        <div class="panel-heading">
          <div><p class="eyebrow">Colliders</p><h2>Sprite Collision</h2></div>
        </div>
        ${selectedSprite ? renderColliderEditor(selectedSprite, selectedFrameId) : "<p>No sprites yet. Add a sprite before editing colliders.</p>"}
      </section>
    </section>
  `;
}

function renderColliderEditor(sprite: SpriteAsset, selectedFrameId: string): string {
  const selectedFrame =
    sprite.frames.find((frame) => frame.id === selectedFrameId) ?? sprite.frames[0];
  const zoom = colliderPixelZoom(sprite.width, sprite.height);

  return `
    <div class="collider-editor-shell" style="--collider-width:${sprite.width};--collider-height:${sprite.height};--collider-zoom:${zoom}px">
      <aside class="frame-timeline" aria-label="Animation frames">
        <h3>${escapeHtml(sprite.name)} Frames</h3>
        ${sprite.frames.map((candidate, index) => renderFrameButton(sprite, candidate, index, candidate.id === selectedFrame?.id)).join("")}
      </aside>
      <section class="collider-overlay-card">
        <header class="collider-overlay-heading">
          <div>
            <p class="eyebrow">Overlay</p>
            <h3>${escapeHtml(sprite.name)}</h3>
          </div>
          <p class="settings-help">Drag to move · Drag the corner to resize</p>
        </header>
        <div class="collider-stage-wrap">
          <div class="collider-stage" style="aspect-ratio:${sprite.width} / ${sprite.height}" data-collider-stage data-sprite-id="${escapeAttr(sprite.id)}">
            ${renderSpritePreview(sprite, selectedFrame, "collider-sprite-layer")}
            ${sprite.colliders.map((collider) => renderColliderBox(sprite, collider)).join("")}
          </div>
        </div>
      </section>
      <aside class="collider-fields-panel">
        <div>
          <p class="eyebrow">Rectangles</p>
          <h3>Hit Boxes</h3>
        </div>
        ${sprite.colliders.map((collider) => renderColliderFields(sprite, collider)).join("") || "<p>No colliders on this sprite.</p>"}
      </aside>
    </div>
  `;
}

function renderFrameButton(
  sprite: SpriteAsset,
  frame: SpriteAsset["frames"][number],
  index: number,
  selected: boolean,
): string {
  return `
    <button type="button" class="frame-timeline-button ${selected ? "active" : ""}" data-select-sprite-frame="${escapeAttr(frame.id)}" aria-label="Frame ${index + 1}: ${escapeAttr(frame.name ?? frame.id)}">
      <span class="frame-index">${index + 1}</span>
      ${renderSpritePreview(sprite, frame, "frame-preview frame-preview-thumb")}
      <span>${escapeHtml(frame.name ?? frame.id)}</span>
    </button>
  `;
}

function renderColliderBox(
  sprite: SpriteAsset,
  collider: SpriteAsset["colliders"][number],
): string {
  const style = `left:${toPercent(collider.x, sprite.width)}%;top:${toPercent(collider.y, sprite.height)}%;width:${toPercent(collider.width, sprite.width)}%;height:${toPercent(collider.height, sprite.height)}%;`;
  return `
    <button type="button" class="collider-box" style="${style}" data-collider-box data-collider-sprite="${escapeAttr(sprite.id)}" data-collider-id="${escapeAttr(collider.id)}" aria-label="Move ${escapeAttr(collider.name)} collider">
      <span>${escapeHtml(collider.name)}</span>
      <i data-collider-handle="resize" aria-hidden="true"></i>
    </button>
  `;
}

function renderColliderFields(
  sprite: SpriteAsset,
  collider: SpriteAsset["colliders"][number],
): string {
  return `
    <section class="collider-field-card">
      <h4>${escapeHtml(collider.name)}</h4>
      <div class="collider-fields">
        ${renderColliderInput(sprite.id, collider.id, "x", collider.x)}
        ${renderColliderInput(sprite.id, collider.id, "y", collider.y)}
        ${renderColliderInput(sprite.id, collider.id, "width", collider.width)}
        ${renderColliderInput(sprite.id, collider.id, "height", collider.height)}
      </div>
    </section>
  `;
}

function renderColliderInput(
  spriteId: string,
  colliderId: string,
  field: string,
  value: number,
): string {
  return `<cds-text-input label="${field}" value="${value}" data-collider-field="${field}" data-collider-sprite="${escapeAttr(spriteId)}" data-collider-id="${escapeAttr(colliderId)}"></cds-text-input>`;
}

function toPercent(value: number, size: number): number {
  if (size <= 0) return 0;
  return Math.max(0, Math.min(100, (value / size) * 100));
}

function colliderPixelZoom(width: number, height: number): number {
  const largestSide = Math.max(1, width, height);
  if (largestSide <= 8) return 64;
  if (largestSide <= 16) return 32;
  if (largestSide <= 32) return 16;
  if (largestSide <= 64) return 8;
  return 4;
}
