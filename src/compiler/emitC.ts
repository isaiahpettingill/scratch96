import type {
  BooleanExpression,
  DrawCommand,
  NumericExpression,
  Risc96Project,
  StartCommand,
  StringExpression,
  StringValue,
  UpdateCommand,
} from "../project/model.ts";
import { emitAssetsHeader } from "./emitAssets.ts";
import {
  collectArrays,
  collectScalarVariables,
  collectSpriteVariables,
  collectTextHandles,
  collectTextVariables,
  collectTimers,
} from "./emitCCollectors.ts";
import { emitDrawCommand, emitDrawText, emitDrawTilemap } from "./emitCDraw.ts";
import { emitBoolean, emitNumber, emitString } from "./emitCExpressions.ts";
import {
  buttonConstants,
  escapeCString,
  fontConstant,
  formatHex,
  indentLines,
  safeIdentifier,
  soundConstant,
  spriteConstant,
} from "./emitCUtil.ts";
import { getSdkSourceFiles } from "./sdkSources.ts";
import { validateProject } from "./validateProject.ts";

export type CompileResult = {
  source: string;
  assetsHeader: string;
  files: GeneratedSourceFile[];
  diagnostics: string[];
};

export type GeneratedSourceFile = {
  path: string;
  contents: string;
};

export function compileProjectToC(project: Risc96Project): CompileResult {
  const diagnostics = validateProject(project);
  const assetsHeader = emitAssetsHeader(project);
  const spriteVariables = collectSpriteVariables(project);
  const eventScripts = project.scripts.flatMap((script) => script.blocks.events ?? []);
  const buttonEventScripts = project.scripts.flatMap((script) => script.blocks.buttonEvents ?? []);
  const timerScripts = project.scripts.flatMap((script) => script.blocks.timerEvents ?? []);
  const timers = collectTimers(project);
  const lines: string[] = [];

  lines.push('#include "risc96_blockly_runtime.h"');
  lines.push('#include "generated_assets.h"');
  lines.push("");

  for (const variable of spriteVariables) {
    lines.push(`static r96_sprite_t ${safeIdentifier(variable)};`);
  }

  for (const variable of collectScalarVariables(project)) {
    lines.push(`static int ${safeIdentifier(variable)};`);
  }

  for (const array of collectArrays(project)) {
    lines.push(`static int ${safeIdentifier(array)}[256];`);
    lines.push(`static int ${safeIdentifier(array)}_length;`);
  }

  for (const variable of collectTextVariables(project)) {
    lines.push(`static char ${safeIdentifier(variable.name)}[${variable.length + 1}];`);
  }

  lines.push(`static int r96_user_screen_width = ${project.settings.width};`);
  lines.push(`static int r96_user_screen_height = ${project.settings.height};`);
  lines.push("static int r96_tick;");
  lines.push("static int r96_sound_tempo = 120;");
  if (needsHelpers(project)) lines.push("static unsigned int r96_random_seed = 2463534242u;");

  for (const timer of timers) {
    lines.push(`static int ${safeIdentifier(timer)}_timer_start;`);
  }

  for (const handle of collectTextHandles(project)) {
    lines.push(`static r96_text_handle_t ${safeIdentifier(handle)};`);
  }

  lines.push("");
  if (needsHelpers(project)) {
    lines.push(...emitHelperFunctions());
    lines.push("");
  }
  if (needsTilemapCollisionRectHelper(project)) {
    lines.push(...emitTilemapCollisionRectHelper());
    lines.push("");
  }
  if (needsTilemapDrawHelper(project)) {
    lines.push(...emitTilemapDrawHelper());
    lines.push("");
  }
  lines.push("void r96_user_start(void) {");
  if (!hasSetupResolution(project)) {
    lines.push(`  r96_set_resolution(${project.settings.width}, ${project.settings.height});`);
  }

  for (const command of project.scripts.flatMap((script) => script.blocks.start)) {
    lines.push(...emitStartCommand(command, eventScripts));
  }

  lines.push("}");
  lines.push("");
  lines.push("void r96_user_update(void) {");
  lines.push("  r96_tick++;");

  for (const command of project.scripts.flatMap((script) => script.blocks.update)) {
    lines.push(...emitUpdateCommand(command, eventScripts, project));
  }

  for (const eventScript of eventScripts) {
    lines.push(
      ...emitBlock(
        `if (r96_event_poll("${escapeCString(eventScript.event)}"))`,
        eventScript.commands,
        eventScripts,
        project,
      ),
    );
  }

  for (const buttonEventScript of buttonEventScripts) {
    lines.push(
      ...emitBlock(
        `if (r96_button_down(${buttonEventScript.player - 1}, ${buttonConstants[buttonEventScript.button]}))`,
        buttonEventScript.commands,
        eventScripts,
        project,
      ),
    );
  }

  for (const timerScript of timerScripts) {
    lines.push(
      ...emitBlock(
        `if ((r96_tick - ${safeIdentifier(timerScript.timer)}_timer_start) > ${timerScript.ticks})`,
        timerScript.commands,
        eventScripts,
        project,
      ),
    );
  }

  lines.push("}");
  lines.push("");
  lines.push("void r96_user_draw(void) {");

  for (const command of project.scripts.flatMap((script) => script.blocks.draw ?? [])) {
    lines.push(...emitDrawCommand(command, project));
  }

  lines.push("}");
  lines.push("");
  lines.push("void _start(void) {");
  lines.push("  r96_engine_main();");
  lines.push("}");

  const source = lines.join("\n");

  return {
    source,
    assetsHeader,
    files: [
      getSdkSourceFiles()[0],
      { path: "generated_assets.h", contents: assetsHeader },
      ...getSdkSourceFiles().slice(1),
      { path: "main.c", contents: source },
    ],
    diagnostics,
  };
}

