export type BuildCompilerPreference = "tcc" | "cproc";

export type BuildPreferences = {
  compiler: BuildCompilerPreference;
};

const storageKey = "scratch96.buildPreferences.v1";
const defaultBuildPreferences: BuildPreferences = { compiler: "tcc" };

export function loadBuildPreferences(): BuildPreferences {
  const stored = getLocalStorage()?.getItem(storageKey);
  return stored ? parseBuildPreferences(stored) : { ...defaultBuildPreferences };
}

export function saveBuildPreferences(preferences: BuildPreferences): void {
  getLocalStorage()?.setItem(storageKey, `${JSON.stringify(preferences, null, 2)}\n`);
}

function parseBuildPreferences(contents: string): BuildPreferences {
  try {
    const parsed = JSON.parse(contents) as Partial<BuildPreferences>;
    if (parsed.compiler === "cproc") return { compiler: "cproc" };
  } catch {
    return { ...defaultBuildPreferences };
  }

  return { ...defaultBuildPreferences };
}

function getLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
