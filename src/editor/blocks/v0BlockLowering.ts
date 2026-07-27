import type * as Blockly from "blockly/core";

import type {
  BooleanExpression,
  DrawCommand,
  NumericExpression,
  Risc96Button,
  SerializedBlocks,
  StringExpression,
  UpdateCommand,
} from "../../project/model.ts";
import { v0BlockTypes } from "./v0BlockTypes.ts";

export function lowerWorkspaceToBlocks(workspace: Blockly.Workspace): SerializedBlocks {
  const blocks: SerializedBlocks = { start: [], update: [], draw: [], procedures: [] };

  for (const block of workspace.getTopBlocks(true)) {
    if (block.type === v0BlockTypes.setup) {
      blocks.start.push({
        kind: "setResolution",
        width: Number(block.getFieldValue("WIDTH") ?? 320),
        height: Number(block.getFieldValue("HEIGHT") ?? 224),
      });
      blocks.start.push(...lowerStartStatementChain(block.getNextBlock()));
    }

    if (block.type === v0BlockTypes.updateLoop) {
      blocks.update.push(...lowerUpdateStatementChain(block.getNextBlock()));
    }

    if (block.type === v0BlockTypes.drawLoop) {
      blocks.draw?.push(...lowerDrawStatementChain(block.getNextBlock()));
    }

    if (block.type === v0BlockTypes.defineProcedure) {
      blocks.procedures?.push({
        name: String(block.getFieldValue("NAME") ?? "procedure"),
        commands: lowerUpdateStatementChain(block.getNextBlock()),
      });
    }
  }

  if (blocks.draw?.length === 0) delete blocks.draw;
  if (blocks.procedures?.length === 0) delete blocks.procedures;
  return blocks;
}

function lowerStartStatementChain(block: Blockly.Block | null): SerializedBlocks["start"] {
  const commands: SerializedBlocks["start"] = [];
  let current = block;

  while (current) {
    if (current.type === v0BlockTypes.debugLog) {
      commands.push({ kind: "debugLog", text: String(current.getFieldValue("TEXT") ?? "") });
    }
    if (current.type === v0BlockTypes.setClearColor) {
      commands.push({ kind: "setClearColor", color: parseHexColor(String(current.getFieldValue("COLOR") ?? "#000000")) });
    }
    if (current.type === v0BlockTypes.initTextVariable) commands.push(lowerInitTextVariable(current));
    if (current.type === v0BlockTypes.createSprite) commands.push(lowerCreateSprite(current));
    if (current.type === v0BlockTypes.setSpriteFrame) commands.push(lowerSetSpriteFrame(current));
    current = current.getNextBlock();
  }

  return commands;
}

function lowerUpdateStatementChain(block: Blockly.Block | null): UpdateCommand[] {
  const commands: UpdateCommand[] = [];
  let current = block;

  while (current) {
    const command = lowerUpdateCommand(current);
    if (command) commands.push(command);
    current = current.getNextBlock();
  }

  return commands;
}

