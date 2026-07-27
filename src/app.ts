import Settings20 from "@carbon/icons/es/settings/20.js";
import "@carbon/web-components/es/components/button/index.js";
import "@carbon/web-components/es/components/icon-button/index.js";
import "@carbon/web-components/es/components/menu-button/index.js";
import "@carbon/web-components/es/components/select/index.js";
import "@carbon/web-components/es/components/text-input/index.js";
import "@carbon/web-components/es/components/tile/index.js";
import type * as Blockly from "blockly/core";

import { compileProjectToC } from "./compiler/emitC.ts";
import { loadBuildPreferences, saveBuildPreferences } from "./platform/web/buildPreferenceStore.ts";
import { createCartridgeElfFile, downloadFile } from "./platform/web/downloads.ts";
import {
  createProjectFile,
  isFilePickerCancellation,
  pickProjectFile,
  supportsProjectFileAccess,
  type ProjectFileHandle,
  writeProjectFile,
} from "./platform/web/projectFileAccess.ts";
import { loadProjectFile } from "./platform/web/projectFiles.ts";
import { createS96ProjectFile } from "./platform/web/s96Archive.ts";
import { loadStoredControls, saveStoredControls } from "./platform/web/controlMappingStore.ts";
import {
  addAsepriteFromFile,
  addDefaultTilemap,
  addFontFromFile,
  addSoundFromFile,
  addSpriteFrameFromFile,
  addSpriteFromFile,
  addSpritesheetFromFiles,
  addTilemapFromFile,
  addToneNote,
  addToneSequenceSound,
  deleteSprite,
  deleteFont,
  renameSound,
  renameSprite,
  renameTilemap,
  removeToneNote,
  resizeSprite,
  updateTilemapCollisionCell,
  updateTilemapCell,
  updateTilemapField,
  updateTilemapFromEditor,
  updateTilemapTileset,
  updateToneNoteField,
  updateSpriteCollider,
  updateSpriteFromEditor,
} from "./project/assetOperation.ts";
import { createDefaultControls } from "./project/controls.ts";
import { isSupportedImageFile } from "./project/imageFormats.ts";
import type { ControllerInput, Risc96Project } from "./project/model.ts";
import { parseProjectJson } from "./project/projectJson.ts";
import { sampleProject } from "./project/sampleProject.ts";
import { ensureSpriteScopedScripts } from "./project/scripts.ts";
import { updateProjectSettings } from "./project/settings.ts";
import { v0BlockTypes } from "./editor/blocks/v0BlockTypes.ts";
import { BrowserRisc96PreviewRuntime, BrowserTccWasmCompiler } from "./runtime/browserAdapters.ts";
import { BrowserCprocWasmCompiler } from "./runtime/browserCprocCompiler.ts";
import { buildCartridge } from "./runtime/buildPipeline.ts";
import { CprocFallbackCompiler } from "./runtime/compilerFallback.ts";
import { PreviewInputTracker } from "./runtime/previewInput.ts";
import { preloadWasmAssets } from "./runtime/wasmAssets.ts";
import { renderAppShell } from "./ui/appShellView.ts";
import { carbonIconSvg } from "./ui/carbonIcon.ts";
import { captureNextControlInput } from "./ui/controlInputCapture.ts";
import type { DebugSnapshotView, WorkspaceTab } from "./ui/appView.ts";
import {
  definePiskelEditorElement,
  type PiskelEditorChange,
  spriteToPiskelEditorData,
} from "./ui/piskelWebComponent.ts";
import {
  defineTilemapEditorElement,
  tilemapToEditorData,
  type TilemapEditorChange,
} from "./ui/tilemapEditorWebComponent.ts";

const tagName = "scratch96-app";
type AppTab = WorkspaceTab;
type BlocklyModule = typeof import("./editor/blocks/v0Block.ts") & {
  Blockly: typeof import("blockly/core");
};
type AppNotice = {
  tone: "info" | "error";
  message: string;
};

type PersistedAppState = {
  version: 1;
  project: Risc96Project;
  activeTab: AppTab;
  selectedSpriteId: string;
  selectedSpriteFrameId: string;
  selectedTilemapId: string;
  selectedTileIndexByTilemap: Record<string, number>;
  settingsOpen: boolean;
};

const appStateStorageKey = "scratch96.appState.v1";
const appTabs: AppTab[] = ["code", "game", "sprites", "colliders", "audio", "fonts", "tilemaps", "generated"];

export function defineScratch96Elements(): void {
  definePiskelEditorElement();
  defineTilemapEditorElement();
  if (!customElements.get(tagName)) {
    customElements.define(tagName, Scratch96App);
  }
}

export function createApp(): HTMLElement {
  defineScratch96Elements();
  return document.createElement(tagName);
}

class Scratch96App extends HTMLElement {
  private project: Risc96Project = ensureSpriteScopedScripts({
    ...structuredClone(sampleProject),
    controls: createDefaultControls(),
  });
  private buildPreferences = loadBuildPreferences();
  private readonly tccCompiler = new BrowserTccWasmCompiler();
  private readonly cprocCompiler = new BrowserCprocWasmCompiler();
  private readonly buildCompiler = new CprocFallbackCompiler(
    this.tccCompiler,
    this.cprocCompiler,
    () => this.buildPreferences.compiler === "cproc",
  );
  private previewRuntime?: BrowserRisc96PreviewRuntime;
  private blocklyWorkspace?: Blockly.WorkspaceSvg;
  private blocklyScriptId?: string;
  private blocklyModule?: BlocklyModule;
  private blocklyModulePromise?: Promise<BlocklyModule>;
  private activeTab: AppTab = "code";
  private selectedSpriteId = this.project.sprites[0]?.id ?? "";
  private selectedSpriteFrameId = this.project.sprites[0]?.frames[0]?.id ?? "";
  private selectedTilemapId = this.project.tilemaps[0]?.id ?? "";
  private selectedTileIndexByTilemap: Record<string, number> = {};
  private debugSnapshot: DebugSnapshotView = { state: "idle" };
  private settingsOpen = false;
  private projectFileHandle?: ProjectFileHandle;
  private notice?: AppNotice;
  private waitingForMapping?: { player: 1 | 2 | 3 | 4; control: string };
  private readonly handleGlobalKeyDown = (event: KeyboardEvent) => this.onGlobalKeyDown(event);
  private readonly previewInput = new PreviewInputTracker(
    () => this.project.controls,
    (playerIndex, state) => this.previewRuntime?.setControllerState(playerIndex, state),
  );
  private readonly persistAfterInteraction = (): void => {
    queueMicrotask(() => this.persistAppState());
  };
  private readonly persistBeforePageHide = (): void => {
    this.captureBlocklyState();
    this.persistAppState();
  };

