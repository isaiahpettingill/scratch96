import type { BuildPreferences } from "../../platform/web/buildPreferenceStore.ts";
import type { Risc96Project } from "../../project/model.ts";
import { escapeAttr } from "../html.ts";
import { renderControlMappings } from "../sidebarView.ts";

export function renderSettingsPane(project: Risc96Project, buildPreferences: BuildPreferences): string {
  return `
    <aside class="settings-pane" aria-label="Settings pane">
      <div class="panel-heading"><div><p class="eyebrow">Settings</p><h2>Cart and Controls</h2></div></div>
      <cds-tile>
        <h3>Cart</h3>
        <cds-text-input label="Title" value="${escapeAttr(project.metadata.name)}" data-project-title></cds-text-input>
        <cds-text-input label="Width" value="${project.settings.width}" data-setting-width></cds-text-input>
        <cds-text-input label="Height" value="${project.settings.height}" data-setting-height></cds-text-input>
      </cds-tile>
      <cds-tile>
        <h3>Controller Mapping</h3>
        <p class="settings-help">Click Map, then press a keyboard key, mouse button, or gamepad button/axis.</p>
        <div class="control-map">${renderControlMappings(project.controls)}</div>
      </cds-tile>
      <details class="advanced-settings">
        <summary>Advanced</summary>
        <p class="settings-help">Experimental build options are stored on this device, not in .s96 files.</p>
        <label class="settings-option">
          <input type="checkbox" data-setting-cproc-compiler ${buildPreferences.compiler === "cproc" ? "checked" : ""} />
          <span>Try cproc optimizing compiler</span>
        </label>
        <p class="settings-help">Falls back to TinyCC automatically if cproc is unavailable or fails.</p>
      </details>
    </aside>
  `;
}