function lowerUpdateCommand(block: Blockly.Block): UpdateCommand | undefined {
  if (block.type === v0BlockTypes.debugLog) return { kind: "debugLog", text: String(block.getFieldValue("TEXT") ?? "") };
  if (block.type === v0BlockTypes.yieldFrame) return { kind: "yieldFrame" };
  if (block.type === v0BlockTypes.stopProgram) return { kind: "stopEverything" };
  if (block.type === v0BlockTypes.breakLoop) return { kind: "break" };
  if (block.type === v0BlockTypes.continueLoop) return { kind: "continue" };
  if (block.type === v0BlockTypes.waitFrames) return { kind: "wait", ticks: Math.max(0, Math.round(Number(block.getFieldValue("FRAMES") ?? 0))) };
  if (block.type === v0BlockTypes.waitSeconds) return { kind: "wait", ticks: Math.max(0, Math.round(Number(block.getFieldValue("SECONDS") ?? 0) * 60)) };
  if (block.type === v0BlockTypes.playSound) return { kind: "playSound", soundId: String(block.getFieldValue("SOUND") ?? "") };
  if (block.type === v0BlockTypes.playSoundAndWait) return { kind: "playSoundAndWait", soundId: String(block.getFieldValue("SOUND") ?? ""), ticks: 30 };
  if (block.type === v0BlockTypes.stopAllSounds) return { kind: "stopAllSounds" };
  if (block.type === v0BlockTypes.setSoundTempo) return { kind: "setSoundTempo", bpm: Number(block.getFieldValue("BPM") ?? 120) };

  if (block.type === v0BlockTypes.incrementVariable || block.type === v0BlockTypes.decrementVariable) {
    return {
      kind: "incrementVariable",
      variable: String(block.getFieldValue("VARIABLE") ?? "value"),
      amount: Number(block.getFieldValue("AMOUNT") ?? 1),
    };
  }
  if (block.type === v0BlockTypes.setVariable) return { kind: "setVariable", variable: String(block.getFieldValue("VARIABLE") ?? "value"), value: lowerNumberInput(block, "VALUE") };
  if (block.type === v0BlockTypes.initTextVariable) return lowerInitTextVariable(block);
  if (block.type === v0BlockTypes.setArrayItem) return { kind: "setArrayItem", array: String(block.getFieldValue("ARRAY") ?? "buffer"), index: lowerNumberInput(block, "INDEX"), value: lowerNumberInput(block, "VALUE") };
  if (block.type === v0BlockTypes.clearArray) return { kind: "clearArray", array: String(block.getFieldValue("ARRAY") ?? "buffer") };

  if (block.type === v0BlockTypes.createSprite) return lowerCreateSprite(block);
  if (block.type === v0BlockTypes.setSpriteFrame) return lowerSetSpriteFrame(block);
  if (block.type === v0BlockTypes.moveSprite) return { kind: "moveSprite", sprite: lowerTextField(block, "SPRITE", "player"), dx: lowerNumberInput(block, "DX"), dy: lowerNumberInput(block, "DY") };
  if (block.type === v0BlockTypes.setSpriteX) return { kind: "setSpriteX", sprite: lowerTextField(block, "SPRITE", "player"), value: lowerNumberInput(block, "VALUE") };
  if (block.type === v0BlockTypes.setSpriteY) return { kind: "setSpriteY", sprite: lowerTextField(block, "SPRITE", "player"), value: lowerNumberInput(block, "VALUE") };
  if (block.type === v0BlockTypes.setSpritePosition) return { kind: "setSpritePosition", sprite: lowerTextField(block, "SPRITE", "player"), x: lowerNumberInput(block, "X"), y: lowerNumberInput(block, "Y") };

  if (block.type === v0BlockTypes.ifThen) return { kind: "if", condition: lowerCondition(block), thenCommands: lowerUpdateStatementChain(block.getInputTargetBlock("DO")), elseCommands: [] };
  if (block.type === v0BlockTypes.ifThenElse) return { kind: "if", condition: lowerCondition(block), thenCommands: lowerUpdateStatementChain(block.getInputTargetBlock("THEN")), elseCommands: lowerUpdateStatementChain(block.getInputTargetBlock("ELSE")) };
  if (block.type === v0BlockTypes.whileLoop) return { kind: "while", condition: lowerCondition(block), commands: lowerUpdateStatementChain(block.getInputTargetBlock("DO")) };
  if (block.type === v0BlockTypes.repeatTimes) return { kind: "repeat", times: lowerNumberInput(block, "TIMES"), commands: lowerUpdateStatementChain(block.getInputTargetBlock("DO")) };
  if (block.type === v0BlockTypes.everyFrames) return { kind: "everyFrames", frames: lowerNumberInput(block, "FRAMES"), commands: lowerUpdateStatementChain(block.getInputTargetBlock("DO")) };
  if (block.type === v0BlockTypes.forLoop) return { kind: "for", variable: String(block.getFieldValue("VARIABLE") ?? "i"), from: Number(block.getFieldValue("FROM") ?? 0), to: Number(block.getFieldValue("TO") ?? 0), step: Number(block.getFieldValue("STEP") ?? 1), commands: lowerUpdateStatementChain(block.getInputTargetBlock("DO")) };
  if (block.type === v0BlockTypes.callProcedure) return { kind: "callProcedure", name: String(block.getFieldValue("NAME") ?? "procedure") };

  return undefined;
}