function emitHelperFunctions(): string[] {
  return [
    "static int r96_user_abs(int value) { return value < 0 ? -value : value; }",
    "static int r96_user_sqrt(int value) { int result = 0; while ((result + 1) * (result + 1) <= value) result++; return result; }",
    "static int r96_user_random(int from, int to) { r96_random_seed = r96_random_seed * 1103515245u + 12345u; if (to < from) { int tmp = from; from = to; to = tmp; } return from + (int)((r96_random_seed >> 16) % (unsigned int)(to - from + 1)); }",
    "static int r96_user_min(int left, int right) { return left < right ? left : right; }",
    "static int r96_user_max(int left, int right) { return left > right ? left : right; }",
    "static int r96_user_clamp(int value, int min, int max) { if (max < min) { int tmp = min; min = max; max = tmp; } if (value < min) return min; if (value > max) return max; return value; }",
    "static int r96_user_cos(int degrees) { int index = (((degrees % 360) + 360) % 360) / 15; switch (index) { case 0: return 1000; case 1: return 966; case 2: return 866; case 3: return 707; case 4: return 500; case 5: return 259; case 6: return 0; case 7: return -259; case 8: return -500; case 9: return -707; case 10: return -866; case 11: return -966; case 12: return -1000; case 13: return -966; case 14: return -866; case 15: return -707; case 16: return -500; case 17: return -259; case 18: return 0; case 19: return 259; case 20: return 500; case 21: return 707; case 22: return 866; default: return 966; } }",
    "static int r96_user_sin(int degrees) { return r96_user_cos(degrees - 90); }",
    "static int r96_user_tan(int degrees) { int index = (((degrees % 180) + 180) % 180) / 15; switch (index) { case 0: return 0; case 1: return 268; case 2: return 577; case 3: return 1000; case 4: return 1732; case 5: return 3732; case 6: return 0; case 7: return -3732; case 8: return -1732; case 9: return -1000; case 10: return -577; default: return -268; } }",
    "static int r96_user_log(int value) { if (value <= 1) return 0; if (value == 2) return 693; if (value == 3) return 1099; if (value == 4) return 1386; if (value == 5) return 1609; if (value == 6) return 1792; if (value == 7) return 1946; if (value == 8) return 2079; if (value == 9) return 2197; if (value == 10) return 2303; if (value == 11) return 2398; if (value == 12) return 2485; if (value == 13) return 2565; if (value == 14) return 2639; if (value == 15) return 2708; return 2773; }",
    "static int r96_user_strlen(const char *value) { int length = 0; while (value[length] != 0) length++; return length; }",
    "static int r96_user_letter_of(const char *value, int index) { if (index < 0) return 0; for (int i = 0; value[i] != 0; i++) if (i == index) return value[i]; return 0; }",
    "static int r96_user_contains(const char *haystack, const char *needle) { if (needle[0] == 0) return 1; for (int i = 0; haystack[i] != 0; i++) { int j = 0; while (needle[j] != 0 && haystack[i + j] == needle[j]) j++; if (needle[j] == 0) return 1; } return 0; }",
    "static void r96_user_copy_text(char *target, int target_size, const char *source) { int i = 0; if (target_size <= 0) return; while (i < target_size - 1 && source[i] != 0) { target[i] = source[i]; i++; } target[i] = 0; }",
    "static const char *r96_user_int_to_text(int value) { static char buffers[4][16]; static int slot; char *buffer = buffers[slot++ & 3]; int negative = value < 0; unsigned int current = negative ? (unsigned int)(-value) : (unsigned int)value; int i = 14; buffer[15] = 0; do { buffer[i--] = (char)('0' + (current % 10)); current /= 10; } while (current != 0 && i >= 0); if (negative && i >= 0) buffer[i--] = '-'; return &buffer[i + 1]; }",
    "static const char *r96_user_int_to_hex_text(int value) { static char buffers[4][11]; static int slot; char *buffer = buffers[slot++ & 3]; const char *digits = \"0123456789ABCDEF\"; unsigned int current = (unsigned int)value; buffer[0] = '0'; buffer[1] = 'x'; for (int i = 0; i < 8; i++) buffer[2 + i] = digits[(current >> ((7 - i) * 4)) & 15]; buffer[10] = 0; return buffer; }",
  ];
}

