import type { Risc96Project } from "./model.ts";

export type ProjectSettingsPatch = {
  width?: number;
  height?: number;
};

export function updateProjectSettings(
  project: Risc96Project,
  patch: ProjectSettingsPatch,
): Risc96Project {
  return {
    ...project,
    settings: {
      ...project.settings,
      ...sanitizePatch(patch),
    },
  };
}

function sanitizePatch(patch: ProjectSettingsPatch): ProjectSettingsPatch {
  const sanitized: ProjectSettingsPatch = {};

  if (patch.width !== undefined) {
    sanitized.width = Math.max(1, Math.trunc(patch.width));
  }

  if (patch.height !== undefined) {
    sanitized.height = Math.max(1, Math.trunc(patch.height));
  }

  return sanitized;
}
