import type { Risc96Project } from "../../project/model.ts";

export function renderGameTab(project: Risc96Project): string {
  return `
    <section class="game-layout">
      <section class="panel stage-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Gameplay</p><h2>Risc96 Preview</h2></div>
          <p>${project.settings.width}x${project.settings.height} at ${project.settings.fps} FPS</p>
        </div>
        <div class="stage-screen" data-stage-screen>Risc96 WASM preview</div>
      </section>
    </section>
  `;
}