function hasSetupResolution(project: Risc96Project): boolean {
  return project.scripts.some((script) =>
    script.blocks.start.some((command) => command.kind === "setResolution"),
  );
}

function needsHelpers(project: Risc96Project): boolean {
  for (const script of project.scripts) {
    for (const command of script.blocks.start) if (startCommandNeedsHelpers(command)) return true;
    for (const command of script.blocks.update) if (commandNeedsHelpers(command)) return true;
    for (const eventScript of script.blocks.events ?? [])
      for (const command of eventScript.commands) if (commandNeedsHelpers(command)) return true;
    for (const buttonEventScript of script.blocks.buttonEvents ?? [])
      for (const command of buttonEventScript.commands)
        if (commandNeedsHelpers(command)) return true;
    for (const timerScript of script.blocks.timerEvents ?? [])
      for (const command of timerScript.commands) if (commandNeedsHelpers(command)) return true;
    for (const procedure of script.blocks.procedures ?? [])
      for (const command of procedure.commands) if (commandNeedsHelpers(command)) return true;
    for (const command of script.blocks.draw ?? [])
      if (drawCommandNeedsHelpers(command)) return true;
  }
  return false;
}

function startCommandNeedsHelpers(command: StartCommand): boolean {
  return command.kind === "initTextVariable";
}

function commandNeedsHelpers(command: UpdateCommand): boolean {
  if (command.kind === "initTextVariable") return true;
  if (command.kind === "drawText") return stringValueNeedsHelpers(command.text);
  if (
    command.kind === "setVariable" ||
    command.kind === "setSpriteX" ||
    command.kind === "setSpriteY"
  )
    return expressionNeedsHelpers(command.value);
  if (
    command.kind === "setArrayItem" ||
    command.kind === "insertArrayItem" ||
    command.kind === "replaceArrayItem"
  )
    return expressionNeedsHelpers(command.index) || expressionNeedsHelpers(command.value);
  if (command.kind === "addArrayItem") return expressionNeedsHelpers(command.value);
  if (command.kind === "deleteArrayItem") return expressionNeedsHelpers(command.index);
  if (command.kind === "moveSprite")
    return expressionNeedsHelpers(command.dx) || expressionNeedsHelpers(command.dy);
  if (command.kind === "setSpritePosition")
    return expressionNeedsHelpers(command.x) || expressionNeedsHelpers(command.y);
  if (command.kind === "pointSpriteDirection") return expressionNeedsHelpers(command.direction);
  if (command.kind === "turnSprite") return expressionNeedsHelpers(command.degrees);
  if (command.kind === "setSpriteScale") return expressionNeedsHelpers(command.scale);
  if (command.kind === "changeSpriteScale") return expressionNeedsHelpers(command.amount);
  if (command.kind === "setSpriteEffect") return expressionNeedsHelpers(command.value);
  if (command.kind === "if")
    return (
      booleanNeedsHelpers(command.condition) ||
      command.thenCommands.some(commandNeedsHelpers) ||
      command.elseCommands.some(commandNeedsHelpers)
    );
  if (command.kind === "while" || command.kind === "doWhile")
    return booleanNeedsHelpers(command.condition) || command.commands.some(commandNeedsHelpers);
  if (command.kind === "waitUntil" || command.kind === "repeatUntil")
    return (
      booleanNeedsHelpers(command.condition) ||
      ("commands" in command && command.commands.some(commandNeedsHelpers))
    );
  if (command.kind === "repeat")
    return expressionNeedsHelpers(command.times) || command.commands.some(commandNeedsHelpers);
  if (command.kind === "everyFrames")
    return expressionNeedsHelpers(command.frames) || command.commands.some(commandNeedsHelpers);
  if (command.kind === "for" || command.kind === "onEvent")
    return command.commands.some(commandNeedsHelpers);
  return false;
}