function lowerDrawStatementChain(block: Blockly.Block | null): DrawCommand[] {
  const commands: DrawCommand[] = [];
  let current = block;

  while (current) {
    if (current.type === v0BlockTypes.clearScreen) commands.push({ kind: "clearScreen", color: parseHexColor(String(current.getFieldValue("COLOR") ?? "#000000")) });
    if (current.type === v0BlockTypes.drawSprite) commands.push({ kind: "drawSprite", sprite: lowerTextField(current, "SPRITE", "player") });
    if (current.type === v0BlockTypes.drawSpriteFrame) commands.push({ kind: "drawSpriteFrame", spriteId: String(current.getFieldValue("SPRITE") ?? ""), frame: Number(current.getFieldValue("FRAME") ?? 0), x: lowerNumberInput(current, "X"), y: lowerNumberInput(current, "Y") });
    if (current.type === v0BlockTypes.drawText) commands.push(lowerDrawText(current));
    if (current.type === v0BlockTypes.drawTilemap) commands.push(lowerDrawTilemap(current));
    if (current.type === v0BlockTypes.drawRect) commands.push(lowerDrawRect(current));
    if (current.type === v0BlockTypes.drawLine) commands.push(lowerDrawLine(current));
    if (current.type === v0BlockTypes.drawCircle) commands.push(lowerDrawCircle(current));
    current = current.getNextBlock();
  }

  return commands;
}

function lowerCreateSprite(block: Blockly.Block): Extract<SerializedBlocks["start"][number], { kind: "createSprite" }> {
  return {
    kind: "createSprite",
    variable: lowerTextField(block, "VARIABLE", "player"),
    spriteId: String(block.getFieldValue("SPRITE") ?? "player"),
    x: integerFromExpression(lowerNumberInput(block, "X")),
    y: integerFromExpression(lowerNumberInput(block, "Y")),
  };
}

function lowerSetSpriteFrame(block: Blockly.Block): Extract<UpdateCommand, { kind: "setSpriteFrame" }> {
  return {
    kind: "setSpriteFrame",
    variable: lowerTextField(block, "SPRITE", "player"),
    frame: integerFromExpression(lowerNumberInput(block, "FRAME")),
  };
}

function lowerDrawText(block: Blockly.Block): Extract<DrawCommand, { kind: "drawText" }> {
  return {
    kind: "drawText",
    fontId: String(block.getFieldValue("FONT") ?? ""),
    text: block.getInputTargetBlock("TEXT") ? lowerStringInput(block, "TEXT") : String(block.getFieldValue("TEXT") ?? ""),
    x: lowerNumberInput(block, "X"),
    y: lowerNumberInput(block, "Y"),
    color: parseHexColor(String(block.getFieldValue("COLOR") ?? "#ffffff")),
  };
}

function lowerInitTextVariable(block: Blockly.Block): Extract<UpdateCommand | SerializedBlocks["start"][number], { kind: "initTextVariable" }> {
  return {
    kind: "initTextVariable",
    variable: lowerTextField(block, "VARIABLE", "message"),
    length: Math.max(1, Math.min(256, Math.round(Number(block.getFieldValue("LENGTH") ?? 32)))),
    value: lowerStringInput(block, "VALUE"),
  };
}

function lowerDrawTilemap(block: Blockly.Block): Extract<DrawCommand, { kind: "drawTilemap" }> {
  return {
    kind: "drawTilemap",
    tilemapId: String(block.getFieldValue("TILEMAP") ?? ""),
    x: lowerNumberInput(block, "X"),
    y: lowerNumberInput(block, "Y"),
  };
}

function lowerDrawRect(block: Blockly.Block): DrawCommand {
  return {
    kind: "drawRect",
    x: lowerNumberInput(block, "X"),
    y: lowerNumberInput(block, "Y"),
    width: lowerNumberInput(block, "WIDTH"),
    height: lowerNumberInput(block, "HEIGHT"),
    color: parseHexColor(String(block.getFieldValue("COLOR") ?? "#ffffff")),
    filled: String(block.getFieldValue("FILL") ?? "filled") === "filled",
  };
}

function lowerDrawLine(block: Blockly.Block): DrawCommand {
  return {
    kind: "drawLine",
    x1: lowerNumberInput(block, "X1"),
    y1: lowerNumberInput(block, "Y1"),
    x2: lowerNumberInput(block, "X2"),
    y2: lowerNumberInput(block, "Y2"),
    color: parseHexColor(String(block.getFieldValue("COLOR") ?? "#ffffff")),
  };
}

