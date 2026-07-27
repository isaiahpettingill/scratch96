import type { DownloadFile } from "./downloads.ts";

export type ProjectFileHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
  }>;
};

type ProjectFilePickerWindow = Window & {
  showOpenFilePicker?: (options: {
    multiple: false;
    types: FilePickerAcceptType[];
  }) => Promise<ProjectFileHandle[]>;
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: FilePickerAcceptType[];
  }) => Promise<ProjectFileHandle>;
};

type FilePickerAcceptType = {
  description: string;
  accept: Record<string, string[]>;
};

const s96ProjectFileType: FilePickerAcceptType = {
  description: "scratch96 project",
  accept: { "application/zip": [".s96"] },
};

const projectFileTypes: FilePickerAcceptType[] = [
  s96ProjectFileType,
  {
    description: "scratch96 JSON project",
    accept: { "application/json": [".json", ".scratch96.json"] },
  },
];

export function supportsProjectFileAccess(): boolean {
  const browser = window as ProjectFilePickerWindow;
  return Boolean(browser.showOpenFilePicker && browser.showSaveFilePicker);
}

export async function pickProjectFile(): Promise<ProjectFileHandle | undefined> {
  const browser = window as ProjectFilePickerWindow;
  if (!browser.showOpenFilePicker) return undefined;

  const [fileHandle] = await browser.showOpenFilePicker({
    multiple: false,
    types: projectFileTypes,
  });
  return fileHandle;
}

export async function createProjectFile(filename: string): Promise<ProjectFileHandle | undefined> {
  const browser = window as ProjectFilePickerWindow;
  if (!browser.showSaveFilePicker) return undefined;

  return browser.showSaveFilePicker({
    suggestedName: filename,
    types: [s96ProjectFileType],
  });
}

export async function writeProjectFile(handle: ProjectFileHandle, file: DownloadFile): Promise<void> {
  const writable = await handle.createWritable();

  await writable.write(new Blob(file.contents, { type: file.type }));
  await writable.close();
}

export function isFilePickerCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
