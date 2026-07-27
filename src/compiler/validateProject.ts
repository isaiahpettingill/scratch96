import type { BooleanExpression, NumericExpression, Risc96Project, StringExpression } from "../project/model.ts";
import { safeIdentifier } from "./emitCUtil.ts";

export function validateProject(project: Risc96Project): string[] {
  const diagnostics: string[] = [];
  const spriteIds = new Set(project.sprites.map((sprite) => sprite.id));
  const fontIds = new Set(project.fonts.map((font) => font.id));
  const tilemapIds = new Set(project.tilemaps.map((tilemap) => tilemap.id));
  const soundIds = new Set(project.sounds.map((sound) => sound.id));

  if (project.settings.fps !== 60) {
    diagnostics.push("v0 only supports 60 fps projects.");
  }

  validateGlobalSymbols(project, diagnostics);
  validateControlFlow(project, diagnostics);

  for (const sprite of project.sprites) {
    if (sprite.frames.length === 0) {
      diagnostics.push(`Sprite ${sprite.id} has no frames.`);
    }

    if (!sprite.palette.some((color) => color.index === sprite.transparentIndex)) {
      diagnostics.push(`Sprite ${sprite.id} transparent index is not in its palette.`);
    }

    for (const frame of sprite.frames) {
      if (frame.colorIndexes.length !== sprite.width * sprite.height) {
        diagnostics.push(`Frame ${frame.id} in sprite ${sprite.id} has the wrong pixel count.`);
      }

      for (const colorIndex of frame.colorIndexes) {
        if (!sprite.palette.some((color) => color.index === colorIndex)) {
          diagnostics.push(
            `Frame ${frame.id} in sprite ${sprite.id} references missing palette index ${colorIndex}.`,
          );
          break;
        }
      }
    }
  }

  for (const script of project.scripts) {
    for (const command of script.blocks.start) {
      if (command.kind === "createSprite" && !spriteIds.has(command.spriteId)) {
        diagnostics.push(`Script ${script.id} references missing sprite ${command.spriteId}.`);
      }
      if (command.kind === "setResolution" && (command.width <= 0 || command.height <= 0)) {
        diagnostics.push(`Script ${script.id} setup uses invalid screen size.`);
      }
    }

    for (const command of script.blocks.update)
      validateUpdateCommand(command, script.id, diagnostics, spriteIds, fontIds, tilemapIds, soundIds);
    for (const command of script.blocks.draw ?? [])
      validateDrawCommand(command, script.id, diagnostics, spriteIds, fontIds, tilemapIds);
    for (const eventScript of script.blocks.events ?? []) {
      for (const command of eventScript.commands)
        validateUpdateCommand(command, script.id, diagnostics, spriteIds, fontIds, tilemapIds, soundIds);
    }
    for (const buttonEventScript of script.blocks.buttonEvents ?? []) {
      for (const command of buttonEventScript.commands)
        validateUpdateCommand(command, script.id, diagnostics, spriteIds, fontIds, tilemapIds, soundIds);
    }
  }

  return diagnostics;
}

function validateUpdateCommand(
  command: Risc96Project["scripts"][number]["blocks"]["update"][number],
  scriptId: string,
  diagnostics: string[],
  spriteIds: Set<string>,
  fontIds: Set<string>,
  tilemapIds: Set<string>,
  soundIds: Set<string>,
): void {
  if ((command.kind === "playSound" || command.kind === "playSoundAndWait") && !soundIds.has(command.soundId))
    diagnostics.push(`Script ${scriptId} references missing sound ${command.soundId}.`);
  if (command.kind === "createSprite" && !spriteIds.has(command.spriteId))
    diagnostics.push(`Script ${scriptId} references missing sprite ${command.spriteId}.`);
  if (
    (command.kind === "drawText" || command.kind === "writeText") &&
    command.fontId &&
    !fontIds.has(command.fontId)
  )
    diagnostics.push(`Script ${scriptId} references missing font ${command.fontId}.`);
  if (command.kind === "drawTilemap" && !tilemapIds.has(command.tilemapId))
    diagnostics.push(`Script ${scriptId} references missing tilemap ${command.tilemapId}.`);
  if (command.kind === "setSpriteFrame" && command.frame < 0)
    diagnostics.push(`Script ${scriptId} uses a negative sprite frame.`);
  if (command.kind === "playSpriteAnimation" && !command.animation.includes(":")) diagnostics.push(`Script ${scriptId} references missing sprite animation.`);
  if (command.kind === "if") {
    validateBooleanExpression(command.condition, scriptId, diagnostics, tilemapIds);
    command.thenCommands.forEach((child) =>
      validateUpdateCommand(child, scriptId, diagnostics, spriteIds, fontIds, tilemapIds, soundIds),
    );
    command.elseCommands.forEach((child) =>
      validateUpdateCommand(child, scriptId, diagnostics, spriteIds, fontIds, tilemapIds, soundIds),
    );
  }
  if (command.kind === "while" || command.kind === "doWhile" || command.kind === "repeatUntil") {
    validateBooleanExpression(command.condition, scriptId, diagnostics, tilemapIds);
  }
  if (
    command.kind === "while" ||
    command.kind === "doWhile" ||
    command.kind === "for" ||
    command.kind === "onEvent" ||
    command.kind === "everyFrames"
  ) {
    command.commands.forEach((child) =>
      validateUpdateCommand(child, scriptId, diagnostics, spriteIds, fontIds, tilemapIds, soundIds),
    );
  }
}

