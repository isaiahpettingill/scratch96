import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createApp } from "./app.ts";
import { sampleProject } from "./project/sampleProject.ts";

HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

const buildPreferencesStorageKey = "scratch96.buildPreferences.v1";
const appStateStorageKey = "scratch96.appState.v1";

describe("scratch96 app shell", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
    window.localStorage.removeItem(buildPreferencesStorageKey);
  });

  afterEach(() => {
    document.body.replaceChildren();
    window.localStorage.removeItem(buildPreferencesStorageKey);
  });

  it("renders the tabbed IDE with sidebars and generated output tab", () => {
    document.body.replaceChildren(createApp());

    expect(document.querySelector("scratch96-app")).not.toBeNull();
    expect(document.body.textContent).toContain("Code");
    expect(document.body.textContent).toContain("Gameplay");
    expect(document.body.textContent).toContain("Sprites");
    expect(document.body.textContent).toContain("Colliders");
    expect(document.body.textContent).toContain("Audio");
    expect(document.body.textContent).toContain("Fonts");
    expect(document.body.textContent).toContain("Tilemaps");
    expect(document.body.textContent).toContain("Generated");
    expect(document.body.textContent).toContain("Blockly workspace mounts here.");
    expect(document.querySelector("[data-blockly-workspace]")).not.toBeNull();
    expect(document.body.textContent).toContain("Code Graph");
    expect(document.body.textContent).toContain("Procedures");
    expect(document.querySelector("[data-console-output]")).toBeNull();

    document.querySelector<HTMLElement>('[data-tab="generated"]')?.click();

    expect(document.querySelector(".generated-code")?.textContent).toContain(
      "r96_set_resolution(320, 224);",
    );
    expect(document.querySelector(".generated-assets")?.textContent).toContain(
      "#define SPRITE_PLAYER 0",
    );
  });

  it("keeps primary actions top-level and moves secondary actions into a menu", () => {
    document.body.replaceChildren(createApp());

    const buttons = [...document.querySelectorAll("cds-button")].map((button) =>
      button.textContent?.trim(),
    );

    expect(buttons).toEqual(["Run", "Stop"]);
    expect(document.querySelector("cds-menu-button")?.getAttribute("label")).toBe("Project");
    expect(document.querySelector("cds-menu-button")?.getAttribute("menu-background-token")).toBe(
      "layer",
    );
    expect(
      [...document.querySelectorAll("cds-menu-item")].map((item) => item.getAttribute("label")),
    ).toEqual([
      "New project",
      "Open project",
      "Save project",
      "Build ELF",
      "Download cartridge",
    ]);
  });

  it("switches to a large gameplay preview tab", () => {
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>('[data-tab="game"]')?.click();

    expect(document.body.textContent).toContain("Risc96 Preview");
    expect(document.body.textContent).toContain("Program counter");
    expect(document.body.textContent).toContain("Registers");
    expect(document.querySelector("[data-stage-screen]")).not.toBeNull();
  });

  it("shows one Blockly code page without sprite script targets", () => {
    document.body.replaceChildren(createApp());

    expect(document.querySelector("[data-select-script]")).toBeNull();
    expect(document.querySelector(".panel.code-panel")).toBeNull();
    expect(document.body.textContent).not.toContain("Build the game from one Blockly workspace.");
    expect(document.querySelector("[data-code-section='start']")).not.toBeNull();
    expect(document.querySelector("[data-code-section='update']")).not.toBeNull();
    expect(document.querySelector("[data-code-section='draw']")).not.toBeNull();
    expect(document.body.textContent).not.toContain("Stage");
  });

  it("shows sprites and frames in the sprite editor", () => {
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>('[data-tab="sprites"]')?.click();

    expect(document.body.textContent).toContain("Sprites");
    expect(document.body.textContent).toContain("Import sprite");
    expect(document.body.textContent).toContain("Plain image");
    expect(document.body.textContent).toContain("Spritesheet (Pixelorama)");

    expect(document.querySelector("[data-import-sprite]")).not.toBeNull();
    expect(document.querySelector("[data-import-image]")).not.toBeNull();
    expect(document.querySelector("[data-import-aseprite]")).not.toBeNull();
    expect(document.querySelector("[data-import-spritesheet]")).not.toBeNull();
    expect(document.querySelector("scratch96-piskel-editor")).not.toBeNull();
    expect(
      document.querySelector('.sprite-mode-sidebar [data-sprite-size="width"]'),
    ).not.toBeNull();
    expect(document.querySelector(".sprite-mode-sidebar [data-delete-sprite]")).not.toBeNull();
    expect(document.querySelector(".sprite-editor-fields")).toBeNull();
    expect(document.querySelector("[data-piskel-canvas]")).toBeNull();
    expect(document.querySelector('[data-piskel-tool="fill"]')).toBeNull();
    expect(document.querySelector("[data-piskel-color]")).toBeNull();
    expect(document.querySelector("[data-collider-field]")).toBeNull();
  });

  it("edits sprite colliders in a dedicated overlay tab", () => {
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>('[data-tab="colliders"]')?.click();

    expect(document.body.textContent).toContain("Sprite Collision");
    expect(document.body.textContent).toContain("Hit Boxes");
    expect(document.querySelector("[data-collider-stage]")).not.toBeNull();
    expect(document.querySelector("[data-collider-box]")).not.toBeNull();
    expect(document.querySelector('[data-collider-field="x"]')).not.toBeNull();
    expect(document.querySelector("[data-piskel-canvas]")).toBeNull();
  });

  it("has a separate audio assets tab", () => {
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>('[data-tab="audio"]')?.click();

    expect(document.body.textContent).toContain("Audio Assets");
    expect(document.body.textContent).toContain("Coin");
    expect(document.querySelector("[data-upload-sound]")).not.toBeNull();
    expect(document.querySelector("[data-add-tone-sound]")).not.toBeNull();
    expect(document.querySelector("[data-tone-note-field]")).not.toBeNull();
    expect(document.querySelector("[data-add-tone-note]")).not.toBeNull();
  });

  it("shows bitmap font and tilemap authoring tabs", () => {
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>('[data-tab="fonts"]')?.click();
    expect(document.body.textContent).toContain("Bitmap Fonts");
    expect(document.querySelector("[data-upload-font]")).not.toBeNull();

    document.querySelector<HTMLElement>('[data-tab="tilemaps"]')?.click();
    expect(document.body.textContent).toContain("Tilemaps");
    expect(document.querySelector("[data-add-tilemap]")).not.toBeNull();
    expect(document.querySelector("[data-import-tilemap]")).not.toBeNull();

    document.querySelector<HTMLElement>("[data-add-tilemap]")?.click();
    expect(document.body.textContent).toContain("Tilemap 1");
    expect(document.querySelector("scratch96-tilemap-editor[data-tilemap-id]")).not.toBeNull();
  });

  it("shows compile failures without leaving the current editor tab", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>("[data-run-action]")?.click();

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(document.querySelector<HTMLElement>("[data-app-notice]")?.dataset.tone).toBe("error");
    expect(document.querySelector<HTMLElement>("[data-app-notice]")?.textContent).toContain(
      "Could not run project:",
    );
    expect(document.querySelector<HTMLElement>('[data-tab="code"]')?.classList.contains("active")).toBe(
      true,
    );

    fetch.mockRestore();
  });

  it("falls back to a browser download when direct file saving is unsupported", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:scratch96");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>("[data-save-action]")?.click();
    await Promise.resolve();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:scratch96");

    click.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it("saves to the selected local project file", async () => {
    const write = vi.fn(async (_data: Blob) => {});
    const close = vi.fn(async () => {});
    const showSaveFilePicker = vi.fn(async () => ({
      name: "local-project.s96",
      getFile: async () => new File([], "local-project.s96"),
      createWritable: async () => ({ write, close }),
    }));
    Object.assign(window, { showSaveFilePicker });
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>("[data-save-action]")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLElement>("[data-app-notice]")?.textContent).toContain(
      "Saved local-project.s96.",
    );

    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it("creates a new unsaved project", () => {
    document.body.replaceChildren(createApp());
    document.querySelector<HTMLElement>("[data-settings-action]")?.click();
    const title = document.querySelector("[data-project-title]") as HTMLElement & { value: string };
    title.value = "Changed title";
    title.dispatchEvent(new Event("input", { bubbles: true }));

    document.querySelector<HTMLElement>("[data-new-action]")?.click();

    expect(document.body.textContent).toContain("Hello Cartridge");
    expect(document.querySelector<HTMLElement>("[data-app-notice]")?.textContent).toContain(
      "Created a new project",
    );
  });

  it("autosaves project edits for refresh restore", async () => {
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>("[data-settings-action]")?.click();
    const title = document.querySelector("[data-project-title]") as HTMLElement & { value: string };
    title.value = "Autosaved Cartridge";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();

    const stored = JSON.parse(window.localStorage.getItem(appStateStorageKey) ?? "{}");
    expect(stored.project.metadata.name).toBe("Autosaved Cartridge");
    expect(stored.settingsOpen).toBe(true);
  });

  it("restores project and UI state after refresh", () => {
    const project = structuredClone(sampleProject);
    project.metadata = { ...project.metadata, name: "Restored Cartridge" };
    window.localStorage.setItem(
      appStateStorageKey,
      JSON.stringify({
        version: 1,
        project,
        activeTab: "game",
        selectedSpriteId: project.sprites[0]?.id ?? "",
        selectedSpriteFrameId: project.sprites[0]?.frames[0]?.id ?? "",
        selectedTilemapId: project.tilemaps[0]?.id ?? "",
        selectedTileIndexByTilemap: {},
        settingsOpen: true,
      }),
    );

    document.body.replaceChildren(createApp());

    expect(document.body.textContent).toContain("Restored Cartridge");
    expect(
      document.querySelector<HTMLElement>('[data-tab="game"]')?.classList.contains("active"),
    ).toBe(true);
    expect(document.querySelector("[data-project-title]")).not.toBeNull();
  });

  it("surfaces cartridge download build failures", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>("[data-download-cartridge-action]")?.click();

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(click).not.toHaveBeenCalled();

    fetch.mockRestore();
    click.mockRestore();
  });

  it("keeps generated resolution on the setup block", () => {
    document.body.replaceChildren(createApp());
    document.querySelector<HTMLElement>("[data-settings-action]")?.click();

    const width = document.querySelector("[data-setting-width]") as HTMLElement & { value: string };
    width.value = "400";
    width.dispatchEvent(new Event("input"));
    document.querySelector<HTMLElement>('[data-tab="generated"]')?.click();

    expect(document.querySelector(".generated-code")?.textContent).toContain(
      "r96_set_resolution(320, 224);",
    );
  });

  it("keeps the cproc compiler preference in browser storage", () => {
    document.body.replaceChildren(createApp());

    document.querySelector<HTMLElement>("[data-settings-action]")?.click();
    const advanced = document.querySelector("details.advanced-settings");
    const checkbox = document.querySelector<HTMLInputElement>("[data-setting-cproc-compiler]");

    expect(advanced?.hasAttribute("open")).toBe(false);
    expect(checkbox?.checked).toBe(false);

    checkbox!.checked = true;
    checkbox!.dispatchEvent(new Event("change"));

    expect(JSON.parse(window.localStorage.getItem(buildPreferencesStorageKey) ?? "{}")).toEqual({
      compiler: "cproc",
    });
  });
});

function createMemoryStorage(): Storage {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    key(index: number) {
      return [...items.keys()][index] ?? null;
    },
    removeItem(key: string) {
      items.delete(key);
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  };
}
