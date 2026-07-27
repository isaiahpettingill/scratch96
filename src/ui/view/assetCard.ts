import type { FontAsset, SoundAsset, SpriteAsset } from "../../project/model.ts";
import { escapeAttr, escapeHtml, sourceDataUrl } from "../html.ts";

export function renderSpriteCard(sprite: SpriteAsset): string {
  return `
    <cds-tile class="asset-card">
      <div class="asset-card-header"><strong>${escapeHtml(sprite.name)}</strong><span>${sprite.width}x${sprite.height}</span></div>
      <cds-text-input label="Name" value="${escapeAttr(sprite.name)}" data-sprite-name="${escapeAttr(sprite.id)}"></cds-text-input>
      <p>${sprite.source ? escapeHtml(sprite.source.filename) : "Built-in indexed sprite"}</p>
    </cds-tile>
  `;
}

export function renderSpriteFrameList(sprite: SpriteAsset): string {
  return sprite.frames.map((frame, index) => renderSpriteFrameCard(sprite, frame, index)).join("");
}

export function renderSpriteFrameCard(sprite: SpriteAsset, frame: SpriteAsset["frames"][number], index: number): string {
  const image = frame.source ? `<img src="${sourceDataUrl(frame.source)}" alt="${escapeAttr(frame.name ?? frame.id)}" />` : "";

  return `
    <cds-tile class="frame-card">
      <div class="frame-preview" aria-label="Frame ${index + 1} preview">${image}</div>
      <div><strong>${escapeHtml(frame.name ?? frame.id)}</strong><p>${sprite.width}x${sprite.height}, ${frame.colorIndexes.length} pixels</p></div>
    </cds-tile>
  `;
}

export function renderSoundCard(sound: SoundAsset): string {
  return `
    <cds-tile class="asset-card">
      <div class="asset-card-header"><strong>${escapeHtml(sound.name)}</strong><span>${escapeHtml(sound.format)}</span></div>
      <cds-text-input label="Name" value="${escapeAttr(sound.name)}" data-sound-name="${escapeAttr(sound.id)}"></cds-text-input>
      <p>${sound.source ? escapeHtml(sound.source.filename) : "Built-in tone sequence"}</p>
    </cds-tile>
  `;
}

export function renderFontCard(font: FontAsset): string {
  return `
    <cds-tile class="asset-card">
      <div class="asset-card-header"><strong>${escapeHtml(font.name)}</strong><span>${font.glyphs.length} glyphs</span></div>
      <p>${font.source ? escapeHtml(font.source.filename) : "Built-in BDF font"}, line height ${font.lineHeight}</p>
      <cds-button size="sm" kind="danger--ghost" data-delete-font="${escapeAttr(font.id)}">Delete</cds-button>
    </cds-tile>
  `;
}
