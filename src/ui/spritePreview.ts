import type { SpriteAsset } from "../project/model.ts";
import { escapeAttr, escapeHtml, sourceDataUrl } from "./html.ts";

const maxInlinePreviewPixels = 256;

export function renderSpritePreview(
  sprite: SpriteAsset,
  frame: SpriteAsset["frames"][number] | undefined = sprite.frames[0],
  className = "sprite-preview-thumb",
): string {
  const width = Math.max(1, Math.floor(sprite.width));
  const height = Math.max(1, Math.floor(sprite.height));
  const label = `${sprite.name} preview`;

  if (frame?.source) {
    return `
      <div class="${escapeAttr(className)}" aria-label="${escapeAttr(label)}">
        <img src="${sourceDataUrl(frame.source)}" alt="${escapeAttr(label)}" />
      </div>
    `;
  }

  if (!frame || width * height > maxInlinePreviewPixels) {
    return `<div class="${escapeAttr(className)} sprite-preview-fallback" aria-label="${escapeAttr(label)}">${escapeHtml(`${width}x${height}`)}</div>`;
  }

  const palette = new Map(sprite.palette.map((entry) => [entry.index, entry.color]));
  const pixels = frame.colorIndexes
    .slice(0, width * height)
    .map(
      (index) =>
        `<span style="background:${index === sprite.transparentIndex ? "transparent" : colorHex(palette.get(index) ?? 0)}"></span>`,
    )
    .join("");

  return `
    <div class="${escapeAttr(className)} sprite-preview-indexed" style="--preview-columns:${width}" aria-label="${escapeAttr(label)}">
      ${pixels}
    </div>
  `;
}

function colorHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}
