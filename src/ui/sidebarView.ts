import type { ProjectControls, Risc96Project, SerializedBlocks } from "../project/model.ts";
import { supportedImageAccept } from "../project/imageFormats.ts";
import type { DebugSnapshotView, WorkspaceTab } from "./appView.ts";
import { escapeAttr, escapeHtml } from "./html.ts";
import { renderSpritePreview } from "./spritePreview.ts";

export function renderModeSidebar(
  project: Risc96Project,
  activeTab: WorkspaceTab,
  selectedSpriteId: string,
  selectedTilemapId: string,
  debug: DebugSnapshotView,
): string {
  if (activeTab === "sprites")
    return renderAssetSidebar(project, selectedSpriteId, "Sprites", true);
  if (activeTab === "colliders") return renderAssetSidebar(project, selectedSpriteId, "Colliders");
  if (activeTab === "audio") return renderAudioSidebar(project);
  if (activeTab === "fonts") return renderFontSidebar(project);
  if (activeTab === "tilemaps") return renderTilemapSidebar(project, selectedTilemapId);
  if (activeTab === "game") return renderDebugSidebar(project, debug);
  if (activeTab === "generated") return renderGeneratedSidebar(project);
  return renderCodeSidebar(project);
}

export function renderControlMappings(controls: ProjectControls): string {
  return controls.players
    .map(
      (player) => `
        <section class="player-map">
          <h4>Controller ${player.player}</h4>
          ${player.bindings
            .map(
              (binding) => `
                <div class="binding-row">
                  <span>${binding.control}</span>
                  <code>${escapeHtml(binding.input.label)}</code>
                  <cds-button size="sm" kind="ghost" data-map-control="${binding.control}" data-map-player="${player.player}">Map</cds-button>
                </div>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");
}

function renderFontSidebar(project: Risc96Project): string {
  return `
    <aside class="mode-sidebar">
      <p class="eyebrow">Fonts</p>
      <div class="sidebar-list">
        ${project.fonts.map((font) => `<div class="sidebar-item"><span>${escapeHtml(font.name)}</span><small>${font.glyphs.length} glyphs</small></div>`).join("") || "<p>No fonts yet.</p>"}
      </div>
    </aside>
  `;
}

function renderTilemapSidebar(project: Risc96Project, selectedTilemapId: string): string {
  return `
    <aside class="mode-sidebar">
      <p class="eyebrow">Tilemaps</p>
      <div class="tilemap-sidebar-imports">
        <cds-button size="sm" data-add-tilemap>Add tilemap</cds-button>
        <details class="upload-button tilemap-sidebar-import-menu">
          <summary>Import</summary>
          <label><input type="file" accept="image/*" data-import-tile-image hidden />Tile image</label>
          <label><input type="file" accept=".ase,.aseprite" data-import-tile-aseprite hidden />Aseprite tileset</label>
          <label><input type="file" accept="image/*,.json" data-import-tile-spritesheet multiple hidden />Spritesheet + JSON</label>
          <label><input type="file" accept=".json,application/json" data-import-tilemap hidden />Tilemap JSON</label>
        </details>
      </div>
      <div class="sidebar-list">
        ${
          project.tilemaps
            .map(
              (tilemap) => `
              <button class="sidebar-item ${tilemap.id === selectedTilemapId ? "active" : ""}" type="button" data-select-tilemap="${escapeAttr(tilemap.id)}">
                <span>${escapeHtml(tilemap.name)}</span>
                <small>${tilemap.width}x${tilemap.height}</small>
              </button>
            `,
            )
            .join("") || "<p>No tilemaps yet.</p>"
        }
      </div>
    </aside>
  `;
}

function renderAssetSidebar(
  project: Risc96Project,
  selectedSpriteId: string,
  label: string,
  showSpriteImport = false,
): string {
  const selectedSprite =
    project.sprites.find((sprite) => sprite.id === selectedSpriteId) ?? project.sprites[0];

  return `
    <aside class="mode-sidebar sprite-mode-sidebar">
      <p class="eyebrow">${label}</p>
      ${showSpriteImport ? renderSpriteImportControls() : ""}
      <div class="sidebar-list">
        ${
          project.sprites
            .map(
              (sprite) => `
              <button class="sidebar-item sprite-sidebar-item ${sprite.id === selectedSpriteId ? "active" : ""}" type="button" data-select-sprite="${escapeAttr(sprite.id)}">
                ${renderSpritePreview(sprite, sprite.frames[0], "sprite-sidebar-preview")}
                <span>${escapeHtml(sprite.name)}</span>
                <small>${sprite.width}x${sprite.height}, ${sprite.frames.length} frame${sprite.frames.length === 1 ? "" : "s"}</small>
              </button>
            `,
            )
            .join("") || "<p>No sprites yet.</p>"
        }
      </div>
      ${showSpriteImport && selectedSprite ? renderSpriteInspector(selectedSprite) : ""}
    </aside>
  `;
}

function renderSpriteInspector(sprite: Risc96Project["sprites"][number]): string {
  return `
    <section class="sprite-sidebar-inspector" aria-label="Selected sprite settings">
      <div>
        <p class="eyebrow">Selected sprite</p>
        <h3>${escapeHtml(sprite.name)}</h3>
      </div>
      <label class="sprite-sidebar-field">
        <span>Name</span>
        <input type="text" value="${escapeAttr(sprite.name)}" data-sprite-name="${escapeAttr(sprite.id)}" />
      </label>
      <div class="sprite-sidebar-size-fields">
        <label class="sprite-sidebar-field">
          <span>Width</span>
          <input type="number" min="1" value="${sprite.width}" data-sprite-size="width" data-sprite-size-id="${escapeAttr(sprite.id)}" />
        </label>
        <label class="sprite-sidebar-field">
          <span>Height</span>
          <input type="number" min="1" value="${sprite.height}" data-sprite-size="height" data-sprite-size-id="${escapeAttr(sprite.id)}" />
        </label>
      </div>
      <p class="sprite-sidebar-meta">${sprite.frames.length} frame${sprite.frames.length === 1 ? "" : "s"}</p>
      <button class="sprite-delete-button" type="button" data-delete-sprite="${escapeAttr(sprite.id)}">Delete sprite</button>
    </section>
  `;
}

function renderSpriteImportControls(): string {
  return `
    <div class="sprite-sidebar-imports">
      <label class="import-sprite-label">
        <span>Import sprite</span>
        <select data-import-sprite>
          <option value="">Choose source</option>
          <option value="image">Plain image</option>
          <option value="spritesheet">Spritesheet (Pixelorama)</option>
          <option value="aseprite">Aseprite</option>
        </select>
      </label>
      <input type="file" accept="${supportedImageAccept}" data-import-image hidden />
      <input type="file" accept=".ase,.aseprite" data-import-aseprite hidden />
      <input type="file" accept="${supportedImageAccept},.json" data-import-spritesheet multiple hidden />
    </div>
  `;
}

function renderAudioSidebar(project: Risc96Project): string {
  return `
    <aside class="mode-sidebar">
      <p class="eyebrow">Audio</p>
      <div class="sidebar-list">
        ${
          project.sounds
            .map(
              (sound) => `
              <button class="sidebar-item" type="button">
                <span>${escapeHtml(sound.name)}</span>
                <small>${escapeHtml(sound.format)}</small>
              </button>
            `,
            )
            .join("") || "<p>No sounds yet.</p>"
        }
      </div>
    </aside>
  `;
}

function renderCodeSidebar(project: Risc96Project): string {
  const script =
    project.scripts.find((candidate) => candidate.target === "stage") ?? project.scripts[0];
  return `
    <aside class="mode-sidebar">
      <p class="eyebrow">Code Graph</p>
      ${script ? renderScriptGraph(script) : ""}
    </aside>
  `;
}

function renderScriptGraph(script: Risc96Project["scripts"][number]): string {
  return `
    <section class="code-graph">
      <h3>Game</h3>
      ${renderCommandGroup("Start", script.blocks.start)}
      ${renderCommandGroup("Update", script.blocks.update)}
      ${renderCommandGroup("Draw", script.blocks.draw ?? [])}
      ${renderProcedures(script.blocks.procedures ?? [])}
    </section>
  `;
}

function renderCommandGroup(label: string, commands: { kind: string }[]): string {
  return `
    <button class="sidebar-item" type="button" data-code-section="${label.toLowerCase()}">
      <span>${label}</span>
      <small>${commands.length} block${commands.length === 1 ? "" : "s"}</small>
    </button>
    <div class="graph-nodes">
      ${commands.map((command) => `<span>${escapeHtml(command.kind)}</span>`).join("") || "<span>empty</span>"}
    </div>
  `;
}

function renderProcedures(procedures: NonNullable<SerializedBlocks["procedures"]>): string {
  return `
    <button class="sidebar-item" type="button" data-code-section="procedures">
      <span>Procedures</span>
      <small>${procedures.length} procedure${procedures.length === 1 ? "" : "s"}</small>
    </button>
    <div class="graph-nodes">
      ${procedures.map((procedure) => `<button class="graph-node-button" type="button" data-code-procedure="${escapeAttr(procedure.name)}">${escapeHtml(procedure.name)}</button>`).join("") || "<span>empty</span>"}
    </div>
  `;
}

function renderDebugSidebar(project: Risc96Project, debug: DebugSnapshotView): string {
  const registers = debug.registers ?? [
    { name: "x0", value: "0x00000000" },
    { name: "ra", value: "unavailable" },
    { name: "sp", value: "unavailable" },
    { name: "a0", value: "unavailable" },
  ];

  return `
    <aside class="mode-sidebar debug-sidebar">
      <p class="eyebrow">Debug</p>
      <dl>
        <dt>State</dt><dd>${debug.state}</dd>
        <dt>Program counter</dt><dd>${debug.pc ?? "not sampled"}</dd>
        <dt>Resolution</dt><dd>${project.settings.width}x${project.settings.height}</dd>
      </dl>
      <h3>Registers</h3>
      <div class="register-grid">
        ${registers.map((register) => `<code>${register.name}</code><span>${register.value}</span>`).join("")}
      </div>
    </aside>
  `;
}

function renderGeneratedSidebar(project: Risc96Project): string {
  return `
    <aside class="mode-sidebar">
      <p class="eyebrow">Output</p>
      <div class="sidebar-list">
        <a class="sidebar-item" href="#generated-c"><span>Generated C</span><small>${project.scripts.length} script(s)</small></a>
        <a class="sidebar-item" href="#generated-assets"><span>Assets Header</span><small>${project.sprites.length + project.sounds.length + project.fonts.length + project.tilemaps.length} asset(s)</small></a>
        <a class="sidebar-item" href="#machine-code"><span>Machine Code</span><small>ELF bytes</small></a>
      </div>
    </aside>
  `;
}