function drawCommandNeedsHelpers(command: DrawCommand): boolean {
  if (command.kind === "drawSpriteFrame") return expressionNeedsHelpers(command.x) || expressionNeedsHelpers(command.y);
  if (command.kind === "drawText") {
    return stringValueNeedsHelpers(command.text) || expressionValueNeedsHelpers(command.x) || expressionValueNeedsHelpers(command.y);
  }
  if (command.kind === "drawTilemap") {
    return expressionValueNeedsHelpers(command.x) || expressionValueNeedsHelpers(command.y);
  }
  if (command.kind === "drawRect")
    return [command.x, command.y, command.width, command.height].some(expressionNeedsHelpers);
  if (command.kind === "drawLine")
    return [command.x1, command.y1, command.x2, command.y2].some(expressionNeedsHelpers);
  if (command.kind === "drawCircle")
    return [command.x, command.y, command.radius].some(expressionNeedsHelpers);
  return false;
}

function stringValueNeedsHelpers(value: StringValue): boolean {
  return typeof value !== "string" && stringNeedsHelpers(value);
}

function stringNeedsHelpers(expression: StringExpression): boolean {
  if (expression.kind === "variable" || expression.kind === "numberToString" || expression.kind === "numberToHexString" || expression.kind === "join") return true;
  return false;
}

function expressionValueNeedsHelpers(expression: NumericExpression | number): boolean {
  return typeof expression !== "number" && expressionNeedsHelpers(expression);
}

function expressionNeedsHelpers(expression: NumericExpression): boolean {
  if (
    expression.kind === "random" ||
    expression.kind === "mathUnary" ||
    expression.kind === "minMax" ||
    expression.kind === "clamp" ||
    expression.kind === "stringLength" ||
    expression.kind === "letterOf"
  )
    return true;
  if (expression.kind === "arrayItem") return expressionNeedsHelpers(expression.index);
  if (expression.kind === "binary")
    return expressionNeedsHelpers(expression.left) || expressionNeedsHelpers(expression.right);
  return false;
}

function booleanNeedsHelpers(expression: BooleanExpression): boolean {
  if (expression.kind === "stringContains") return true;
  if (expression.kind === "compare")
    return expressionNeedsHelpers(expression.left) || expressionNeedsHelpers(expression.right);
  if (expression.kind === "spriteTouchingTilemap")
    return expressionNeedsHelpers(expression.x) || expressionNeedsHelpers(expression.y);
  if (expression.kind === "and" || expression.kind === "or")
    return booleanNeedsHelpers(expression.left) || booleanNeedsHelpers(expression.right);
  if (expression.kind === "not") return booleanNeedsHelpers(expression.value);
  return false;
}

function needsTilemapCollisionRectHelper(project: Risc96Project): boolean {
  return project.scripts.some((script) =>
    [
      ...script.blocks.update,
      ...(script.blocks.events ?? []).flatMap((event) => event.commands),
      ...(script.blocks.buttonEvents ?? []).flatMap((event) => event.commands),
      ...(script.blocks.timerEvents ?? []).flatMap((timer) => timer.commands),
      ...(script.blocks.procedures ?? []).flatMap((procedure) => procedure.commands),
    ].some(commandUsesTilemapCollision),
  );
}

function needsTilemapDrawHelper(project: Risc96Project): boolean {
  return project.scripts.some((script) =>
    [
      ...script.blocks.update,
      ...(script.blocks.draw ?? []),
      ...(script.blocks.events ?? []).flatMap((event) => event.commands),
      ...(script.blocks.buttonEvents ?? []).flatMap((event) => event.commands),
      ...(script.blocks.timerEvents ?? []).flatMap((timer) => timer.commands),
      ...(script.blocks.procedures ?? []).flatMap((procedure) => procedure.commands),
    ].some(commandUsesTilemapDraw),
  );
}

function commandUsesTilemapDraw(command: UpdateCommand | DrawCommand): boolean {
  if (command.kind === "drawTilemap") return typeof command.x !== "number" || typeof command.y !== "number";
  if (command.kind === "if") return command.thenCommands.some(commandUsesTilemapDraw) || command.elseCommands.some(commandUsesTilemapDraw);
  if ("commands" in command) return command.commands.some(commandUsesTilemapDraw);
  return false;
}

function commandUsesTilemapCollision(command: UpdateCommand): boolean {
  if ("condition" in command && booleanUsesTilemapCollision(command.condition)) return true;
  if (command.kind === "if") return command.thenCommands.some(commandUsesTilemapCollision) || command.elseCommands.some(commandUsesTilemapCollision);
  if ("commands" in command) return command.commands.some(commandUsesTilemapCollision);
  return false;
}

