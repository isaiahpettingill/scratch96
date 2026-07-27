import type { Risc96Project } from "../../project/model.ts";
import { parseProjectJson } from "../../project/projectJson.ts";
import { loadS96ProjectFile } from "./s96Archive.ts";

export type LoadProjectFileResult =
  | { ok: true; project: Risc96Project }
  | { ok: false; diagnostics: string[] };

export async function loadProjectFile(file: File): Promise<LoadProjectFileResult> {
  if (file.name.endsWith(".s96")) {
    return loadS96ProjectFile(file);
  }

  if (!file.name.endsWith(".scratch96.json") && !file.name.endsWith(".json")) {
    return { ok: false, diagnostics: ["Project files must be .s96, .scratch96.json, or .json files."] };
  }

  return parseProjectJson(await readFileText(file));
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Project file did not decode as text."));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Failed to read project file."));
    });
    reader.readAsText(file);
  });
}