function lowerDrawCircle(block: Blockly.Block): DrawCommand {
  return {
    kind: "drawCircle",
    x: lowerNumberInput(block, "X"),
    y: lowerNumberInput(block, "Y"),
    radius: lowerNumberInput(block, "RADIUS"),
    color: parseHexColor(String(block.getFieldValue("COLOR") ?? "#ffffff")),
    filled: String(block.getFieldValue("FILL") ?? "filled") === "filled",
  };
}

function lowerCondition(block: Blockly.Block): BooleanExpression {
  return lowerBooleanBlock(block.getInputTargetBlock("COND"));
}

function lowerBooleanBlock(block: Blockly.Block | null): BooleanExpression {
  if (!block) return { kind: "literal", value: true };
  if (block.type === v0BlockTypes.compare) return { kind: "compare", left: lowerNumberInput(block, "A"), operator: lowerCompareOperator(String(block.getFieldValue("OP") ?? "==")), right: lowerNumberInput(block, "B") };
  if (block.type === v0BlockTypes.buttonDown) return lowerButton(block, "buttonDown");
  if (block.type === v0BlockTypes.buttonPressed) return lowerButton(block, "buttonPressed");
  if (block.type === v0BlockTypes.buttonReleased) return lowerButton(block, "buttonReleased");
  if (block.type === v0BlockTypes.spriteTouching) return { kind: "spriteTouching", left: lowerTextField(block, "LEFT", "player"), right: lowerTextField(block, "RIGHT", "enemy") };
  if (block.type === v0BlockTypes.spriteTouchingTilemap) return { kind: "spriteTouchingTilemap", sprite: lowerTextField(block, "SPRITE", "player"), tilemapId: String(block.getFieldValue("TILEMAP") ?? ""), x: lowerNumberInput(block, "X"), y: lowerNumberInput(block, "Y") };
  if (block.type === v0BlockTypes.boolBinary) {
    const operator = String(block.getFieldValue("OP") ?? "and");
    return operator === "or" ? { kind: "or", left: lowerBooleanInput(block, "A"), right: lowerBooleanInput(block, "B") } : { kind: "and", left: lowerBooleanInput(block, "A"), right: lowerBooleanInput(block, "B") };
  }
  if (block.type === v0BlockTypes.boolNot) return { kind: "not", value: lowerBooleanInput(block, "VALUE") };
  return { kind: "literal", value: true };
}

function lowerButton(block: Blockly.Block, kind: "buttonDown" | "buttonPressed" | "buttonReleased"): BooleanExpression {
  return {
    kind,
    player: Number(block.getFieldValue("PLAYER") ?? 1) as 1 | 2 | 3 | 4,
    button: String(block.getFieldValue("BUTTON") ?? "A") as Risc96Button,
  };
}

function lowerBooleanInput(block: Blockly.Block, inputName: string): BooleanExpression {
  return lowerBooleanBlock(block.getInputTargetBlock(inputName));
}

function lowerNumberInput(block: Blockly.Block, inputName: string): NumericExpression {
  return lowerNumberBlock(block.getInputTargetBlock(inputName));
}

function lowerStringInput(block: Blockly.Block, inputName: string): StringExpression {
  return lowerStringBlock(block.getInputTargetBlock(inputName));
}

function lowerStringBlock(block: Blockly.Block | null): StringExpression {
  if (!block) return { kind: "literal", value: "" };
  if (block.type === v0BlockTypes.stringLiteral) return { kind: "literal", value: String(block.getFieldValue("TEXT") ?? "") };
  if (block.type === v0BlockTypes.textVariableValue) return { kind: "variable", name: String(block.getFieldValue("VARIABLE") ?? "message") };
  if (block.type === v0BlockTypes.numberToString) return { kind: "numberToString", value: lowerNumberInput(block, "VALUE") };
  if (block.type === v0BlockTypes.numberToHexString) return { kind: "numberToHexString", value: lowerNumberInput(block, "VALUE") };
  return { kind: "literal", value: "" };
}