function booleanUsesTilemapCollision(expression: BooleanExpression): boolean {
  if (expression.kind === "spriteTouchingTilemap") return true;
  if (expression.kind === "and" || expression.kind === "or") return booleanUsesTilemapCollision(expression.left) || booleanUsesTilemapCollision(expression.right);
  if (expression.kind === "not") return booleanUsesTilemapCollision(expression.value);
  return false;
}

function emitTilemapCollisionRectHelper(): string[] {
  return [
    "int r96_sprite_touching_rect(const r96_sprite_t *sprite, int x, int y, int width, int height) {",
    "  if (!sprite->visible) return 0;",
    "  const r96_sprite_def_t *sprite_def = &r96_sprite_defs[sprite->id];",
    "  r96_rect_collider_t rect = {0, 0, width, height};",
    "  for (int ci = 0; ci < sprite_def->collider_count; ci++) {",
    "    if (r96_rects_overlap(sprite->x, sprite->y, &sprite_def->colliders[ci], x, y, &rect)) return 1;",
    "  }",
    "  return 0;",
    "}",
  ];
}

function emitTilemapDrawHelper(): string[] {
  return [
    "static void r96_user_draw_tilemap(int tilemap_id, int x, int y) {",
    "  const r96_tilemap_def_t *tilemap = &r96_tilemap_defs[tilemap_id];",
    "  for (int row = 0; row < tilemap->height; row++) {",
    "    for (int col = 0; col < tilemap->width; col++) {",
    "      int frame = tilemap->tiles[row * tilemap->width + col];",
    "      r96_draw_sprite_frame(tilemap->tileset_sprite_id, frame, x + col * tilemap->tile_width, y + row * tilemap->tile_height);",
    "    }",
    "  }",
    "}",
  ];
}

function emitStartCommand(
  command: StartCommand,
  eventScripts: NonNullable<SerializedEventScripts>,
): string[] {
  switch (command.kind) {
    case "setResolution":
      return [
        `  r96_user_screen_width = ${command.width};`,
        `  r96_user_screen_height = ${command.height};`,
        `  r96_set_resolution(${command.width}, ${command.height});`,
      ];
    case "debugLog":
      return [`  r96_debug_log_cstr("${escapeCString(command.text)}\\n");`];
    case "initTextVariable":
      return [`  r96_user_copy_text(${safeIdentifier(command.variable)}, sizeof(${safeIdentifier(command.variable)}), ${emitString(command.value)});`];
    case "setBackground":
      return [`  r96_stage_set_background(${formatHex(command.color)});`];
    case "setClearColor":
      return [`  r96_stage_set_background(${formatHex(command.color)});`];
    case "createSprite":
      return [
        `  ${safeIdentifier(command.variable)} = r96_sprite_create(${spriteConstant(command.spriteId)}, ${command.x}, ${command.y});`,
      ];
    case "setSpriteFrame":
      return [`  r96_sprite_set_frame(&${safeIdentifier(command.variable)}, ${command.frame});`];
    case "broadcastAndWait":
      return emitMatchingEventScripts(command.event, eventScripts).map((line) => `  ${line}`);
    case "publishEvent":
      return [`  r96_event_publish("${escapeCString(command.event)}");`];
    case "onEvent":
      return emitEventHandler(command.event, command.commands);
  }
}

type SerializedEventScripts = Risc96Project["scripts"][number]["blocks"]["events"];

