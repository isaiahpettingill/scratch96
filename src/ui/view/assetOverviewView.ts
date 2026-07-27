import type { Risc96Project, SpriteAsset } from "../../project/model.ts";
import type { AssetCompilePreview, AssetTab } from "../appView.ts";
import { escapeHtml } from "../html.ts";
import { renderSoundCard, renderSpriteCard, renderSpriteFrameList } from "./assetCard.ts";

export function renderAssetsTab(
  project: Risc96Project,
  activeAssetTab: AssetTab,
  compiled: AssetCompilePreview,
  selectedSpriteId: string,
): string {
  const selectedSprite = project.sprites.find((sprite) => sprite.id === selectedSpriteId) ?? project.sprites[0];

  return `
    <section class="assets-layout">
      <section class="panel asset-editor">
        <div class="panel-heading">
          <div><p class="eyebrow">Assets</p><h2>Project Assets</h2></div>
          <div class="segmented-tabs" aria-label="Asset editor tabs">
            ${renderAssetTabButton(activeAssetTab, "preview", "Preview")}
            ${renderAssetTabButton(activeAssetTab, "code", "Code")}
          </div>
        </div>
        ${activeAssetTab === "code" ? renderAssetCode(compiled) : renderAssetPreview(project, selectedSprite)}
      </section>
    </section>
  `;
}

function renderAssetTabButton(activeAssetTab: AssetTab, tab: AssetTab, label: string): string {
  return `<button class="tab-button small ${activeAssetTab === tab ? "active" : ""}" data-asset-tab="${tab}" type="button">${label}</button>`;
}

function renderAssetPreview(project: Risc96Project, selectedSprite?: SpriteAsset): string {
  return `
    <div class="asset-columns">
      <section>
        <div class="asset-toolbar">
          <h3>Sprites</h3>
          <label class="upload-button"><input type="file" accept="image/*" data-upload-sprite hidden />Upload sprite</label>
        </div>
        <div class="asset-list">${project.sprites.map(renderSpriteCard).join("")}</div>
      </section>
      <section>
        <div class="asset-toolbar">
          <h3>${selectedSprite ? `${escapeHtml(selectedSprite.name)} Frames` : "Frames"}</h3>
          <cds-button size="sm" kind="secondary" disabled>Add frame</cds-button>
        </div>
        <div class="frame-list">${selectedSprite ? renderSpriteFrameList(selectedSprite) : "<p>No sprite selected.</p>"}</div>
      </section>
      <section>
        <div class="asset-toolbar">
          <h3>Sounds</h3>
          <label class="upload-button"><input type="file" accept="audio/*" data-upload-sound hidden />Upload sound</label>
        </div>
        <div class="asset-list">${project.sounds.map(renderSoundCard).join("")}</div>
      </section>
    </div>
  `;
}

function renderAssetCode(compiled: AssetCompilePreview): string {
  return `
    <section class="generated-grid one-column">
      <article><h3>Asset Header Preview</h3><pre class="generated-assets">${escapeHtml(compiled.assetsHeader)}</pre></article>
    </section>
  `;
}
