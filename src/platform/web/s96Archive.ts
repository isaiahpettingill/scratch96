import type { Risc96Project } from "../../project/model.ts";
import { parseProjectJson, serializeProjectJson } from "../../project/projectJson.ts";
import type { DownloadFile } from "./downloads.ts";

export type S96ArchiveLoadResult =
  | { ok: true; project: Risc96Project }
  | { ok: false; diagnostics: string[] };

type ZipEntry = {
  path: string;
  data: Uint8Array;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function createS96ProjectFile(project: Risc96Project): DownloadFile {
  const entries = createProjectEntries(project);
  const bytes = writeZip(entries);

  return {
    filename: `${safeFilename(project.metadata.name)}.s96`,
    contents: [bytes.buffer as ArrayBuffer],
    type: "application/zip",
  };
}

export async function loadS96ProjectFile(file: File): Promise<S96ArchiveLoadResult> {
  if (!file.name.endsWith(".s96")) {
    return { ok: false, diagnostics: ["Project archives must be .s96 files."] };
  }

  const bytes = await readFileBytes(file);
  const entries = readZip(bytes);
  const projectEntry = entries.find((entry) => entry.path === "project.json");

  if (!projectEntry) {
    return { ok: false, diagnostics: ["Archive is missing project.json."] };
  }

  return parseProjectJson(textDecoder.decode(projectEntry.data));
}

function createProjectEntries(project: Risc96Project): ZipEntry[] {
  const entries: ZipEntry[] = [
    { path: "project.json", data: textEncoder.encode(serializeProjectJson(project)) },
    {
      path: "metadata/cart.json",
      data: textEncoder.encode(
        `${JSON.stringify({ version: project.version, metadata: project.metadata, settings: project.settings }, null, 2)}\n`,
      ),
    },
    {
      path: "metadata/controls.json",
      data: textEncoder.encode(`${JSON.stringify(project.controls, null, 2)}\n`),
    },
  ];

  project.scripts.forEach((script) => {
    if (script.workspace) {
      entries.push({
        path: `blockly/${script.id}.json`,
        data: textEncoder.encode(`${JSON.stringify(script.workspace, null, 2)}\n`),
      });
    }
  });

  project.sprites.forEach((sprite) => {
    if (sprite.source) {
      entries.push({ path: `assets/sprites/${sprite.id}/${sprite.source.filename}`, data: new Uint8Array(sprite.source.data) });
    }
  });

  project.sounds.forEach((sound) => {
    if (sound.source) {
      entries.push({ path: `assets/sounds/${sound.id}/${sound.source.filename}`, data: new Uint8Array(sound.source.data) });
    }
  });

  project.fonts.forEach((font) => {
    if (font.source) {
      entries.push({ path: `assets/fonts/${font.id}/${font.source.filename}`, data: new Uint8Array(font.source.data) });
    }
  });

  return entries;
}

function writeZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const path = textEncoder.encode(entry.path);
    const crc = crc32(entry.data);
    const localHeader = createHeader(30, 0x04034b50);
    const centralHeader = createHeader(46, 0x02014b50);

    writeCommonHeader(localHeader, path, entry.data, crc);
    localParts.push(localHeader, path, entry.data);

    centralHeader[4] = 20;
    centralHeader[5] = 0;
    writeCommonHeader(centralHeader, path, entry.data, crc);
    writeUint32(centralHeader, 42, offset);
    centralParts.push(centralHeader, path);

    offset += localHeader.length + path.length + entry.data.length;
  }

  const centralSize = sumLengths(centralParts);
  const end = createHeader(22, 0x06054b50);
  writeUint16(end, 8, entries.length);
  writeUint16(end, 10, entries.length);
  writeUint32(end, 12, centralSize);
  writeUint32(end, 16, offset);

  return concatBytes([...localParts, ...centralParts, end]);
}

function readZip(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && readUint32(bytes, offset) === 0x04034b50) {
    const method = readUint16(bytes, offset + 8);
    const compressedSize = readUint32(bytes, offset + 18);
    const uncompressedSize = readUint32(bytes, offset + 22);
    const nameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (method !== 0) {
      throw new Error("Only uncompressed .s96 ZIP entries are supported.");
    }

    entries.push({
      path: textDecoder.decode(bytes.slice(nameStart, nameStart + nameLength)),
      data: bytes.slice(dataStart, dataStart + uncompressedSize),
    });
    offset = dataEnd;
  }

  return entries;
}

function readFileBytes(file: File): Promise<Uint8Array> {
  if (file.arrayBuffer) {
    return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }

      reject(new Error("Project archive did not decode as bytes."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Failed to read project archive.")));
    reader.readAsArrayBuffer(file);
  });
}

function writeCommonHeader(header: Uint8Array, path: Uint8Array, data: Uint8Array, crc: number): void {
  writeUint16(header, 6, 0);
  writeUint16(header, 8, 0);
  writeUint32(header, 14, crc);
  writeUint32(header, 18, data.length);
  writeUint32(header, 22, data.length);
  writeUint16(header, 26, path.length);
}

function createHeader(length: number, signature: number): Uint8Array {
  const header = new Uint8Array(length);
  writeUint32(header, 0, signature);
  writeUint16(header, 4, 20);
  return header;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(sumLengths(parts));
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

function sumLengths(parts: Uint8Array[]): number {
  return parts.reduce((total, part) => total + part.length, 0);
}

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function safeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "scratch96-project"
  );
}