function emitUpdateCommand(
  command: UpdateCommand,
  eventScripts: NonNullable<SerializedEventScripts> = [],
  project?: Risc96Project,
): string[] {
  switch (command.kind) {
    case "debugLog":
      if (command.text === "__r96_yield__") return ["  r96_yield_tick();"];
      return [`  r96_debug_log_cstr("${escapeCString(command.text)}\\n");`];
    case "yieldFrame":
      return ["  r96_yield_tick();"];
    case "moveSpriteIfButtonDown":
      return [
        `  if (r96_button_down(${command.player - 1}, ${buttonConstants[command.button]})) {`,
        `    r96_sprite_move(&${safeIdentifier(command.variable)}, ${command.dx}, ${command.dy});`,
        "  }",
      ];
    case "setSpriteFrame":
      return [`  r96_sprite_set_frame(&${safeIdentifier(command.variable)}, ${command.frame});`];
    case "playSpriteAnimation":
      return emitSpriteAnimation(command.sprite, command.animation, project);
    case "switchFrame":
      return [`  r96_sprite_set_frame(&${safeIdentifier(command.sprite)}, ${command.frame});`];
    case "showSprite":
      return [`  r96_sprite_show(&${safeIdentifier(command.sprite)});`];
    case "hideSprite":
      return [`  r96_sprite_hide(&${safeIdentifier(command.sprite)});`];
    case "playSound":
      return [`  r96_play_sound(${soundConstant(command.soundId)});`];
    case "playSoundAndWait":
      return [
        `  r96_play_sound(${soundConstant(command.soundId)});`,
        ...emitWaitTicks(command.ticks),
      ];
    case "stopAllSounds":
      return ["  r96_stop_all_sounds();"];
    case "setSoundTempo":
      return [`  r96_sound_tempo = ${command.bpm};`];
    case "changeSoundTempo":
      return [`  r96_sound_tempo += ${command.amount};`];
    case "wait":
      return emitWaitTicks(command.ticks);
    case "waitUntil":
      return emitBlock(
        `while (!(${emitBoolean(command.condition, project)}))`,
        [{ kind: "debugLog", text: "__r96_yield__" }],
        eventScripts,
        project,
      );
    case "repeat":
      return indentLines([
        "{",
        "int r96_repeat = 0;",
        `while (r96_repeat < ${emitNumber(command.times)}) {`,
        ...emitCommands(command.commands, eventScripts, project),
        "r96_repeat++;",
        "r96_yield_tick();",
        "}",
        "}",
      ]);
    case "repeatUntil":
      return emitBlock(
        `while (!(${emitBoolean(command.condition, project)}))`,
        [...command.commands, { kind: "debugLog", text: "__r96_yield__" }],
        eventScripts,
        project,
      );
    case "stopEverything":
      return ["  r96_stop_all_sounds();", "  for (;;) { r96_yield_tick(); }"];
    case "resetTimer":
      return [`  ${safeIdentifier(command.timer)}_timer_start = r96_tick;`];
    case "initTextVariable":
      return [`  r96_user_copy_text(${safeIdentifier(command.variable)}, sizeof(${safeIdentifier(command.variable)}), ${emitString(command.value)});`];
    case "incrementVariable":
      return [`  ${safeIdentifier(command.variable)} += ${command.amount};`];
    case "decrementVariable":
      return [`  ${safeIdentifier(command.variable)} -= ${command.amount};`];
    case "setVariable":
      return [`  ${safeIdentifier(command.variable)} = ${emitNumber(command.value)};`];
    case "setArrayItem":
      return [
        `  ${safeIdentifier(command.array)}[(${emitNumber(command.index)}) & 255] = ${emitNumber(command.value)};`,
        `  if (${safeIdentifier(command.array)}_length <= ((${emitNumber(command.index)}) & 255)) ${safeIdentifier(command.array)}_length = ((${emitNumber(command.index)}) & 255) + 1;`,
      ];
    case "addArrayItem":
      return [
        `  if (${safeIdentifier(command.array)}_length < 256) ${safeIdentifier(command.array)}[${safeIdentifier(command.array)}_length++] = ${emitNumber(command.value)};`,
      ];
    case "deleteArrayItem":
      return emitDeleteArrayItem(command.array, emitNumber(command.index));
    case "insertArrayItem":
      return emitInsertArrayItem(
        command.array,
        emitNumber(command.index),
        emitNumber(command.value),
      );
    case "replaceArrayItem":
      return [
        `  ${safeIdentifier(command.array)}[(${emitNumber(command.index)}) & 255] = ${emitNumber(command.value)};`,
      ];
    case "clearArray":
      return [`  ${safeIdentifier(command.array)}_length = 0;`];
    case "setVariableToSpriteX":
      return [
        `  ${safeIdentifier(command.variable)} = r96_sprite_x(&${safeIdentifier(command.sprite)});`,
      ];
    case "setVariableToSpriteY":
      return [
        `  ${safeIdentifier(command.variable)} = r96_sprite_y(&${safeIdentifier(command.sprite)});`,
      ];
    case "createSprite":
      return [
        `  ${safeIdentifier(command.variable)} = r96_sprite_create(${spriteConstant(command.spriteId)}, ${command.x}, ${command.y});`,
      ];
    case "moveSprite":
      return [
        `  r96_sprite_move(&${safeIdentifier(command.sprite)}, ${emitNumber(command.dx)}, ${emitNumber(command.dy)});`,
      ];
    case "setSpriteX":
      return [
        `  r96_sprite_set_position(&${safeIdentifier(command.sprite)}, ${emitNumber(command.value)}, r96_sprite_y(&${safeIdentifier(command.sprite)}));`,
      ];
    case "setSpriteY":
      return [
        `  r96_sprite_set_position(&${safeIdentifier(command.sprite)}, r96_sprite_x(&${safeIdentifier(command.sprite)}), ${emitNumber(command.value)});`,
      ];
    case "setSpritePosition":
      return [
        `  r96_sprite_set_position(&${safeIdentifier(command.sprite)}, ${emitNumber(command.x)}, ${emitNumber(command.y)});`,
      ];
    case "goToSprite":
      return [
        `  r96_sprite_set_position(&${safeIdentifier(command.sprite)}, r96_sprite_x(&${safeIdentifier(command.target)}), r96_sprite_y(&${safeIdentifier(command.target)}));`,
      ];
    case "pointSpriteDirection":
      return [`  ${safeIdentifier(command.sprite)}.direction = ${emitNumber(command.direction)};`];
    case "turnSprite":
      return [`  ${safeIdentifier(command.sprite)}.direction += ${emitNumber(command.degrees)};`];
    case "setSpriteScale":
      return [`  ${safeIdentifier(command.sprite)}.scale = ${emitNumber(command.scale)};`];
    case "changeSpriteScale":
      return [`  ${safeIdentifier(command.sprite)}.scale += ${emitNumber(command.amount)};`];
    case "setSpriteEffect":
      return [
        `  ${safeIdentifier(command.sprite)}.effect_kind = ${command.effect === "invert" ? 1 : 0};`,
        `  ${safeIdentifier(command.sprite)}.effect_value = ${emitNumber(command.value)};`,
      ];
    case "clearSpriteEffects":
      return [
        `  ${safeIdentifier(command.sprite)}.effect_kind = 0;`,
        `  ${safeIdentifier(command.sprite)}.effect_value = 0;`,
      ];
    case "bringSpriteToFront":
      return [`  /* ${safeIdentifier(command.sprite)} layer front requested */`];
    case "sendSpriteToBack":
      return [`  /* ${safeIdentifier(command.sprite)} layer back requested */`];
    case "createClone":
      return [
        `  ${safeIdentifier(command.variable)} = r96_sprite_create(${safeIdentifier(command.source)}.id, r96_sprite_x(&${safeIdentifier(command.source)}), r96_sprite_y(&${safeIdentifier(command.source)}));`,
        `  r96_sprite_set_frame(&${safeIdentifier(command.variable)}, ${safeIdentifier(command.source)}.frame);`,
      ];
    case "deleteClone":
      return [`  r96_sprite_hide(&${safeIdentifier(command.sprite)});`];
    case "drawText":
      return emitDrawText(command, project, 1);
    case "clearScreen":
      return [`  r96_clear_screen(${formatHex(command.color)});`];
    case "drawSprite":
      return [`  r96_draw_sprite(&${safeIdentifier(command.sprite)});`];
    case "writeText":
      return [
        `  ${safeIdentifier(command.handle)} = r96_text_write(${fontConstant(command.fontId)}, "${escapeCString(command.text)}", ${command.x}, ${command.y}, ${command.scale}, ${formatHex(command.color)});`,
      ];
    case "eraseText":
      return [`  r96_text_erase(&${safeIdentifier(command.handle)});`];
    case "moveText":
      return [
        `  r96_text_move(&${safeIdentifier(command.handle)}, ${emitNumber(command.dx)}, ${emitNumber(command.dy)});`,
      ];
    case "setTextPosition":
      return [
        `  r96_text_set_position(&${safeIdentifier(command.handle)}, ${emitNumber(command.x)}, ${emitNumber(command.y)});`,
      ];
    case "drawTilemap":
      return emitDrawTilemap(command, project);
    case "if":
      return emitBlockWithBranches(
        `if (${emitBoolean(command.condition, project)})`,
        command.thenCommands,
        command.elseCommands,
        eventScripts,
        project,
      );
    case "while":
      return emitBlock(
        `while (${emitBoolean(command.condition, project)})`,
        [...command.commands, { kind: "debugLog", text: "__r96_yield__" }],
        eventScripts,
        project,
      );
    case "doWhile":
      return [
        ...indentLines([
          "do {",
          ...emitCommands(
            [...command.commands, { kind: "debugLog", text: "__r96_yield__" }],
            eventScripts,
            project,
          ),
          `} while (${emitBoolean(command.condition, project)});`,
        ]),
      ];
    case "for":
      return emitBlock(
        `for (${safeIdentifier(command.variable)} = ${command.from}; ${safeIdentifier(command.variable)} <= ${command.to}; ${safeIdentifier(command.variable)} += ${command.step || 1})`,
        [...command.commands, { kind: "debugLog", text: "__r96_yield__" }],
        eventScripts,
        project,
      );
    case "everyFrames": {
      const frames = emitNumber(command.frames);
      return emitBlock(
        `if ((${frames}) > 0 && (r96_tick % (${frames})) == 0)`,
        command.commands,
        eventScripts,
        project,
      );
    }
    case "break":
      return ["  break;"];
    case "continue":
      return ["  continue;"];
    case "publishEvent":
      return [`  r96_event_publish("${escapeCString(command.event)}");`];
    case "broadcastAndWait":
      return emitMatchingEventScripts(command.event, eventScripts, project).map(
        (line) => `  ${line}`,
      );
    case "callProcedure":
      return emitProcedure(command.name, project, eventScripts).map((line) => `  ${line}`);
    case "onEvent":
      return emitEventHandler(command.event, command.commands);
  }
}

