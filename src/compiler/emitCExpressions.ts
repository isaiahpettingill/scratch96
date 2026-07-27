import type { BooleanExpression, NumericExpression, Risc96Project, StringExpression } from "../project/model.ts";
import {
  buttonConstants,
  escapeCString,
  safeIdentifier,
} from "./emitCUtil.ts";

export function emitBoolean(expression: BooleanExpression, project?: Risc96Project): string {
  switch (expression.kind) {
    case "literal":
      return expression.value ? "1" : "0";
    case "buttonDown":
      return `r96_button_down(${expression.player - 1}, ${buttonConstants[expression.button]})`;
    case "buttonPressed":
      return `r96_button_pressed(${expression.player - 1}, ${buttonConstants[expression.button]})`;
    case "buttonReleased":
      return `r96_button_released(${expression.player - 1}, ${buttonConstants[expression.button]})`;
    case "compare":
      return `${emitNumber(expression.left)} ${expression.operator} ${emitNumber(expression.right)}`;
    case "spriteTouching":
      return `r96_sprite_touching(&${safeIdentifier(expression.left)}, &${safeIdentifier(expression.right)})`;
    case "spriteTouchingTilemap":
      return emitSpriteTouchingTilemap(expression, project);
    case "and":
      return `((${emitBoolean(expression.left, project)}) && (${emitBoolean(expression.right, project)}))`;
    case "or":
      return `((${emitBoolean(expression.left, project)}) || (${emitBoolean(expression.right, project)}))`;
    case "not":
      return `(!(${emitBoolean(expression.value, project)}))`;
    case "stringContains":
      return `r96_user_contains(${emitString(expression.haystack)}, ${emitString(expression.needle)})`;
  }
}

function emitSpriteTouchingTilemap(expression: Extract<BooleanExpression, { kind: "spriteTouchingTilemap" }>, project?: Risc96Project): string {
  const tilemap = project?.tilemaps.find((candidate) => candidate.id === expression.tilemapId);
  if (!tilemap) return "0";
  const baseX = emitNumber(expression.x);
  const baseY = emitNumber(expression.y);
  const checks: string[] = [];
  for (let index = 0; index < tilemap.width * tilemap.height; index++) {
    if (!tilemap.collisionTiles?.[index]) continue;
    const col = index % tilemap.width;
    const row = Math.floor(index / tilemap.width);
    checks.push(
      `r96_sprite_touching_rect(&${safeIdentifier(expression.sprite)}, (${baseX}) + ${col * tilemap.tileWidth}, (${baseY}) + ${row * tilemap.tileHeight}, ${tilemap.tileWidth}, ${tilemap.tileHeight})`,
    );
  }
  return checks.length > 0 ? `(${checks.join(" || ")})` : "0";
}

export function emitNumber(expression: NumericExpression): string {
  switch (expression.kind) {
    case "integer":
      return String(expression.value | 0);
    case "fixed":
      return String(Math.round(expression.value * 1000));
    case "variable":
      return safeIdentifier(expression.name);
    case "random":
      return `r96_user_random(${emitNumber(expression.from)}, ${emitNumber(expression.to)})`;
    case "mathUnary":
      return emitMathUnary(expression.operator, emitNumber(expression.value));
    case "timer":
      return `(r96_tick - ${safeIdentifier(expression.timer)}_timer_start)`;
    case "frameCount":
      return "r96_tick";
    case "screenWidth":
      return "r96_user_screen_width";
    case "screenHeight":
      return "r96_user_screen_height";
    case "arrayItem":
      return `${safeIdentifier(expression.array)}[(${emitNumber(expression.index)}) & 255]`;
    case "arrayLength":
      return `${safeIdentifier(expression.array)}_length`;
    case "stringLength":
      return `r96_user_strlen(${emitString(expression.value)})`;
    case "letterOf":
      return `r96_user_letter_of(${emitString(expression.value)}, ${emitNumber(expression.index)})`;
    case "spriteX":
      return `r96_sprite_x(&${safeIdentifier(expression.sprite)})`;
    case "spriteY":
      return `r96_sprite_y(&${safeIdentifier(expression.sprite)})`;
    case "spriteWidth":
      return `${safeIdentifier(expression.sprite)}.width`;
    case "spriteHeight":
      return `${safeIdentifier(expression.sprite)}.height`;
    case "dpadAxis":
      return emitDpadAxis(expression.player, expression.axis);
    case "minMax":
      return expression.operator === "max"
        ? `r96_user_max(${emitNumber(expression.left)}, ${emitNumber(expression.right)})`
        : `r96_user_min(${emitNumber(expression.left)}, ${emitNumber(expression.right)})`;
    case "clamp":
      return `r96_user_clamp(${emitNumber(expression.value)}, ${emitNumber(expression.min)}, ${emitNumber(expression.max)})`;
    case "binary":
      return `(${emitNumber(expression.left)} ${expression.operator} ${emitNumber(expression.right)})`;
  }
}

export function emitString(expression: StringExpression): string {
  if (expression.kind === "literal") return `"${escapeCString(expression.value)}"`;
  if (expression.kind === "variable") return safeIdentifier(expression.name);
  if (expression.kind === "join") return emitString(expression.left);
  if (expression.kind === "numberToString") return `r96_user_int_to_text(${emitNumber(expression.value)})`;
  if (expression.kind === "numberToHexString") return `r96_user_int_to_hex_text(${emitNumber(expression.value)})`;
  return `""`;
}

function emitMathUnary(
  operator: Extract<NumericExpression, { kind: "mathUnary" }>["operator"],
  value: string,
): string {
  if (operator === "abs") return `r96_user_abs(${value})`;
  if (operator === "sqrt") return `r96_user_sqrt(${value})`;
  if (operator === "sin") return `r96_user_sin(${value})`;
  if (operator === "cos") return `r96_user_cos(${value})`;
  if (operator === "tan") return `r96_user_tan(${value})`;
  if (operator === "log") return `r96_user_log(${value})`;
  return `(${value})`;
}

function emitDpadAxis(player: 1 | 2 | 3 | 4, axis: "x" | "y"): string {
  const port = player - 1;
  if (axis === "x") {
    return `(r96_button_down(${port}, R96_BUTTON_RIGHT) - r96_button_down(${port}, R96_BUTTON_LEFT))`;
  }

  return `(r96_button_down(${port}, R96_BUTTON_DOWN) - r96_button_down(${port}, R96_BUTTON_UP))`;
}