function lowerNumberBlock(block: Blockly.Block | null): NumericExpression {
  if (!block) return { kind: "integer", value: 0 };
  if (block.type === "math_number") return { kind: "integer", value: Number(block.getFieldValue("NUM") ?? 0) };
  if (block.type === v0BlockTypes.variableValue) return { kind: "variable", name: String(block.getFieldValue("VARIABLE") ?? "value") };
  if (block.type === v0BlockTypes.frameCount) return { kind: "frameCount" };
  if (block.type === v0BlockTypes.screenWidth) return { kind: "screenWidth" };
  if (block.type === v0BlockTypes.screenHeight) return { kind: "screenHeight" };
  if (block.type === v0BlockTypes.random) return { kind: "random", from: lowerNumberInput(block, "FROM"), to: lowerNumberInput(block, "TO") };
  if (block.type === v0BlockTypes.mathUnary || block.type === v0BlockTypes.trig) return { kind: "mathUnary", operator: lowerMathUnaryOperator(String(block.getFieldValue("OP") ?? "abs")), value: lowerNumberInput(block, "VALUE") };
  if (block.type === v0BlockTypes.minMax) return { kind: "minMax", operator: lowerMinMaxOperator(String(block.getFieldValue("OP") ?? "min")), left: lowerNumberInput(block, "A"), right: lowerNumberInput(block, "B") };
  if (block.type === v0BlockTypes.clamp) return { kind: "clamp", value: lowerNumberInput(block, "VALUE"), min: lowerNumberInput(block, "MIN"), max: lowerNumberInput(block, "MAX") };
  if (block.type === v0BlockTypes.arrayItemValue) return { kind: "arrayItem", array: String(block.getFieldValue("ARRAY") ?? "buffer"), index: lowerNumberInput(block, "INDEX") };
  if (block.type === v0BlockTypes.arrayLength) return { kind: "arrayLength", array: String(block.getFieldValue("ARRAY") ?? "buffer") };
  if (block.type === v0BlockTypes.spriteXValue) return { kind: "spriteX", sprite: lowerTextField(block, "SPRITE", "player") };
  if (block.type === v0BlockTypes.spriteYValue) return { kind: "spriteY", sprite: lowerTextField(block, "SPRITE", "player") };
  if (block.type === v0BlockTypes.spriteWidthValue) return { kind: "spriteWidth", sprite: lowerTextField(block, "SPRITE", "player") };
  if (block.type === v0BlockTypes.spriteHeightValue) return { kind: "spriteHeight", sprite: lowerTextField(block, "SPRITE", "player") };
  if (block.type === v0BlockTypes.dpadAxis) return { kind: "dpadAxis", player: Number(block.getFieldValue("PLAYER") ?? 1) as 1 | 2 | 3 | 4, axis: String(block.getFieldValue("AXIS") ?? "x") === "y" ? "y" : "x" };
  if (block.type === v0BlockTypes.mathBinary) return { kind: "binary", left: lowerNumberInput(block, "A"), operator: lowerMathOperator(String(block.getFieldValue("OP") ?? "+")), right: lowerNumberInput(block, "B") };
  return { kind: "integer", value: 0 };
}

function lowerTextField(block: Blockly.Block, fieldName: string, fallback: string): string {
  const field = block.getField(fieldName);
  if (field && "getText" in field && typeof field.getText === "function") return field.getText() || fallback;
  return String(block.getFieldValue(fieldName) ?? fallback);
}

function integerFromExpression(expression: NumericExpression): number {
  return expression.kind === "integer" ? expression.value : 0;
}

function lowerMathOperator(value: string): Extract<NumericExpression, { kind: "binary" }>["operator"] {
  return ["+", "-", "*", "/", "%", "<<", ">>", "&", "|", "^"].includes(value)
    ? (value as Extract<NumericExpression, { kind: "binary" }>["operator"])
    : "+";
}

function lowerCompareOperator(value: string): Extract<BooleanExpression, { kind: "compare" }>["operator"] {
  return ["==", "!=", "<", "<=", ">", ">="].includes(value)
    ? (value as Extract<BooleanExpression, { kind: "compare" }>["operator"])
    : "==";
}

function lowerMathUnaryOperator(value: string): Extract<NumericExpression, { kind: "mathUnary" }>["operator"] {
  if (["abs", "sqrt", "sin", "cos"].includes(value)) return value as Extract<NumericExpression, { kind: "mathUnary" }>["operator"];
  return "abs";
}

function lowerMinMaxOperator(value: string): "min" | "max" {
  return value === "max" ? "max" : "min";
}

function parseHexColor(value: string): number {
  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? Number.parseInt(normalized, 16) : 0;
}
