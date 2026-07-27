import type { Risc96Project, TilemapAsset } from "../../project/model.ts";
import { escapeAttr } from "../html.ts";

export function renderTilemapsTab(project: Risc96Project, selectedTilemapId: string): string {
  const tilemap = project.tilemaps.find((candidate) => candidate.id === selectedTilemapId) ?? project.tilemaps[0];

  return `
    <section class="tilemap-workspace">
      ${tilemap ? renderTilemapEditor(project, tilemap) : "<p>No tilemaps yet. Add one or import a tileset to start building maps with sprite-frame tiles.</p>"}
    </section>
  `;
}

function renderTilemapEditor(project: Risc96Project, tilemap: TilemapAsset): string {
  return `
    ${project.sprites.length > 0 ? `<scratch96-tilemap-editor data-tilemap-id="${escapeAttr(tilemap.id)}"></scratch96-tilemap-editor>` : "<p>Import a sprite to use its frames as tiles.</p>"}
  `;
}
