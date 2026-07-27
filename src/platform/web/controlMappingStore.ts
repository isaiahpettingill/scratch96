import { createDefaultControls } from "../../project/controls.ts";
import type { ProjectControls } from "../../project/model.ts";

const storageKey = "scratch96.controls.v1";
const configFileName = "controls.v1.json";

type TauriApi = {
  core?: { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> };
  path?: { appConfigDir?: () => Promise<string>; join?: (...parts: string[]) => Promise<string> };
  fs?: {
    exists?: (path: string) => Promise<boolean>;
    readTextFile?: (path: string) => Promise<string>;
    writeTextFile?: (path: string, contents: string) => Promise<void>;
    mkdir?: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  };
};

declare global {
  interface Window {
    __TAURI__?: TauriApi;
  }
}

export async function loadStoredControls(): Promise<ProjectControls> {
  const fromTauri = await readTauriControls();

  if (fromTauri) {
    return fromTauri;
  }

  const storage = getLocalStorage();
  const stored = storage?.getItem(storageKey);

  if (!stored) {
    return createDefaultControls();
  }

  return parseControls(stored);
}

export async function saveStoredControls(controls: ProjectControls): Promise<void> {
  const serialized = `${JSON.stringify(controls, null, 2)}\n`;

  if (await writeTauriControls(serialized)) {
    return;
  }

  getLocalStorage()?.setItem(storageKey, serialized);
}

function parseControls(contents: string): ProjectControls {
  try {
    const parsed = JSON.parse(contents) as ProjectControls;

    if (Array.isArray(parsed.players)) {
      return parsed;
    }
  } catch {
    return createDefaultControls();
  }

  return createDefaultControls();
}

async function readTauriControls(): Promise<ProjectControls | undefined> {
  const path = await resolveTauriControlsPath();
  const fs = window.__TAURI__?.fs;

  if (!path || !fs?.exists || !fs.readTextFile || !(await fs.exists(path))) {
    return undefined;
  }

  return parseControls(await fs.readTextFile(path));
}

async function writeTauriControls(contents: string): Promise<boolean> {
  const tauriPath = window.__TAURI__?.path;
  const fs = window.__TAURI__?.fs;

  if (!tauriPath?.appConfigDir || !fs?.writeTextFile) {
    return false;
  }

  const configDir = await tauriPath.appConfigDir();
  await fs.mkdir?.(configDir, { recursive: true });
  const filePath = tauriPath.join ? await tauriPath.join(configDir, configFileName) : `${configDir}/${configFileName}`;
  await fs.writeTextFile(filePath, contents);
  return true;
}

async function resolveTauriControlsPath(): Promise<string | undefined> {
  const tauriPath = window.__TAURI__?.path;

  if (!tauriPath?.appConfigDir) {
    return undefined;
  }

  const configDir = await tauriPath.appConfigDir();
  return tauriPath.join ? tauriPath.join(configDir, configFileName) : `${configDir}/${configFileName}`;
}

function getLocalStorage(): Storage | undefined {
  try {
    if (typeof window === "undefined" || window.location.protocol === "about:") {
      return undefined;
    }

    return window.localStorage;
  } catch {
    return undefined;
  }
}
