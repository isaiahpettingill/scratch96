import type { Risc96Project } from "../../project/model.ts";
import { renderFontCard } from "./assetCard.ts";

export function renderFontsTab(project: Risc96Project): string {
  return `
    <section class="assets-layout">
      <section class="panel asset-editor">
        <div class="panel-heading">
          <div><p class="eyebrow">Fonts</p><h2>Bitmap Fonts</h2></div>
          <label class="upload-button"><input type="file" accept=".bdf,.yaff" data-upload-font hidden />Upload Font</label>
        </div>
        <div class="asset-list">${project.fonts.map(renderFontCard).join("") || "<p>No fonts yet. Upload a .bdf or .yaff bitmap font.</p>"}</div>
      </section>
    </section>
  `;
}
