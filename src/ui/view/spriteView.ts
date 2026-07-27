import type { Risc96Project, SpriteAsset } from "../../project/model.ts";
import { escapeAttr } from "../html.ts";

export function renderSpritesTab(
  project: Risc96Project,
  selectedSpriteId: string,
  selectedFrameId = "",
): string {
  const selectedSprite =
    project.sprites.find((sprite) => sprite.id === selectedSpriteId) ?? project.sprites[0];

  return `
    <section class="sprite-workspace">
      ${selectedSprite ? renderSpriteEditor(selectedSprite, selectedFrameId) : "<p>No sprites yet. Import a spritesheet or Aseprite file.</p>"}
    </section>
  `;
}

function renderSpriteEditor(sprite: SpriteAsset, _selectedFrameId: string): string {
  return `<scratch96-piskel-editor data-sprite-id="${escapeAttr(sprite.id)}" aria-label="${escapeAttr(sprite.name)} sprite editor"></scratch96-piskel-editor>`;
}