  connectedCallback(): void {
    document.addEventListener("keydown", this.handleGlobalKeyDown);
    this.addEventListener("input", this.persistAfterInteraction);
    this.addEventListener("change", this.persistAfterInteraction);
    this.addEventListener("click", this.persistAfterInteraction);
    window.addEventListener("pagehide", this.persistBeforePageHide);
    const restored = this.restoreAppState();
    this.render();
    this.previewInput.start();
    void preloadWasmAssets().catch(() => {
      // Preload is an optimization; build/run paths report actionable load failures.
    });
    if (!restored) {
      void this.restoreDeviceControls();
    }
  }

  disconnectedCallback(): void {
    document.removeEventListener("keydown", this.handleGlobalKeyDown);
    this.removeEventListener("input", this.persistAfterInteraction);
    this.removeEventListener("change", this.persistAfterInteraction);
    this.removeEventListener("click", this.persistAfterInteraction);
    window.removeEventListener("pagehide", this.persistBeforePageHide);
    this.persistAppState();
    this.previewRuntime?.stop();
    this.blocklyWorkspace?.dispose();
    this.previewInput.stop();
  }

  private async restoreDeviceControls(): Promise<void> {
    const controls = await loadStoredControls();

    if (JSON.stringify(controls) === JSON.stringify(this.project.controls)) {
      return;
    }

    this.project = { ...this.project, controls };
    this.render();
  }

  private render(): void {
    this.captureBlocklyState();
    this.previewRuntime?.stop();
    this.blocklyWorkspace?.dispose();
    this.blocklyWorkspace = undefined;
    this.persistAppState();
    const compiled = compileProjectToC(this.project);

    this.innerHTML = renderAppShell({
      project: this.project,
      activeTab: this.activeTab,
      selectedSpriteId: this.selectedSpriteId,
      selectedSpriteFrameId: this.selectedSpriteFrameId,
      selectedTilemapId: this.selectedTilemapId,
      debug: this.debugSnapshot,
      buildPreferences: this.buildPreferences,
      settingsOpen: this.settingsOpen,
      notice: this.notice,
      compiled,
      settingsIcon: carbonIconSvg(Settings20),
    });

    this.hydrateGeneratedOutput(compiled.source, compiled.assetsHeader);
    this.bindCommonActions();
    this.bindTabActions();
    this.bindSettingsActions();
    this.bindAssetActions();
    this.mountPiskelEditorElements();
    this.mountTilemapEditorElements();
    this.mountActiveWorkspace();
    this.mountActivePreview();
  }