function validateBooleanExpression(
  expression: BooleanExpression,
  scriptId: string,
  diagnostics: string[],
  tilemapIds: Set<string>,
): void {
  if (expression.kind === "spriteTouchingTilemap" && !tilemapIds.has(expression.tilemapId)) {
    diagnostics.push(`Script ${scriptId} references missing tilemap ${expression.tilemapId}.`);
  }
  if (expression.kind === "and" || expression.kind === "or") {
    validateBooleanExpression(expression.left, scriptId, diagnostics, tilemapIds);
    validateBooleanExpression(expression.right, scriptId, diagnostics, tilemapIds);
  }
  if (expression.kind === "not") validateBooleanExpression(expression.value, scriptId, diagnostics, tilemapIds);
}

function validateDrawCommand(
  command: NonNullable<Risc96Project["scripts"][number]["blocks"]["draw"]>[number],
  scriptId: string,
  diagnostics: string[],
  spriteIds: Set<string>,
  fontIds: Set<string>,
  tilemapIds: Set<string>,
): void {
  if (command.kind === "drawText" && command.fontId && !fontIds.has(command.fontId))
    diagnostics.push(`Script ${scriptId} references missing font ${command.fontId}.`);
  if (command.kind === "drawTilemap" && !tilemapIds.has(command.tilemapId))
    diagnostics.push(`Script ${scriptId} references missing tilemap ${command.tilemapId}.`);
  if (command.kind === "drawSpriteFrame" && !spriteIds.has(command.spriteId))
    diagnostics.push(`Script ${scriptId} references missing sprite ${command.spriteId}.`);
}

function validateGlobalSymbols(project: Risc96Project, diagnostics: string[]): void {
  const symbols = new Map<string, { kind: string; name: string }>();
  const procedures = new Set<string>();

  for (const script of project.scripts) {
    for (const command of script.blocks.start) {
      if (command.kind === "createSprite") addSymbol(symbols, "sprite", command.variable, diagnostics);
      if (command.kind === "initTextVariable") {
        addSymbol(symbols, "text", command.variable, diagnostics);
        collectStringExpressionSymbols(command.value, symbols, diagnostics);
      }
    }
    for (const command of script.blocks.update) collectCommandSymbols(command, symbols, diagnostics);
    for (const command of script.blocks.draw ?? []) collectDrawSymbols(command, symbols, diagnostics);
    for (const procedure of script.blocks.procedures ?? []) {
      if (procedures.has(procedure.name)) diagnostics.push(`Duplicate procedure ${procedure.name}.`);
      procedures.add(procedure.name);
      addSymbol(symbols, "procedure", procedure.name, diagnostics);
      procedure.commands.forEach((command) => collectCommandSymbols(command, symbols, diagnostics));
    }
  }
}

function addSymbol(
  symbols: Map<string, { kind: string; name: string }>,
  kind: string,
  name: string,
  diagnostics: string[],
): void {
  const safeName = safeIdentifier(name);
  if (safeName.startsWith("r96_")) {
    diagnostics.push(`Global name ${name} uses reserved r96_ prefix.`);
    return;
  }
  const existing = symbols.get(safeName);
  if (!existing) {
    symbols.set(safeName, { kind, name });
    return;
  }

  if (existing.kind !== kind || existing.name !== name) {
    diagnostics.push(
      `Global name ${name} conflicts with ${existing.kind} ${existing.name} after C name sanitization.`,
    );
  }
}

