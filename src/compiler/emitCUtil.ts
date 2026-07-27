import type { Risc96Button } from "../project/model.ts";

export const buttonConstants: Record<Risc96Button, string> = {
  UP: "R96_BUTTON_UP",
  DOWN: "R96_BUTTON_DOWN",
  LEFT: "R96_BUTTON_LEFT",
  RIGHT: "R96_BUTTON_RIGHT",
  A: "R96_BUTTON_A",
  B: "R96_BUTTON_B",
  X: "R96_BUTTON_X",
  Y: "R96_BUTTON_Y",
  L: "R96_BUTTON_L",
  R: "R96_BUTTON_R",
  SELECT: "R96_BUTTON_SELECT",
  START: "R96_BUTTON_START",
};

export function indentLines(lines: string[]): string[] {
  return lines.map((line) => `  ${line}`);
}

export function spriteConstant(spriteId: string): string {
  return `SPRITE_${safeIdentifier(spriteId).toUpperCase()}`;
}

export function fontConstant(fontId: string): string {
  return `FONT_${safeIdentifier(fontId).toUpperCase()}`;
}

export function tilemapConstant(tilemapId: string): string {
  return `TILEMAP_${safeIdentifier(tilemapId).toUpperCase()}`;
}

export function soundConstant(soundId: string): string {
  return `SOUND_${safeIdentifier(soundId).toUpperCase()}`;
}

export function safeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[^a-zA-Z_]/, "_");
}

export function escapeCString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function formatHex(value: number): string {
  return `0x${value.toString(16).padStart(8, "0")}`;
}