  private bindCommonActions(): void {
    this.querySelector("[data-build-action]")?.addEventListener(
      "click",
      () => void this.buildElf(),
    );
    this.querySelector("[data-download-cartridge-action]")?.addEventListener(
      "click",
      () => void this.downloadCartridge(),
    );
    this.querySelector("[data-run-action]")?.addEventListener(
      "click",
      () => void this.runProject(),
    );
    this.querySelector("[data-stop-action]")?.addEventListener("click", () => {
      this.previewRuntime?.stop();
      this.debugSnapshot = { ...this.debugSnapshot, state: "stopped" };
    });
    this.querySelector("[data-new-action]")?.addEventListener("click", () => this.createProject());
    this.querySelector("[data-open-action]")?.addEventListener("click", () =>
      void this.openProjectFromFileSystem(),
    );
    this.querySelector("[data-open-input]")?.addEventListener(
      "change",
      (event) => void this.openProjectFromInput(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-save-action]")?.addEventListener("click", () => void this.saveProject());
    this.querySelector("[data-settings-action]")?.addEventListener("click", () => {
      this.settingsOpen = !this.settingsOpen;
      this.render();
    });
  }

  private bindTabActions(): void {
    this.querySelectorAll<HTMLElement>("[data-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.activeTab = tab.dataset.tab as AppTab;
        this.render();
      });
    });
    this.querySelectorAll<HTMLElement>("[data-select-sprite]").forEach((sprite) => {
      sprite.addEventListener("click", () => {
        this.selectedSpriteId = sprite.dataset.selectSprite ?? this.selectedSpriteId;
        this.selectedSpriteFrameId =
          this.project.sprites.find((candidate) => candidate.id === this.selectedSpriteId)
            ?.frames[0]?.id ?? "";
        this.render();
      });
    });
    this.querySelectorAll<HTMLElement>("[data-select-tilemap]").forEach((tilemap) => {
      tilemap.addEventListener("click", () => {
        this.selectedTilemapId = tilemap.dataset.selectTilemap ?? this.selectedTilemapId;
        this.render();
      });
    });
    this.querySelectorAll<HTMLElement>("[data-code-section]").forEach((section) => {
      section.addEventListener("click", () => {
        this.navigateToCodeGraphTarget({ section: section.dataset.codeSection ?? "" });
      });
    });
    this.querySelectorAll<HTMLElement>("[data-code-procedure]").forEach((procedure) => {
      procedure.addEventListener("click", () => {
        this.navigateToCodeGraphTarget({ procedure: procedure.dataset.codeProcedure ?? "" });
      });
    });
  }

  private bindSettingsActions(): void {
    this.querySelector("[data-project-title]")?.addEventListener("input", (event) => {
      this.project = {
        ...this.project,
        metadata: { ...this.project.metadata, name: readStringValue(event.currentTarget) },
      };
    });
    this.querySelector("[data-setting-width]")?.addEventListener("input", (event) =>
      this.updateResolution({ width: readNumberValue(event.currentTarget) }),
    );
    this.querySelector("[data-setting-height]")?.addEventListener("input", (event) =>
      this.updateResolution({ height: readNumberValue(event.currentTarget) }),
    );
    this.querySelectorAll<HTMLElement>("[data-map-control]").forEach((button) => {
      button.addEventListener("click", () => this.startMapping(button));
    });
    this.querySelector<HTMLInputElement>("[data-setting-cproc-compiler]")?.addEventListener(
      "change",
      (event) => {
        this.buildPreferences = {
          ...this.buildPreferences,
          compiler: readCheckedValue(event.currentTarget) ? "cproc" : "tcc",
        };
        saveBuildPreferences(this.buildPreferences);
      },
    );
  }

  private bindAssetActions(): void {
    this.querySelector("[data-upload-sprite]")?.addEventListener(
      "change",
      (event) => void this.uploadSprite(event.currentTarget as HTMLInputElement),
    );
    this.querySelector<HTMLSelectElement>("[data-import-sprite]")?.addEventListener("change", (event) =>
      this.chooseSpriteImport(event.currentTarget as HTMLSelectElement),
    );
    this.querySelector("[data-import-image]")?.addEventListener(
      "change",
      (event) => void this.uploadSprite(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-import-aseprite]")?.addEventListener(
      "change",
      (event) => void this.importAseprite(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-import-spritesheet]")?.addEventListener(
      "change",
      (event) => void this.importSpritesheet(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-upload-sound]")?.addEventListener(
      "change",
      (event) => void this.uploadSound(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-add-tone-sound]")?.addEventListener("click", () => {
      this.project = addToneSequenceSound(this.project);
      this.render();
    });
    this.querySelector("[data-upload-font]")?.addEventListener(
      "change",
      (event) => void this.uploadFont(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-add-tilemap]")?.addEventListener("click", () => this.addTilemap());
    this.querySelector("[data-import-tilemap]")?.addEventListener(
      "change",
      (event) => void this.importTilemap(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-import-tile-image]")?.addEventListener(
      "change",
      (event) => void this.importTileImage(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-import-tile-aseprite]")?.addEventListener(
      "change",
      (event) => void this.importTileAseprite(event.currentTarget as HTMLInputElement),
    );
    this.querySelector("[data-import-tile-spritesheet]")?.addEventListener(
      "change",
      (event) => void this.importTileSpritesheet(event.currentTarget as HTMLInputElement),
    );
    this.querySelectorAll<HTMLInputElement>("[data-upload-sprite-frame]").forEach((input) => {
      input.addEventListener("change", () => void this.uploadSpriteFrame(input));
    });
    this.querySelectorAll<HTMLElement>("[data-sprite-name]").forEach((input) => {
      input.addEventListener("input", () =>
        this.renameSprite(input.dataset.spriteName ?? "", readStringValue(input)),
      );
    });
    this.querySelectorAll<HTMLElement>("[data-sprite-size]").forEach((input) => {
      input.addEventListener("change", () => this.resizeSprite(input));
    });
    this.querySelectorAll<HTMLElement>("[data-delete-sprite]").forEach((button) => {
      button.addEventListener("click", () => this.deleteSprite(button.dataset.deleteSprite ?? ""));
    });
    this.querySelectorAll<HTMLElement>("[data-delete-font]").forEach((button) => {
      button.addEventListener("click", () => this.deleteFont(button.dataset.deleteFont ?? ""));
    });
    this.querySelectorAll<HTMLElement>("[data-sound-name]").forEach((input) => {
      input.addEventListener("input", () =>
        this.renameSound(input.dataset.soundName ?? "", readStringValue(input)),
      );
    });
    this.querySelectorAll<HTMLElement>("[data-add-tone-note]").forEach((button) => {
      button.addEventListener("click", () => this.addToneNote(button.dataset.addToneNote ?? ""));
    });
    this.querySelectorAll<HTMLElement>("[data-remove-tone-note]").forEach((button) => {
      button.addEventListener("click", () => this.removeToneNote(button));
    });
    this.querySelectorAll<HTMLElement>("[data-tone-note-field]").forEach((input) => {
      input.addEventListener("input", () => this.updateToneNoteField(input));
    });
    this.querySelectorAll<HTMLElement>("[data-collider-field]").forEach((input) => {
      input.addEventListener("input", () => this.updateCollider(input));
    });
    this.querySelectorAll<HTMLElement>("[data-collider-box]").forEach((box) => {
      box.addEventListener("pointerdown", (event) =>
        this.startColliderOverlayEdit(event as PointerEvent, box),
      );
    });
    this.querySelectorAll<HTMLElement>("[data-select-sprite-frame]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedSpriteFrameId = button.dataset.selectSpriteFrame ?? this.selectedSpriteFrameId;
        this.render();
      });
    });
    this.querySelectorAll<HTMLElement>("[data-tilemap-name]").forEach((input) => {
      input.addEventListener("input", () =>
        this.renameTilemap(input.dataset.tilemapName ?? "", readStringValue(input)),
      );
    });
    this.querySelectorAll<HTMLElement>("[data-tilemap-field]").forEach((input) => {
      input.addEventListener("input", () => this.updateTilemapField(input));
    });
    this.querySelectorAll<HTMLElement>("[data-tilemap-tileset]").forEach((select) => {
      select.addEventListener("change", () => this.updateTilemapTileset(select));
    });
    this.querySelectorAll<HTMLElement>("[data-select-tile]").forEach((button) => {
      button.addEventListener("click", () => this.selectTile(button));
    });
    this.querySelectorAll<HTMLElement>("[data-tilemap-cell]").forEach((button) => {
      button.addEventListener("click", () => this.updateTilemapCell(button));
    });
    this.querySelectorAll<HTMLElement>("[data-tilemap-collision-cell]").forEach((button) => {
      button.addEventListener("click", () => this.updateTilemapCollisionCell(button));
    });
  }

  private chooseSpriteImport(select: HTMLSelectElement): void {
    const inputSelector =
      {
        image: "[data-import-image]",
        aseprite: "[data-import-aseprite]",
        spritesheet: "[data-import-spritesheet]",
      }[select.value] ?? "";
    select.value = "";
    if (!inputSelector) return;
    this.querySelector<HTMLInputElement>(inputSelector)?.click();
  }

  private mountActiveWorkspace(): void {
    const blocklyHost = this.querySelector<HTMLElement>("[data-blockly-workspace]");

    if (blocklyHost) {
      requestAnimationFrame(() => void this.mountBlockly(blocklyHost));
    }
  }

  private mountActivePreview(): void {
    const stageHost = this.querySelector<HTMLElement>("[data-stage-screen]");

    if (stageHost) {
      this.previewRuntime = new BrowserRisc96PreviewRuntime(stageHost);
    }
  }

  private mountPiskelEditorElements(): void {
    this.querySelectorAll<HTMLElement & { editorData?: unknown }>(
      "scratch96-piskel-editor[data-sprite-id]",
    ).forEach((editor) => {
      const sprite = this.project.sprites.find((candidate) => candidate.id === editor.dataset.spriteId);
      if (!sprite) return;

      editor.editorData = spriteToPiskelEditorData(sprite);
      editor.addEventListener("piskel-editor-change", (event) => {
        this.updateSpriteFromPiskelEditor((event as CustomEvent<PiskelEditorChange>).detail);
      });
    });
  }

  private updateSpriteFromPiskelEditor(update: PiskelEditorChange): void {
    if (!this.project.sprites.some((sprite) => sprite.id === update.spriteId)) return;

    this.project = updateSpriteFromEditor(this.project, update.spriteId, update);
    this.selectedSpriteFrameId =
      this.project.sprites
        .find((sprite) => sprite.id === update.spriteId)
        ?.frames.find((frame) => frame.id === this.selectedSpriteFrameId)?.id ??
      this.project.sprites.find((sprite) => sprite.id === update.spriteId)?.frames[0]?.id ??
      this.selectedSpriteFrameId;
    this.persistAppState();
  }

  private mountTilemapEditorElements(): void {
    this.querySelectorAll<HTMLElement & { editorData?: unknown }>(
      "scratch96-tilemap-editor[data-tilemap-id]",
    ).forEach((editor) => {
      const tilemap = this.project.tilemaps.find((candidate) => candidate.id === editor.dataset.tilemapId);
      if (!tilemap) return;

      editor.editorData = tilemapToEditorData(this.project, tilemap);
      editor.addEventListener("tilemap-editor-change", (event) => {
        this.updateTilemapFromExternalEditor(editor.dataset.tilemapId ?? "", (event as CustomEvent<TilemapEditorChange>).detail);
      });
    });
  }

  private updateTilemapFromExternalEditor(tilemapId: string, update: TilemapEditorChange): void {
    if (!this.project.tilemaps.some((tilemap) => tilemap.id === tilemapId)) return;

    this.project = updateTilemapFromEditor(this.project, tilemapId, update);
    this.persistAppState();
  }

  private onGlobalKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;

    const isModifierShortcut = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isModifierShortcut && key === "s") {
      event.preventDefault();
      void this.saveProject();
      return;
    }

    if (this.activeTab !== "sprites" || isEditableTarget(event.target)) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      this.selectRelativeSpriteFrame(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  private selectRelativeSpriteFrame(delta: number): void {
    const sprite = this.project.sprites.find((candidate) => candidate.id === this.selectedSpriteId);
    if (!sprite || sprite.frames.length === 0) return;

    const currentIndex = Math.max(
      0,
      sprite.frames.findIndex((frame) => frame.id === this.selectedSpriteFrameId),
    );
    const nextIndex = Math.max(0, Math.min(sprite.frames.length - 1, currentIndex + delta));
    this.selectedSpriteFrameId = sprite.frames[nextIndex]?.id ?? this.selectedSpriteFrameId;
    this.render();
  }

  private hydrateGeneratedOutput(source: string, assetsHeader: string): void {
    const generatedCode = this.querySelector<HTMLElement>(".generated-code");
    const generatedAssets = this.querySelector<HTMLElement>(".generated-assets");

    if (generatedCode) generatedCode.textContent = source;
    if (generatedAssets) generatedAssets.textContent = assetsHeader;
  }

  private gameScriptId(): string {
    return (
      this.project.scripts.find((script) => script.target === "stage")?.id ??
      this.project.scripts[0]?.id ??
      "stage-main"
    );
  }

  private async mountBlockly(blocklyHost: HTMLElement): Promise<void> {
    if (!this.isConnected || !this.contains(blocklyHost)) return;

    try {
      const blockly = await this.loadBlocklyModule();
      this.blocklyWorkspace = blockly.mountBlocklyWorkspace(
        blocklyHost,
        this.project,
        this.gameScriptId(),
      );
      this.blocklyScriptId = this.gameScriptId();
    } catch (error) {
      this.writeConsole(
        error instanceof Error ? error.message : "Blockly workspace failed to mount.",
      );
      return;
    }

    this.blocklyWorkspace?.addChangeListener(() => {
      this.captureBlocklyState();
      this.updateGeneratedOutput();
      this.persistAppState();
    });
  }

  private navigateToCodeGraphTarget(target: { section?: string; procedure?: string }): void {
    if (!this.blocklyWorkspace) {
      requestAnimationFrame(() => this.navigateToCodeGraphTarget(target));
      return;
    }

    const block = this.findCodeGraphBlock(target);
    if (!block) return;

    this.blocklyWorkspace.centerOnBlock(block.id);
    (block as Blockly.Block & { select?: () => void }).select?.();
    this.blocklyWorkspace.highlightBlock(block.id, true);
    window.setTimeout(() => this.blocklyWorkspace?.highlightBlock(block.id, false), 700);
  }

  private findCodeGraphBlock(target: { section?: string; procedure?: string }): Blockly.Block | undefined {
    const topBlocks = this.blocklyWorkspace?.getTopBlocks(false) ?? [];
    if (target.procedure !== undefined) {
      return topBlocks.find(
        (block) =>
          block.type === v0BlockTypes.defineProcedure &&
          String(block.getFieldValue("NAME") ?? "") === target.procedure,
      );
    }

    const typeBySection: Record<string, string> = {
      start: v0BlockTypes.setup,
      update: v0BlockTypes.updateLoop,
      draw: v0BlockTypes.drawLoop,
      procedures: v0BlockTypes.defineProcedure,
    };
    const blockType = typeBySection[target.section ?? ""];
    return topBlocks.find((block) => block.type === blockType);
  }

  private captureBlocklyState(): void {
    if (!this.blocklyWorkspace || !this.blocklyModule) return;

    const workspace = this.blocklyWorkspace as Blockly.WorkspaceSvg & {
      isDragging?: () => boolean;
    };

    if (workspace.isDragging?.()) return;

    const loweredBlocks = this.blocklyModule.lowerWorkspaceToBlocks(
      this.blocklyWorkspace as Blockly.Workspace,
    );
    const setupResolution = loweredBlocks.start.find((command) => command.kind === "setResolution");

    this.project = {
      ...this.project,
      settings: setupResolution
        ? { ...this.project.settings, width: setupResolution.width, height: setupResolution.height }
        : this.project.settings,
      scripts: this.project.scripts.map((script) =>
        script.id === this.blocklyScriptId
          ? {
              ...script,
              blocks: loweredBlocks,
              workspace: this.blocklyModule?.Blockly.serialization.workspaces.save(
                this.blocklyWorkspace as Blockly.Workspace,
              ),
            }
          : script,
      ),
    };
  }

  private async loadBlocklyModule(): Promise<BlocklyModule> {
    this.blocklyModulePromise ??= Promise.all([
      import("./editor/blocks/v0Block.ts"),
      import("blockly/core"),
    ]).then(([blocks, BlocklyCore]) => ({ ...blocks, Blockly: BlocklyCore }));
    this.blocklyModule = await this.blocklyModulePromise;
    return this.blocklyModule;
  }

  private restoreAppState(): boolean {
    const stored = getAppStateStorage()?.getItem(appStateStorageKey);
    if (!stored) return false;

    try {
      const parsed = JSON.parse(stored) as Partial<PersistedAppState>;
      if (parsed.version !== 1 || !parsed.project) return false;

      const result = parseProjectJson(JSON.stringify(parsed.project));
      if (!result.ok) return false;

      this.project = ensureSpriteScopedScripts(result.project);
      this.activeTab = isAppTab(parsed.activeTab) ? parsed.activeTab : this.activeTab;
      this.selectedSpriteId =
        findSpriteId(this.project, parsed.selectedSpriteId) ?? this.project.sprites[0]?.id ?? "";
      this.selectedSpriteFrameId =
        findSpriteFrameId(this.project, this.selectedSpriteId, parsed.selectedSpriteFrameId) ??
        this.project.sprites.find((sprite) => sprite.id === this.selectedSpriteId)?.frames[0]?.id ??
        "";
      this.selectedTilemapId =
        findTilemapId(this.project, parsed.selectedTilemapId) ?? this.project.tilemaps[0]?.id ?? "";
      this.selectedTileIndexByTilemap = isTileIndexMap(parsed.selectedTileIndexByTilemap)
        ? parsed.selectedTileIndexByTilemap
        : {};
      this.settingsOpen = parsed.settingsOpen === true;
      return true;
    } catch {
      return false;
    }
  }

  private persistAppState(): void {
    const storage = getAppStateStorage();
    if (!storage) return;

    const state: PersistedAppState = {
      version: 1,
      project: this.project,
      activeTab: this.activeTab,
      selectedSpriteId: this.selectedSpriteId,
      selectedSpriteFrameId: this.selectedSpriteFrameId,
      selectedTilemapId: this.selectedTilemapId,
      selectedTileIndexByTilemap: this.selectedTileIndexByTilemap,
      settingsOpen: this.settingsOpen,
    };

    try {
      storage.setItem(appStateStorageKey, JSON.stringify(state));
    } catch {
      // Storage can be unavailable or full; downloads remain explicit backup path.
    }
  }

  private async buildElf(): Promise<void> {
    this.captureBlocklyState();
    const result = await buildCartridge(this.project, this.buildCompiler);
    const machineCode = this.querySelector<HTMLElement>("[data-machine-code]");

    if (machineCode && result.elf) {
      machineCode.textContent = formatBytes(result.elf.bytes);
    }

    this.writeConsole(
      result.diagnostics.length === 0 ? "Built cartridge.elf" : result.diagnostics.join("\n"),
    );
  }

  private async downloadCartridge(): Promise<void> {
    this.captureBlocklyState();
    const result = await buildCartridge(this.project, this.buildCompiler);

    if (result.elf) {
      downloadFile(createCartridgeElfFile(result.elf));
    }

    this.writeConsole(
      result.diagnostics.length === 0 ? "Downloaded cartridge.elf" : result.diagnostics.join("\n"),
    );
  }

  private async runProject(): Promise<void> {
    this.captureBlocklyState();
    const result = await buildCartridge(this.project, this.buildCompiler);

    if (!result.elf) {
      this.debugSnapshot = { ...this.debugSnapshot, state: "stopped" };
      this.showNotice("error", `Could not run project:\n${result.diagnostics.join("\n")}`);
      return;
    }

    if (this.activeTab !== "game") {
      this.activeTab = "game";
      this.debugSnapshot = { ...this.debugSnapshot, state: "stopped" };
      this.render();
    }

    if (!this.previewRuntime) {
      this.showNotice("error", "Risc96 preview runtime is unavailable.");
      return;
    }

    try {
      await this.previewRuntime.load(result.elf);
      this.previewRuntime.run();
      this.previewInput.update();
      this.debugSnapshot = { ...this.debugSnapshot, state: "running" };
      this.showNotice("info", "Running cartridge preview.");
    } catch (error) {
      this.debugSnapshot = { ...this.debugSnapshot, state: "stopped" };
      this.showNotice(
        "error",
        error instanceof Error ? `Could not start preview:\n${error.message}` : "Could not start preview.",
      );
    }
  }

  private createProject(): void {
    this.project = ensureSpriteScopedScripts({
      ...structuredClone(sampleProject),
      controls: createDefaultControls(),
    });
    this.projectFileHandle = undefined;
    this.selectedSpriteId = this.project.sprites[0]?.id ?? "";
    this.selectedSpriteFrameId = this.project.sprites[0]?.frames[0]?.id ?? "";
    this.selectedTilemapId = this.project.tilemaps[0]?.id ?? "";
    this.activeTab = "code";
    this.showNotice("info", "Created a new project. Save it to choose a local .s96 file.");
    this.render();
  }

  private async saveProject(): Promise<void> {
    this.captureBlocklyState();
    const file = createS96ProjectFile(this.project);

    try {
      this.projectFileHandle ??= await createProjectFile(file.filename);
      if (this.projectFileHandle) {
        await writeProjectFile(this.projectFileHandle, file);
        this.showNotice("info", `Saved ${this.projectFileHandle.name}.`);
        return;
      }
    } catch (error) {
      if (isFilePickerCancellation(error)) return;
      this.showNotice(
        "error",
        error instanceof Error ? `Could not save project:\n${error.message}` : "Could not save project.",
      );
      return;
    }

    downloadFile(file);
    this.showNotice(
      "info",
      "Downloaded project. Use a browser with the File System Access API to save changes directly to the same file.",
    );
  }

  private async openProjectFromFileSystem(): Promise<void> {
    if (!supportsProjectFileAccess()) {
      this.querySelector<HTMLInputElement>("[data-open-input]")?.click();
      return;
    }

    try {
      const handle = await pickProjectFile();
      if (!handle) return;
      await this.loadProject(handle.getFile(), handle);
    } catch (error) {
      if (isFilePickerCancellation(error)) return;
      this.showNotice(
        "error",
        error instanceof Error ? `Could not open project:\n${error.message}` : "Could not open project.",
      );
    }
  }

  private async openProjectFromInput(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    await this.loadProject(Promise.resolve(file));
    input.value = "";
  }

  private async loadProject(filePromise: Promise<File>, handle?: ProjectFileHandle): Promise<void> {
    const file = await filePromise;
    const result = await loadProjectFile(file);

    if (result.ok) {
      this.project = ensureSpriteScopedScripts(result.project);
      this.projectFileHandle = file.name.toLowerCase().endsWith(".s96") ? handle : undefined;
      this.selectedSpriteId = this.project.sprites[0]?.id ?? "";
      this.selectedSpriteFrameId = this.project.sprites[0]?.frames[0]?.id ?? "";
      this.selectedTilemapId = this.project.tilemaps[0]?.id ?? "";
      await saveStoredControls(this.project.controls);
      this.showNotice("info", `Opened ${file.name}.`);
      this.render();
      return;
    }

    this.showNotice("error", result.diagnostics.join("\n"));
  }

  private async uploadSprite(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    const result = await addSpriteFromFile(this.project, file);
    this.project = result.project;
    this.project = ensureSpriteScopedScripts(this.project);
    this.selectedSpriteId = result.spriteId;
    this.selectedSpriteFrameId =
      this.project.sprites.find((sprite) => sprite.id === result.spriteId)?.frames[0]?.id ?? "";
    this.render();
  }

  private async importAseprite(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    const result = await addAsepriteFromFile(this.project, file);
    this.project = result.project;
    this.project = ensureSpriteScopedScripts(this.project);
    this.selectedSpriteId = result.spriteId;
    this.selectedSpriteFrameId =
      this.project.sprites.find((sprite) => sprite.id === result.spriteId)?.frames[0]?.id ?? "";
    this.writeConsole(`Imported Aseprite source ${file.name}.`);
    this.render();
  }

  private async importSpritesheet(input: HTMLInputElement): Promise<void> {
    const files = [...(input.files ?? [])];
    const imageFile = files.find(isSupportedImageFile);
    const jsonFile = files.find((file) => file.type === "application/json" || file.name.toLowerCase().endsWith(".json"));
    if (!imageFile || !jsonFile) {
      this.writeConsole("Choose one spritesheet image and one JSON metadata file.");
      return;
    }

    const result = await addSpritesheetFromFiles(this.project, imageFile, jsonFile);
    this.project = ensureSpriteScopedScripts(result.project);
    this.selectedSpriteId = result.spriteId;
    this.selectedSpriteFrameId =
      this.project.sprites.find((sprite) => sprite.id === result.spriteId)?.frames[0]?.id ?? "";
    this.writeConsole(`Imported spritesheet ${imageFile.name} with ${jsonFile.name}.`);
    this.render();
  }

  private async uploadSpriteFrame(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    const spriteId = input.dataset.uploadSpriteFrame;
    if (!file || !spriteId) return;

    this.project = await addSpriteFrameFromFile(this.project, spriteId, file);
    this.selectedSpriteId = spriteId;
    const sprite = this.project.sprites.find((candidate) => candidate.id === spriteId);
    this.selectedSpriteFrameId = sprite?.frames.at(-1)?.id ?? this.selectedSpriteFrameId;
    this.render();
  }

  private async uploadSound(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    this.project = await addSoundFromFile(this.project, file);
    this.render();
  }

  private async uploadFont(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    this.project = await addFontFromFile(this.project, file);
    this.render();
  }

  private deleteFont(id: string): void {
    this.project = deleteFont(this.project, id);
    this.render();
  }

  private addTilemap(): void {
    const result = addDefaultTilemap(this.project);
    this.project = result.project;
    this.selectedTilemapId = result.tilemapId;
    this.render();
  }

  private async importTilemap(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await addTilemapFromFile(this.project, file);
      this.project = result.project;
      this.selectedTilemapId = result.tilemapId;
      this.writeConsole(`Imported tilemap ${file.name}.`);
      this.render();
    } catch (error) {
      this.writeConsole(error instanceof Error ? error.message : "Tilemap import failed.");
    }
  }

  private async importTileImage(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await addSpriteFromFile(this.project, file);
      this.project = result.project;
      this.selectedSpriteId = result.spriteId;
      this.applyTilesetToSelectedTilemap(result.spriteId);
      this.writeConsole(`Imported tile image ${file.name}.`);
      this.render();
    } catch (error) {
      this.writeConsole(error instanceof Error ? error.message : "Tile image import failed.");
    }
  }

  private async importTileAseprite(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await addAsepriteFromFile(this.project, file);
      this.project = result.project;
      this.selectedSpriteId = result.spriteId;
      this.applyTilesetToSelectedTilemap(result.spriteId);
      this.writeConsole(`Imported Aseprite tileset ${file.name}.`);
      this.render();
    } catch (error) {
      this.writeConsole(error instanceof Error ? error.message : "Aseprite tileset import failed.");
    }
  }

  private async importTileSpritesheet(input: HTMLInputElement): Promise<void> {
    const files = [...(input.files ?? [])];
    const imageFile = files.find(isSupportedImageFile);
    const jsonFile = files.find((file) => file.type === "application/json" || file.name.toLowerCase().endsWith(".json"));
    if (!imageFile || !jsonFile) {
      this.writeConsole("Choose one tileset image and one JSON metadata file.");
      return;
    }

    try {
      const result = await addSpritesheetFromFiles(this.project, imageFile, jsonFile);
      this.project = result.project;
      this.selectedSpriteId = result.spriteId;
      this.applyTilesetToSelectedTilemap(result.spriteId);
      this.writeConsole(`Imported tileset spritesheet ${imageFile.name} with ${jsonFile.name}.`);
      this.render();
    } catch (error) {
      this.writeConsole(error instanceof Error ? error.message : "Tileset spritesheet import failed.");
    }
  }

  private applyTilesetToSelectedTilemap(spriteId: string): void {
    let tilemapId = this.selectedTilemapId;
    if (!this.project.tilemaps.some((tilemap) => tilemap.id === tilemapId)) {
      const result = addDefaultTilemap(this.project);
      this.project = result.project;
      tilemapId = result.tilemapId;
    }

    this.project = updateTilemapTileset(this.project, tilemapId, spriteId);
    this.selectedTilemapId = tilemapId;
    this.selectedTileIndexByTilemap[tilemapId] = 0;
  }

  private renameSprite(id: string, name: string): void {
    this.project = renameSprite(this.project, id, name);
  }

  private deleteSprite(id: string): void {
    this.project = deleteSprite(this.project, id);
    this.selectedSpriteId = this.project.sprites[0]?.id ?? "";
    this.selectedSpriteFrameId = this.project.sprites[0]?.frames[0]?.id ?? "";
    this.render();
  }

  private renameSound(id: string, name: string): void {
    this.project = renameSound(this.project, id, name);
  }

  private addToneNote(soundId: string): void {
    this.project = addToneNote(this.project, soundId);
    this.render();
  }

  private removeToneNote(button: HTMLElement): void {
    const soundId = button.dataset.toneSound ?? "";
    const noteIndex = Number(button.dataset.removeToneNote ?? -1);
    this.project = removeToneNote(this.project, soundId, noteIndex);
    this.render();
  }

  private updateToneNoteField(input: HTMLElement): void {
    const soundId = input.dataset.toneSound ?? "";
    const noteIndex = Number(input.dataset.toneNote ?? -1);
    const field = input.dataset.toneNoteField as "freq" | "ms" | undefined;
    if (!field) return;

    const value = Math.max(field === "freq" ? 1 : 10, Math.round(readNumberValue(input)));
    this.project = updateToneNoteField(this.project, soundId, noteIndex, field, value);
    this.updateGeneratedOutput();
  }

  private renameTilemap(id: string, name: string): void {
    this.project = renameTilemap(this.project, id, name);
  }

  private updateCollider(input: HTMLElement): void {
    const spriteId = input.dataset.colliderSprite ?? "";
    const colliderId = input.dataset.colliderId ?? "";
    const field = input.dataset.colliderField as "x" | "y" | "width" | "height" | undefined;
    if (!field) return;

    const value = Math.max(
      field === "width" || field === "height" ? 1 : 0,
      Math.round(readNumberValue(input)),
    );
    this.project = updateSpriteCollider(this.project, spriteId, colliderId, field, value);
    const collider = this.project.sprites
      .find((sprite) => sprite.id === spriteId)
      ?.colliders.find((candidate) => candidate.id === colliderId);
    if (collider) this.syncColliderOverlay(spriteId, colliderId, collider);
    this.updateGeneratedOutput();
  }

  private startColliderOverlayEdit(event: PointerEvent, box: HTMLElement): void {
    const spriteId = box.dataset.colliderSprite ?? "";
    const colliderId = box.dataset.colliderId ?? "";
    const stage = box.closest<HTMLElement>("[data-collider-stage]");
    const sprite = this.project.sprites.find((candidate) => candidate.id === spriteId);
    const collider = sprite?.colliders.find((candidate) => candidate.id === colliderId);
    const start = stage && sprite ? readColliderPoint(stage, event, sprite) : undefined;
    if (!stage || !sprite || !collider || !start) return;

    event.preventDefault();
    const resizing = (event.target as HTMLElement | null)?.dataset.colliderHandle === "resize";
    const startRect = { ...collider };

    const move = (moveEvent: PointerEvent) => {
      const current = readColliderPoint(stage, moveEvent, sprite);
      if (!current) return;

      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const rect = resizing
        ? {
            x: startRect.x,
            y: startRect.y,
            width: clamp(startRect.width + dx, 1, sprite.width - startRect.x),
            height: clamp(startRect.height + dy, 1, sprite.height - startRect.y),
          }
        : {
            x: clamp(startRect.x + dx, 0, sprite.width - startRect.width),
            y: clamp(startRect.y + dy, 0, sprite.height - startRect.height),
            width: startRect.width,
            height: startRect.height,
          };

      this.updateColliderRect(spriteId, colliderId, rect);
      this.syncColliderOverlay(spriteId, colliderId, rect);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      this.updateGeneratedOutput();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  private updateColliderRect(
    spriteId: string,
    colliderId: string,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    this.project = updateSpriteCollider(this.project, spriteId, colliderId, "x", rect.x);
    this.project = updateSpriteCollider(this.project, spriteId, colliderId, "y", rect.y);
    this.project = updateSpriteCollider(this.project, spriteId, colliderId, "width", rect.width);
    this.project = updateSpriteCollider(this.project, spriteId, colliderId, "height", rect.height);
  }

  private syncColliderOverlay(
    spriteId: string,
    colliderId: string,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    const sprite = this.project.sprites.find((candidate) => candidate.id === spriteId);
    if (!sprite) return;

    const box = [...this.querySelectorAll<HTMLElement>("[data-collider-box]")].find(
      (candidate) =>
        candidate.dataset.colliderSprite === spriteId &&
        candidate.dataset.colliderId === colliderId,
    );
    if (box) {
      box.style.left = `${toPercent(rect.x, sprite.width)}%`;
      box.style.top = `${toPercent(rect.y, sprite.height)}%`;
      box.style.width = `${toPercent(rect.width, sprite.width)}%`;
      box.style.height = `${toPercent(rect.height, sprite.height)}%`;
    }

    for (const input of this.querySelectorAll<HTMLElement>("[data-collider-field]")) {
      if (input.dataset.colliderSprite !== spriteId || input.dataset.colliderId !== colliderId)
        continue;
      const field = input.dataset.colliderField as keyof typeof rect | undefined;
      if (!field) continue;
      (input as unknown as { value: string }).value = String(rect[field]);
    }
  }

  private resizeSprite(input: HTMLElement): void {
    const spriteId = input.dataset.spriteSizeId ?? "";
    const field = input.dataset.spriteSize as "width" | "height" | undefined;
    const sprite = this.project.sprites.find((candidate) => candidate.id === spriteId);
    if (!sprite || !field) return;

    const value = Math.max(1, Math.round(readNumberValue(input)));
    this.project = resizeSprite(
      this.project,
      spriteId,
      field === "width" ? value : sprite.width,
      field === "height" ? value : sprite.height,
    );
    this.selectedSpriteFrameId =
      this.project.sprites.find((candidate) => candidate.id === spriteId)?.frames[0]?.id ??
      this.selectedSpriteFrameId;
    this.render();
  }

  private updateTilemapField(input: HTMLElement): void {
    const id = input.dataset.tilemapId ?? "";
    const field = input.dataset.tilemapField as
      | "width"
      | "height"
      | "tileWidth"
      | "tileHeight"
      | undefined;
    if (!field) return;

    const value = Math.max(1, Math.round(readNumberValue(input)));
    this.project = updateTilemapField(this.project, id, field, value);
    this.render();
  }

  private updateTilemapTileset(input: HTMLElement): void {
    const id = input.dataset.tilemapTileset ?? "";
    const tilesetSpriteId = readStringValue(input);
    this.project = updateTilemapTileset(this.project, id, tilesetSpriteId);
    this.selectedTileIndexByTilemap[id] = 0;
    this.render();
  }

  private selectTile(button: HTMLElement): void {
    const id = button.dataset.tilemapId ?? "";
    this.selectedTileIndexByTilemap[id] = Math.max(0, Math.round(Number(button.dataset.selectTile ?? 0)));
    this.render();
  }

  private updateTilemapCell(button: HTMLElement): void {
    const id = button.dataset.tilemapId ?? "";
    const index = Number(button.dataset.tilemapCell ?? -1);
    const value = Number(button.dataset.tilemapTile ?? 0);

    this.project = updateTilemapCell(this.project, id, index, value);
    this.render();
  }

  private updateTilemapCollisionCell(button: HTMLElement): void {
    const id = button.dataset.tilemapId ?? "";
    const index = Number(button.dataset.tilemapCollisionCell ?? -1);

    this.project = updateTilemapCollisionCell(this.project, id, index);
    this.render();
  }

  private startMapping(button: HTMLElement): void {
    const player = Number(button.dataset.mapPlayer) as 1 | 2 | 3 | 4;
    const control = button.dataset.mapControl ?? "A";
    this.waitingForMapping = { player, control };
    this.writeConsole(
      `Press a keyboard key, mouse button, or gamepad input for controller ${player} ${control}.`,
    );
    captureNextControlInput((input) => void this.applyMapping(input));
  }

  private async applyMapping(input: ControllerInput): Promise<void> {
    const target = this.waitingForMapping;
    if (!target) return;

    this.waitingForMapping = undefined;
    this.project.controls = {
      players: this.project.controls.players.map((player) =>
        player.player !== target.player
          ? player
          : {
              ...player,
              bindings: player.bindings.map((binding) =>
                binding.control === target.control ? { ...binding, input } : binding,
              ),
            },
      ),
    };
    await saveStoredControls(this.project.controls);
    this.render();
  }

  private updateGeneratedOutput(): void {
    const compiled = compileProjectToC(this.project);
    this.hydrateGeneratedOutput(compiled.source, compiled.assetsHeader);
    this.writeConsole(
      compiled.diagnostics.length === 0 ? "Ready." : compiled.diagnostics.join("\n"),
    );
  }

  private updateResolution(patch: { width?: number; height?: number }): void {
    this.project = updateProjectSettings(this.project, patch);
    this.updateGeneratedOutput();
  }

  private writeConsole(message: string): void {
    this.showNotice("info", message);
  }

  private showNotice(tone: AppNotice["tone"], message: string): void {
    this.notice = { tone, message };
    const notice = this.querySelector<HTMLElement>("[data-app-notice]");
    if (!notice) return;

    notice.hidden = false;
    notice.dataset.tone = tone;
    notice.setAttribute("role", tone === "error" ? "alert" : "status");
    notice.textContent = message;
  }
}

function readNumberValue(target: EventTarget | null): number {
  return Number(readStringValue(target));
}

function readCheckedValue(target: EventTarget | null): boolean {
  return Boolean((target as { checked?: boolean } | null)?.checked);
}

function readStringValue(target: EventTarget | null): string {
  const candidate = target as unknown as { value?: unknown } | null;
  return typeof candidate?.value === "string" ? candidate.value : "";
}

function readColliderPoint(
  stage: HTMLElement,
  event: PointerEvent,
  sprite: Risc96Project["sprites"][number],
): { x: number; y: number } | undefined {
  const rect = stage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return undefined;

  return {
    x: clamp(
      Math.round(((event.clientX - rect.left) / rect.width) * sprite.width),
      0,
      sprite.width,
    ),
    y: clamp(
      Math.round(((event.clientY - rect.top) / rect.height) * sprite.height),
      0,
      sprite.height,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toPercent(value: number, size: number): number {
  if (size <= 0) return 0;
  return clamp((value / size) * 100, 0, 100);
}

function formatBytes(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 512), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function getAppStateStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function isAppTab(value: unknown): value is AppTab {
  return typeof value === "string" && appTabs.includes(value as AppTab);
}

function findSpriteId(project: Risc96Project, id: unknown): string | undefined {
  return typeof id === "string" && project.sprites.some((sprite) => sprite.id === id)
    ? id
    : undefined;
}

function findSpriteFrameId(
  project: Risc96Project,
  spriteId: string,
  frameId: unknown,
): string | undefined {
  const sprite = project.sprites.find((candidate) => candidate.id === spriteId);

  return typeof frameId === "string" && sprite?.frames.some((frame) => frame.id === frameId)
    ? frameId
    : undefined;
}

function findTilemapId(project: Risc96Project, id: unknown): string | undefined {
  return typeof id === "string" && project.tilemaps.some((tilemap) => tilemap.id === id)
    ? id
    : undefined;
}

function isTileIndexMap(value: unknown): value is Record<string, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((entry) => typeof entry === "number")
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable
  );
}