function collectCommandSymbols(
  command: Risc96Project["scripts"][number]["blocks"]["update"][number],
  symbols: Map<string, { kind: string; name: string }>,
  diagnostics: string[],
): void {
  if (command.kind === "createSprite") addSymbol(symbols, "sprite", command.variable, diagnostics);
  if (command.kind === "initTextVariable") addSymbol(symbols, "text", command.variable, diagnostics);
  if (
    command.kind === "setVariable" ||
    command.kind === "incrementVariable" ||
    command.kind === "decrementVariable" ||
    command.kind === "setVariableToSpriteX" ||
    command.kind === "setVariableToSpriteY" ||
    command.kind === "for"
  ) {
    addSymbol(symbols, "scalar", command.variable, diagnostics);
  }
  if (
    command.kind === "setArrayItem" ||
    command.kind === "addArrayItem" ||
    command.kind === "deleteArrayItem" ||
    command.kind === "insertArrayItem" ||
    command.kind === "replaceArrayItem" ||
    command.kind === "clearArray"
  ) {
    addSymbol(symbols, "array", command.array, diagnostics);
  }
  collectCommandExpressions(command).forEach((expression) => collectExpressionSymbols(expression, symbols, diagnostics));
  collectCommandStringExpressions(command).forEach((expression) => collectStringExpressionSymbols(expression, symbols, diagnostics));
  if (command.kind === "if") {
    collectBooleanSymbols(command.condition, symbols, diagnostics);
    command.thenCommands.forEach((child) => collectCommandSymbols(child, symbols, diagnostics));
    command.elseCommands.forEach((child) => collectCommandSymbols(child, symbols, diagnostics));
  }
  if ("commands" in command) command.commands.forEach((child) => collectCommandSymbols(child, symbols, diagnostics));
}

function collectDrawSymbols(
  command: NonNullable<Risc96Project["scripts"][number]["blocks"]["draw"]>[number],
  symbols: Map<string, { kind: string; name: string }>,
  diagnostics: string[],
): void {
  if (command.kind === "drawSpriteFrame") [command.x, command.y].forEach((expression) => collectExpressionSymbols(expression, symbols, diagnostics));
  if (command.kind === "drawText" || command.kind === "drawTilemap") {
    if (typeof command.x !== "number") collectExpressionSymbols(command.x, symbols, diagnostics);
    if (typeof command.y !== "number") collectExpressionSymbols(command.y, symbols, diagnostics);
  }
  if (command.kind === "drawText" && typeof command.text !== "string") collectStringExpressionSymbols(command.text, symbols, diagnostics);
  if (command.kind === "drawRect") [command.x, command.y, command.width, command.height].forEach((expression) => collectExpressionSymbols(expression, symbols, diagnostics));
  if (command.kind === "drawLine") [command.x1, command.y1, command.x2, command.y2].forEach((expression) => collectExpressionSymbols(expression, symbols, diagnostics));
  if (command.kind === "drawCircle") [command.x, command.y, command.radius].forEach((expression) => collectExpressionSymbols(expression, symbols, diagnostics));
}

function collectCommandExpressions(command: Risc96Project["scripts"][number]["blocks"]["update"][number]): NumericExpression[] {
  const expressions: NumericExpression[] = [];
  if ("value" in command && command.kind !== "initTextVariable" && typeof command.value !== "number") expressions.push(command.value);
  if ("x" in command && typeof command.x !== "number") expressions.push(command.x);
  if ("y" in command && typeof command.y !== "number") expressions.push(command.y);
  if ("dx" in command && typeof command.dx !== "number") expressions.push(command.dx);
  if ("dy" in command && typeof command.dy !== "number") expressions.push(command.dy);
  if ("index" in command && typeof command.index !== "number") expressions.push(command.index);
  if ("times" in command) expressions.push(command.times);
  if ("frames" in command) expressions.push(command.frames);
  return expressions;
}