function emitWaitTicks(ticks: number): string[] {
  return [
    `  for (int r96_wait = 0; r96_wait < ${Math.max(0, ticks | 0)}; r96_wait++) {`,
    "    r96_yield_tick();",
    "  }",
  ];
}

function emitSpriteAnimation(spriteVariable: string, animationId: string, project?: Risc96Project): string[] {
  const [spriteId, tagId] = animationId.split(":");
  const sprite = project?.sprites.find((candidate) => candidate.id === spriteId);
  const animation = sprite?.animations?.find((candidate) => candidate.id === tagId);
  if (!sprite || !animation) return [];

  const start = Math.max(0, Math.min(animation.from, animation.to));
  const end = Math.min(sprite.frames.length - 1, Math.max(animation.from, animation.to));
  const frames = animation.direction === "reverse" ? range(end, start) : range(start, end);
  const sequence = animation.direction === "pingpong" && frames.length > 1 ? [...frames, ...frames.slice(1, -1).reverse()] : frames;

  return sequence.flatMap((frame) => [`  r96_sprite_set_frame(&${safeIdentifier(spriteVariable)}, ${frame});`, "  r96_yield_tick();"]);
}

function range(from: number, to: number): number[] {
  const step = from <= to ? 1 : -1;
  const values: number[] = [];
  for (let value = from; step > 0 ? value <= to : value >= to; value += step) values.push(value);
  return values;
}

