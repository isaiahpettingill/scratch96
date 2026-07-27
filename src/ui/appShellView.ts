import type { Risc96Project } from "../project/model.ts";
import type { BuildPreferences } from "../platform/web/buildPreferenceStore.ts";
import type { AssetCompilePreview, DebugSnapshotView, WorkspaceTab } from "./appView.ts";
import { renderWorkspaceFrame } from "./appView.ts";
import { escapeHtml } from "./html.ts";
import { renderAudioTab } from "./view/audioView.ts";
import { renderCodeTab } from "./view/codeView.ts";
import { renderCollidersTab } from "./view/colliderView.ts";
import { renderFontsTab } from "./view/fontView.ts";
import { renderGameTab } from "./view/gameView.ts";
import { renderGeneratedTab } from "./view/generatedView.ts";
import { renderSettingsPane } from "./view/settingView.ts";
import { renderSpritesTab } from "./view/spriteView.ts";
import { renderTilemapsTab } from "./view/tilemapView.ts";

export function renderAppShell(options: {
  project: Risc96Project;
  activeTab: WorkspaceTab;
  selectedSpriteId: string;
  selectedSpriteFrameId: string;
  selectedTilemapId: string;
  debug: DebugSnapshotView;
  buildPreferences: BuildPreferences;
  settingsOpen: boolean;
  notice?: { tone: "info" | "error"; message: string };
  compiled: Required<AssetCompilePreview>;
  settingsIcon: string;
}): string {
  return `
    <main class="ide-shell">
      <header class="top-bar">
        <div class="brand-block">
          <strong class="product-name">scratch96</strong>
          <span class="project-title">${escapeHtml(options.project.metadata.name)}</span>
        </div>
        <nav class="main-tabs" aria-label="Workspace tabs">
          ${renderTabButton(options.activeTab, "code", "Code")}
          ${renderTabButton(options.activeTab, "game", "Gameplay")}
          ${renderTabButton(options.activeTab, "sprites", "Sprites")}
          ${renderTabButton(options.activeTab, "colliders", "Colliders")}
          ${renderTabButton(options.activeTab, "audio", "Audio")}
          ${renderTabButton(options.activeTab, "fonts", "Fonts")}
          ${renderTabButton(options.activeTab, "tilemaps", "Tilemaps")}
          ${renderTabButton(options.activeTab, "generated", "Generated")}
        </nav>
        <div class="top-actions">
          <cds-button size="sm" data-run-action>Run</cds-button>
          <cds-button size="sm" kind="danger" data-stop-action>Stop</cds-button>
          <cds-menu-button class="project-menu-button" size="sm" kind="secondary" label="Project" menu-alignment="bottom-end" menu-border menu-background-token="layer">
            <cds-menu>
              <cds-menu-item label="New project" data-new-action></cds-menu-item>
              <cds-menu-item label="Open project" data-open-action></cds-menu-item>
              <cds-menu-item label="Save project" data-save-action></cds-menu-item>
              <cds-menu-item label="Build ELF" data-build-action></cds-menu-item>
              <cds-menu-item label="Download cartridge" data-download-cartridge-action></cds-menu-item>
            </cds-menu>
          </cds-menu-button>
          <cds-icon-button kind="ghost" size="md" label="Settings" data-settings-action>${options.settingsIcon}</cds-icon-button>
          <input type="file" accept=".s96,.json,.scratch96.json" data-open-input hidden />
        </div>
      </header>
      <div class="app-notice" data-app-notice data-tone="${options.notice?.tone ?? "info"}" role="${options.notice?.tone === "error" ? "alert" : "status"}"${options.notice ? "" : " hidden"}>${options.notice ? escapeHtml(options.notice.message) : ""}</div>
      <section class="content-shell">
        ${renderWorkspaceFrame({
          project: options.project,
          activeTab: options.activeTab,
          selectedSpriteId: options.selectedSpriteId,
          selectedTilemapId: options.selectedTilemapId,
          debug: options.debug,
          content: renderActiveTab(
            options.project,
            options.activeTab,
            options.selectedSpriteId,
            options.selectedSpriteFrameId,
            options.selectedTilemapId,
            options.compiled,
          ),
        })}
        ${options.settingsOpen ? renderSettingsPane(options.project, options.buildPreferences) : ""}
      </section>
    </main>
  `;
}

function renderActiveTab(
  project: Risc96Project,
  activeTab: WorkspaceTab,
  selectedSpriteId: string,
  selectedSpriteFrameId: string,
  selectedTilemapId: string,
  compiled: Required<AssetCompilePreview>,
): string {
  if (activeTab === "game") return renderGameTab(project);
  if (activeTab === "sprites")
    return renderSpritesTab(project, selectedSpriteId, selectedSpriteFrameId);
  if (activeTab === "colliders")
    return renderCollidersTab(project, selectedSpriteId, selectedSpriteFrameId);
  if (activeTab === "audio") return renderAudioTab(project);
  if (activeTab === "fonts") return renderFontsTab(project);
  if (activeTab === "tilemaps") return renderTilemapsTab(project, selectedTilemapId);
  if (activeTab === "generated") return renderGeneratedTab(compiled);
  return renderCodeTab();
}

function renderTabButton(activeTab: WorkspaceTab, tab: WorkspaceTab, label: string): string {
  return `<button class="tab-button ${activeTab === tab ? "active" : ""}" data-tab="${tab}" type="button">${label}</button>`;
}
