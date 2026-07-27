import type { DrawCommand, Risc96Project, StringValue, UpdateCommand } from "../project/model.ts";
import { emitNumber, emitString } from "./emitCExpressions.ts";
import {
  escapeCString,
  fontConstant,
  formatHex,
  indentLines,
  safeIdentifier,
  spriteConstant,
  tilemapConstant,
} from "./emitCUtil.ts";

export function emitDrawCommand(command: DrawCommand, project: Risc96Project): string[] {
  switch (command.kind) {
    case "drawText":
      return emitDrawText(command, project, 1);
    case "drawTilemap":
      return emitDrawTilemap(command, project);
    case "clearScreen":
      return [`  r96_clear_screen(${formatHex(command.color)});`];
    case "drawSprite":
      return [`  r96_draw_sprite(&${safeIdentifier(command.sprite)});`];
    case "drawSpriteFrame":
      return [
        `  r96_draw_sprite_frame(${spriteConstant(command.spriteId)}, ${command.frame}, ${emitNumber(command.x)}, ${emitNumber(command.y)});`,
      ];
    case "drawRect":
      return emitRect(command);
    case "drawLine":
      return emitLine(command);
    case "drawCircle":
      return emitCircle(command);
  }
}

export function emitDrawText(
  command: Extract<DrawCommand | UpdateCommand, { kind: "drawText" }>,
  _project: Risc96Project | undefined,
  scale: number,
): string[] {
  return [
    `  r96_draw_text(${fontConstant(command.fontId)}, ${emitStringValue(command.text)}, ${emitNumberValue(command.x)}, ${emitNumberValue(command.y)}, ${scale}, ${formatHex(command.color)});`,
  ];
}

function emitStringValue(value: StringValue): string {
  return typeof value === "string" ? `"${escapeCString(value)}"` : emitString(value);
}

export function emitDrawTilemap(
  command: Extract<DrawCommand | UpdateCommand, { kind: "drawTilemap" }>,
  project: Risc96Project | undefined,
): string[] {
  const tilemap = project?.tilemaps.find((candidate) => candidate.id === command.tilemapId);
  if (tilemap && typeof command.x === "number" && typeof command.y === "number") {
    const lines: string[] = [];
    for (let row = 0; row < tilemap.height; row++) {
      for (let col = 0; col < tilemap.width; col++) {
        const frame = tilemap.tiles[row * tilemap.width + col] ?? 0;
        lines.push(
          `  r96_draw_sprite_frame(${spriteConstant(tilemap.tilesetSpriteId)}, ${frame}, ${command.x + col * tilemap.tileWidth}, ${command.y + row * tilemap.tileHeight});`,
        );
      }
    }
    return lines;
  }

  return [
    `  r96_user_draw_tilemap(${tilemapConstant(command.tilemapId)}, ${emitNumberValue(command.x)}, ${emitNumberValue(command.y)});`,
  ];
}

function emitRect(command: Extract<DrawCommand, { kind: "drawRect" }>): string[] {
  const x = emitNumber(command.x);
  const y = emitNumber(command.y);
  const width = emitNumber(command.width);
  const height = emitNumber(command.height);
  const color = formatHex(command.color);

  if (command.filled) {
    return indentLines([
      "{",
      "volatile r96_u32_t *r96_fb = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);",
      `for (int r96_y = ${y}; r96_y < ${y} + ${height}; r96_y++) {`,
      `  for (int r96_x = ${x}; r96_x < ${x} + ${width}; r96_x++) {`,
      `    r96_fb[r96_y * RISC96_FRAMEBUFFER_PITCH_PIXELS + r96_x] = ${color};`,
      "  }",
      "}",
      "}",
    ]);
  }

  return indentLines([
    "{",
    "volatile r96_u32_t *r96_fb = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);",
    `for (int r96_x = ${x}; r96_x < ${x} + ${width}; r96_x++) {`,
    `  r96_fb[${y} * RISC96_FRAMEBUFFER_PITCH_PIXELS + r96_x] = ${color};`,
    `  r96_fb[(${y} + ${height} - 1) * RISC96_FRAMEBUFFER_PITCH_PIXELS + r96_x] = ${color};`,
    "}",
    `for (int r96_y = ${y}; r96_y < ${y} + ${height}; r96_y++) {`,
    `  r96_fb[r96_y * RISC96_FRAMEBUFFER_PITCH_PIXELS + ${x}] = ${color};`,
    `  r96_fb[r96_y * RISC96_FRAMEBUFFER_PITCH_PIXELS + ${x} + ${width} - 1] = ${color};`,
    "}",
    "}",
  ]);
}

function emitLine(command: Extract<DrawCommand, { kind: "drawLine" }>): string[] {
  return indentLines([
    "{",
    "volatile r96_u32_t *r96_fb = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);",
    `int r96_x = ${emitNumber(command.x1)};`,
    `int r96_y = ${emitNumber(command.y1)};`,
    `int r96_x2 = ${emitNumber(command.x2)};`,
    `int r96_y2 = ${emitNumber(command.y2)};`,
    "int r96_dx = r96_x2 > r96_x ? r96_x2 - r96_x : r96_x - r96_x2;",
    "int r96_sx = r96_x < r96_x2 ? 1 : -1;",
    "int r96_dy = r96_y2 > r96_y ? r96_y2 - r96_y : r96_y - r96_y2;",
    "int r96_sy = r96_y < r96_y2 ? 1 : -1;",
    "int r96_err = r96_dx - r96_dy;",
    "for (;;) {",
    `  r96_fb[r96_y * RISC96_FRAMEBUFFER_PITCH_PIXELS + r96_x] = ${formatHex(command.color)};`,
    "  if (r96_x == r96_x2 && r96_y == r96_y2) break;",
    "  int r96_err2 = r96_err * 2;",
    "  if (r96_err2 > (0 - r96_dy)) { r96_err -= r96_dy; r96_x += r96_sx; }",
    "  if (r96_err2 < r96_dx) { r96_err += r96_dx; r96_y += r96_sy; }",
    "}",
    "}",
  ]);
}

function emitCircle(command: Extract<DrawCommand, { kind: "drawCircle" }>): string[] {
  const x = emitNumber(command.x);
  const y = emitNumber(command.y);
  const radius = emitNumber(command.radius);
  return indentLines([
    "{",
    "volatile r96_u32_t *r96_fb = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);",
    `int r96_cx = ${x};`,
    `int r96_cy = ${y};`,
    `int r96_radius = ${radius};`,
    "int r96_radius2 = r96_radius * r96_radius;",
    "for (int r96_py = 0 - r96_radius; r96_py <= r96_radius; r96_py++) {",
    "  for (int r96_px = 0 - r96_radius; r96_px <= r96_radius; r96_px++) {",
    "    int r96_dist2 = r96_px * r96_px + r96_py * r96_py;",
    command.filled
      ? `    if (r96_dist2 <= r96_radius2) r96_fb[(r96_cy + r96_py) * RISC96_FRAMEBUFFER_PITCH_PIXELS + r96_cx + r96_px] = ${formatHex(command.color)};`
      : `    if (r96_dist2 <= r96_radius2 && r96_dist2 >= (r96_radius - 1) * (r96_radius - 1)) r96_fb[(r96_cy + r96_py) * RISC96_FRAMEBUFFER_PITCH_PIXELS + r96_cx + r96_px] = ${formatHex(command.color)};`,
    "  }",
    "}",
    "}",
  ]);
}

function emitNumberValue(value: number | Parameters<typeof emitNumber>[0]): string {
  return typeof value === "number" ? String(value) : emitNumber(value);
}
