import type { GeneratedSourceFile } from "../../compiler/emitC.ts";
import type { Risc96Project } from "../../project/model.ts";
import { serializeProjectJson } from "../../project/projectJson.ts";
import type { CartridgeElf } from "../../runtime/adapters.ts";

export type DownloadFile = {
  filename: string;
  contents: BlobPart[];
  type: string;
};

export function createProjectJsonFile(project: Risc96Project): DownloadFile {
  return {
    filename: `${safeFilename(project.metadata.name)}.scratch96.json`,
    contents: [serializeProjectJson(project)],
    type: "application/json",
  };
}

export function createGeneratedSourceFiles(files: GeneratedSourceFile[]): DownloadFile[] {
  return files.map((file) => ({
    filename: file.path,
    contents: [file.contents],
    type: "text/plain",
  }));
}

export function createCartridgeElfFile(elf: CartridgeElf): DownloadFile {
  const bytes = elf.bytes.slice();

  return {
    filename: "cartridge.elf",
    contents: [bytes.buffer],
    type: "application/octet-stream",
  };
}

export function downloadFile(file: DownloadFile, documentRef: Document = document): void {
  const blob = new Blob(file.contents, { type: file.type });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement("a");

  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "scratch96-project"
  );
}
