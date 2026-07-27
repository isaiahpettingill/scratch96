import type { ProjectControls, Risc96Project } from "../project/model.ts";
import { escapeHtml } from "./html.ts";
import { renderModeSidebar } from "./sidebarView.ts";

export type AssetTab = "code" | "preview";
export type WorkspaceTab =
  | "code"
  | "game"
  | "sprites"
  | "colliders"
  | "audio"
  | "fonts"
  | "tilemaps"
  | "generated";

export type AssetCompilePreview = {
  source?: string;
  assetsHeader: string;
  diagnostics?: string[];
};

export type DebugSnapshotView = {
  pc?: string;
  registers?: { name: string; value: string }[];
  state: "idle" | "running" | "stopped";
};

export { escapeHtml };

export function renderWorkspaceFrame(options: {
  project: Risc96Project;
  activeTab: WorkspaceTab;
  selectedSpriteId: string;
  selectedTilemapId: string;
  debug: DebugSnapshotView;
  content: string;
}): string {
  return `
    <section class="workspace-frame">
      ${renderModeSidebar(options.project, options.activeTab, options.selectedSpriteId, options.selectedTilemapId, options.debug)}
      <div class="workspace-main">${options.content}</div>
    </section>
  `;
}

export type { ProjectControls };
