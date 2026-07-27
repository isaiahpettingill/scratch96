import type { Risc96Project, Script, SerializedBlocks } from "./model.ts";

export function emptyBlocks(): SerializedBlocks {
  return { start: [], update: [] };
}

export function createStageScript(blocks: SerializedBlocks = emptyBlocks()): Script {
  return { id: "stage-main", target: "stage", blocks };
}

export function ensureSpriteScopedScripts(project: Risc96Project): Risc96Project {
  const scripts = project.scripts.filter((script) => script.target === "stage");

  if (!scripts.some((script) => script.target === "stage")) {
    scripts.unshift(createStageScript());
  }

  return { ...project, scripts };
}

export function scriptLabel(project: Risc96Project, script: Script): string {
  if (script.target === "stage") return "Game";
  const target = script.target;
  return project.sprites.find((sprite) => sprite.id === target.spriteId)?.name ?? target.spriteId;
}