function collectCommandStringExpressions(command: Risc96Project["scripts"][number]["blocks"]["update"][number]): StringExpression[] {
  const expressions: StringExpression[] = [];
  if (command.kind === "initTextVariable") expressions.push(command.value);
  if (command.kind === "drawText" && typeof command.text !== "string") expressions.push(command.text);
  return expressions;
}

function collectStringExpressionSymbols(
  expression: StringExpression,
  symbols: Map<string, { kind: string; name: string }>,
  diagnostics: string[],
): void {
  if (expression.kind === "variable") addSymbol(symbols, "text", expression.name, diagnostics);
  if (expression.kind === "join") {
    collectStringExpressionSymbols(expression.left, symbols, diagnostics);
    collectStringExpressionSymbols(expression.right, symbols, diagnostics);
  }
  if (expression.kind === "numberToString" || expression.kind === "numberToHexString") {
    collectExpressionSymbols(expression.value, symbols, diagnostics);
  }
}

function collectExpressionSymbols(
  expression: NumericExpression,
  symbols: Map<string, { kind: string; name: string }>,
  diagnostics: string[],
): void {
  if (expression.kind === "variable") addSymbol(symbols, "scalar", expression.name, diagnostics);
  if (expression.kind === "arrayItem") {
    addSymbol(symbols, "array", expression.array, diagnostics);
    collectExpressionSymbols(expression.index, symbols, diagnostics);
  }
  if (expression.kind === "random") [expression.from, expression.to].forEach((child) => collectExpressionSymbols(child, symbols, diagnostics));
  if (expression.kind === "mathUnary") collectExpressionSymbols(expression.value, symbols, diagnostics);
  if (expression.kind === "binary") [expression.left, expression.right].forEach((child) => collectExpressionSymbols(child, symbols, diagnostics));
  if (expression.kind === "minMax") [expression.left, expression.right].forEach((child) => collectExpressionSymbols(child, symbols, diagnostics));
  if (expression.kind === "clamp") [expression.value, expression.min, expression.max].forEach((child) => collectExpressionSymbols(child, symbols, diagnostics));
}

function collectBooleanSymbols(
  expression: BooleanExpression,
  symbols: Map<string, { kind: string; name: string }>,
  diagnostics: string[],
): void {
  if (expression.kind === "compare") [expression.left, expression.right].forEach((child) => collectExpressionSymbols(child, symbols, diagnostics));
  if (expression.kind === "spriteTouchingTilemap") [expression.x, expression.y].forEach((child) => collectExpressionSymbols(child, symbols, diagnostics));
  if (expression.kind === "and" || expression.kind === "or") {
    collectBooleanSymbols(expression.left, symbols, diagnostics);
    collectBooleanSymbols(expression.right, symbols, diagnostics);
  }
  if (expression.kind === "not") collectBooleanSymbols(expression.value, symbols, diagnostics);
}

function validateControlFlow(project: Risc96Project, diagnostics: string[]): void {
  for (const script of project.scripts) {
    for (const command of script.blocks.update) validateCommandControlFlow(command, diagnostics, 0, undefined);
    for (const procedure of script.blocks.procedures ?? []) {
      for (const command of procedure.commands) validateCommandControlFlow(command, diagnostics, 0, procedure.name);
    }
  }
}

function validateCommandControlFlow(
  command: Risc96Project["scripts"][number]["blocks"]["update"][number],
  diagnostics: string[],
  loopDepth: number,
  procedureName: string | undefined,
): void {
  if ((command.kind === "break" || command.kind === "continue") && loopDepth === 0) {
    diagnostics.push(`${command.kind} used outside a loop.`);
  }
  if (command.kind === "callProcedure" && procedureName && command.name === procedureName) {
    diagnostics.push(`Procedure ${procedureName} cannot call itself.`);
  }
  const nextLoopDepth = command.kind === "while" || command.kind === "doWhile" || command.kind === "for" || command.kind === "repeat" || command.kind === "repeatUntil" ? loopDepth + 1 : loopDepth;
  if (command.kind === "if") {
    command.thenCommands.forEach((child) => validateCommandControlFlow(child, diagnostics, loopDepth, procedureName));
    command.elseCommands.forEach((child) => validateCommandControlFlow(child, diagnostics, loopDepth, procedureName));
  }
  if ("commands" in command) command.commands.forEach((child) => validateCommandControlFlow(child, diagnostics, nextLoopDepth, procedureName));
}
