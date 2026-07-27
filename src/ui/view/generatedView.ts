import type { AssetCompilePreview } from "../appView.ts";
import { escapeHtml } from "../html.ts";

export function renderGeneratedTab(compiled: Required<AssetCompilePreview>): string {
  return `
    <section class="generated-layout">
      <section class="panel generated-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Generated</p><h2>Cartridge Output</h2></div>
          <p>Compiler output for advanced inspection.</p>
        </div>
        <section class="generated-grid">
          <article id="generated-c"><h3>Generated C</h3><pre class="generated-code">${escapeHtml(compiled.source)}</pre></article>
          <article id="generated-assets"><h3>Generated Assets</h3><pre class="generated-assets">${escapeHtml(compiled.assetsHeader)}</pre></article>
          <article id="machine-code"><h3>Machine Code</h3><pre data-machine-code>Build ELF to inspect cartridge bytes.</pre></article>
          <article><h3>Diagnostics</h3><pre>${escapeHtml(compiled.diagnostics.length === 0 ? "No diagnostics." : compiled.diagnostics.join("\n"))}</pre></article>
        </section>
      </section>
    </section>
  `;
}
