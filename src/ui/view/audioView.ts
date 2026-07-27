import type { Risc96Project, SoundAsset, ToneSequenceSoundAsset } from "../../project/model.ts";
import { renderSoundCard } from "./assetCard.ts";
import { escapeAttr, escapeHtml } from "../html.ts";

export function renderAudioTab(project: Risc96Project): string {
  return `
    <section class="assets-layout">
      <section class="panel asset-editor">
        <div class="panel-heading">
          <div><p class="eyebrow">Audio</p><h2>Audio Assets</h2></div>
          <div class="asset-actions">
            <button class="upload-button" type="button" data-add-tone-sound>Add tone sequence</button>
            <label class="upload-button"><input type="file" accept="audio/*" data-upload-sound hidden />Upload sound</label>
          </div>
        </div>
        <div class="asset-list audio-list">${project.sounds.map(renderAudioAsset).join("") || "<p>No sounds yet.</p>"}</div>
      </section>
    </section>
  `;
}

function renderAudioAsset(sound: SoundAsset): string {
  if (sound.format === "tone_sequence") return renderToneMixer(sound);
  return renderSoundCard(sound);
}

function renderToneMixer(sound: ToneSequenceSoundAsset): string {
  const totalMs = sound.notes.reduce((sum, note) => sum + note.ms, 0);

  return `
    <cds-tile class="asset-card tone-mixer">
      <div class="asset-card-header">
        <strong>${escapeHtml(sound.name)}</strong>
        <span>${sound.notes.length} steps, ${totalMs} ms</span>
      </div>
      <cds-text-input label="Name" value="${escapeAttr(sound.name)}" data-sound-name="${escapeAttr(sound.id)}"></cds-text-input>
      <div class="tone-step-grid">
        <div class="tone-step tone-step-header"><span>Step</span><span>Pitch Hz</span><span>Length ms</span><span></span></div>
        ${sound.notes.map((note, index) => renderToneStep(sound.id, index, note.freq, note.ms)).join("")}
      </div>
      <div class="asset-actions">
        <button class="upload-button" type="button" data-add-tone-note="${escapeAttr(sound.id)}">Add step</button>
      </div>
    </cds-tile>
  `;
}

function renderToneStep(soundId: string, index: number, freq: number, ms: number): string {
  return `
    <div class="tone-step">
      <span class="tone-step-index">${String(index).padStart(2, "0")}</span>
      <cds-text-input label="freq" hide-label value="${freq}" data-tone-note-field="freq" data-tone-sound="${escapeAttr(soundId)}" data-tone-note="${index}"></cds-text-input>
      <cds-text-input label="ms" hide-label value="${ms}" data-tone-note-field="ms" data-tone-sound="${escapeAttr(soundId)}" data-tone-note="${index}"></cds-text-input>
      <button class="tone-remove" type="button" data-remove-tone-note="${index}" data-tone-sound="${escapeAttr(soundId)}" aria-label="remove tone step ${index}">x</button>
    </div>
  `;
}
