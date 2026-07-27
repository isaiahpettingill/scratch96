import type { Risc96Project } from "./model.ts";
import { createDefaultControls } from "./controls.ts";
import { normalizeSpriteColliders } from "./spriteColliders.ts";
import { normalizeTilemap } from "./tilemaps.ts";

export type ProjectJsonResult =
  | { ok: true; project: Risc96Project }
  | { ok: false; diagnostics: string[] };

export function parseProjectJson(contents: string): ProjectJsonResult {
  let value: unknown;

  try {
    value = JSON.parse(contents);
  } catch (error) {
    return { ok: false, diagnostics: [error instanceof Error ? error.message : "Invalid JSON."] };
  }

  const diagnostics = validateProjectShape(value);

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  return { ok: true, project: normalizeProject(value as Risc96Project) };
}

export function serializeProjectJson(project: Risc96Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

function validateProjectShape(value: unknown): string[] {
  const diagnostics: string[] = [];

  if (!isRecord(value)) {
    return ["Project JSON must be an object."];
  }

  if (value.version !== 1) {
    diagnostics.push("Project version must be 1.");
  }

  if (!isRecord(value.metadata) || typeof value.metadata.name !== "string") {
    diagnostics.push("Project metadata.name is required.");
  }

  if (!isRecord(value.settings)) {
    diagnostics.push("Project settings are required.");
  } else {
    if (typeof value.settings.width !== "number" || value.settings.width <= 0) {
      diagnostics.push("Project settings.width must be a positive number.");
    }

    if (typeof value.settings.height !== "number" || value.settings.height <= 0) {
      diagnostics.push("Project settings.height must be a positive number.");
    }

    if (value.settings.fps !== 60) {
      diagnostics.push("Project settings.fps must be 60 for v0.");
    }
  }

  if (!Array.isArray(value.sprites)) {
    diagnostics.push("Project sprites must be an array.");
  }

  if (!Array.isArray(value.sounds)) {
    diagnostics.push("Project sounds must be an array.");
  }

  if (!Array.isArray(value.scripts)) {
    diagnostics.push("Project scripts must be an array.");
  }

  if ("controls" in value && !isRecord(value.controls)) {
    diagnostics.push("Project controls must be an object.");
  }

  return diagnostics;
}

function normalizeProject(project: Risc96Project): Risc96Project {
  return {
    ...project,
    controls: project.controls ?? createDefaultControls(),
    sprites: project.sprites.map(normalizeSpriteColliders),
    fonts: project.fonts ?? [],
    tilemaps: (project.tilemaps ?? []).map(normalizeTilemap),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