function emitDeleteArrayItem(array: string, index: string): string[] {
  const name = safeIdentifier(array);
  return indentLines([
    "{",
    `int r96_index = (${index}) & 255;`,
    `for (int r96_i = r96_index; r96_i < ${name}_length - 1; r96_i++) ${name}[r96_i] = ${name}[r96_i + 1];`,
    `if (${name}_length > 0) ${name}_length--;`,
    "}",
  ]);
}

function emitInsertArrayItem(array: string, index: string, value: string): string[] {
  const name = safeIdentifier(array);
  return indentLines([
    "{",
    `int r96_index = (${index}) & 255;`,
    `if (${name}_length < 256) {`,
    `  for (int r96_i = ${name}_length; r96_i > r96_index; r96_i--) ${name}[r96_i] = ${name}[r96_i - 1];`,
    `  ${name}[r96_index] = ${value};`,
    `  ${name}_length++;`,
    "}",
    "}",
  ]);
}

function emitProcedure(
  name: string,
  project: Risc96Project | undefined,
  eventScripts: NonNullable<SerializedEventScripts>,
): string[] {
  const procedure = project?.scripts
    .flatMap((script) => script.blocks.procedures ?? [])
    .find((candidate) => candidate.name === name);
  return procedure ? emitCommands(procedure.commands, eventScripts, project) : [];
}

function emitEventHandler(event: string, commands: UpdateCommand[]): string[] {
  return emitBlock(`if (r96_event_poll("${escapeCString(event)}"))`, commands);
}

function emitMatchingEventScripts(
  event: string,
  eventScripts: NonNullable<SerializedEventScripts>,
  project?: Risc96Project,
): string[] {
  return eventScripts
    .filter((eventScript) => eventScript.event === event)
    .flatMap((eventScript) => emitCommands(eventScript.commands, eventScripts, project));
}

function emitBlock(
  header: string,
  commands: UpdateCommand[],
  eventScripts: NonNullable<SerializedEventScripts> = [],
  project?: Risc96Project,
): string[] {
  return indentLines([`${header} {`, ...emitCommands(commands, eventScripts, project), "}"]);
}

function emitBlockWithBranches(
  header: string,
  thenCommands: UpdateCommand[],
  elseCommands: UpdateCommand[],
  eventScripts: NonNullable<SerializedEventScripts>,
  project?: Risc96Project,
): string[] {
  return indentLines([
    `${header} {`,
    ...emitCommands(thenCommands, eventScripts, project),
    "} else {",
    ...emitCommands(elseCommands, eventScripts, project),
    "}",
  ]);
}

function emitCommands(
  commands: UpdateCommand[],
  eventScripts: NonNullable<SerializedEventScripts> = [],
  project?: Risc96Project,
): string[] {
  return commands.flatMap((command) =>
    emitUpdateCommand(command, eventScripts, project).map((line) => line.replace(/^  /, "")),
  );
}
