import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as En from "blockly/msg/en";

import type { Risc96Project } from "../../project/model.ts";
import {
  axisOptions,
  booleanOperatorOptions,
  buttonOptions,
  buttonStateOptions,
  compareOperatorOptions,
  fillOptions,
  getFontOptions,
  getSoundOptions,
  getSpriteOptions,
  getTilemapOptions,
  mathOperatorOptions,
  mathUnaryOptions,
  minMaxOptions,
  playerOptions,
  refreshProjectBlockOptions,
  trigOptions,
} from "./v0BlockOptions.ts";
import {
  commandBlock,
  conditionStatementBlock,
  setBlockColor,
  spriteNumberCommand,
  twoNumberReporter,
  variableNumberCommand,
} from "./v0BlockDefinitionUtils.ts";
import {
  carbonBlue,
  carbonGray,
  carbonGreen,
  carbonPurple,
  carbonRed,
  carbonTeal,
  v0BlockTypes,
} from "./v0BlockTypes.ts";
import {
  createEmptyWorkspaceState,
  createStarterWorkspaceState,
} from "./v0StarterWorkspace.ts";
import { v0Toolbox } from "./v0Toolbox.ts";

export { lowerWorkspaceToBlocks } from "./v0BlockLowering.ts";
export { v0BlockTypes } from "./v0BlockTypes.ts";
export { v0Toolbox } from "./v0Toolbox.ts";
export {
  createEmptyWorkspaceState,
  createStarterWorkspaceState,
  lowerStarterWorkspaceToBlocks,
  type StarterWorkspaceState,
} from "./v0StarterWorkspace.ts";

export function registerV0Blocks(): void {
  Blockly.setLocale(En as unknown as Record<string, string>);

  if (Blockly.Blocks[v0BlockTypes.setup]) return;

  Blockly.Blocks[v0BlockTypes.setup] = {
    init() {
      this.appendDummyInput()
        .appendField("setup screen width")
        .appendField(new Blockly.FieldNumber(320, 1, 320, 1), "WIDTH")
        .appendField("height")
        .appendField(new Blockly.FieldNumber(224, 1, 240, 1), "HEIGHT");
      this.setNextStatement(true);
      setBlockColor(this, carbonBlue);
    },
  };

  Blockly.Blocks[v0BlockTypes.updateLoop] = {
    init() {
      this.appendDummyInput().appendField("update each frame");
      this.setNextStatement(true);
      setBlockColor(this, carbonBlue);
    },
  };

  Blockly.Blocks[v0BlockTypes.drawLoop] = {
    init() {
      this.appendDummyInput().appendField("draw each frame");
      this.setNextStatement(true);
      setBlockColor(this, carbonBlue);
    },
  };

  Blockly.Blocks[v0BlockTypes.yieldFrame] = commandBlock("yield frame", [], carbonBlue);
  Blockly.Blocks[v0BlockTypes.stopProgram] = commandBlock("stop program", [], carbonBlue);
  Blockly.Blocks[v0BlockTypes.frameCount] = reporterBlock("frame count", "Number", carbonBlue);
  Blockly.Blocks[v0BlockTypes.screenWidth] = reporterBlock("screen width", "Number", carbonBlue);
  Blockly.Blocks[v0BlockTypes.screenHeight] = reporterBlock("screen height", "Number", carbonBlue);

  Blockly.Blocks[v0BlockTypes.debugLog] = {
    init() {
      this.appendDummyInput()
        .appendField("log")
        .appendField(new Blockly.FieldTextInput("Hello"), "TEXT");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonGreen);
    },
  };

  Blockly.Blocks[v0BlockTypes.setClearColor] = {
    init() {
      this.appendDummyInput()
        .appendField("set clear color")
        .appendField(new Blockly.FieldTextInput("#102030"), "COLOR");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };

  Blockly.Blocks[v0BlockTypes.clearScreen] = {
    init() {
      this.appendDummyInput()
        .appendField("clear screen")
        .appendField(new Blockly.FieldTextInput("#102030"), "COLOR");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };

  Blockly.Blocks[v0BlockTypes.drawSprite] = {
    init() {
      this.appendDummyInput()
        .appendField("draw sprite")
        .appendField(new Blockly.FieldTextInput("player"), "SPRITE");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };

  Blockly.Blocks[v0BlockTypes.drawSpriteFrame] = {
    init() {
      this.appendDummyInput()
        .appendField("draw sprite asset")
        .appendField(new Blockly.FieldDropdown(getSpriteOptions), "SPRITE")
        .appendField("frame")
        .appendField(new Blockly.FieldNumber(0, 0, undefined, 1), "FRAME");
      this.appendValueInput("X").setCheck("Number").appendField("x");
      this.appendValueInput("Y").setCheck("Number").appendField("y");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };

  Blockly.Blocks[v0BlockTypes.drawText] = {
    init() {
      this.appendValueInput("TEXT").setCheck("String").appendField("draw text");
      this.appendDummyInput()
        .appendField("font")
        .appendField(new Blockly.FieldDropdown(getFontOptions), "FONT")
        .appendField("color")
        .appendField(new Blockly.FieldTextInput("#ffffff"), "COLOR");
      this.appendValueInput("X").setCheck("Number").appendField("x");
      this.appendValueInput("Y").setCheck("Number").appendField("y");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };

  Blockly.Blocks[v0BlockTypes.drawTilemap] = {
    init() {
      this.appendDummyInput()
        .appendField("draw tilemap")
        .appendField(new Blockly.FieldDropdown(getTilemapOptions), "TILEMAP");
      this.appendValueInput("X").setCheck("Number").appendField("x");
      this.appendValueInput("Y").setCheck("Number").appendField("y");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };

  Blockly.Blocks[v0BlockTypes.drawRect] = shapeBlock("draw", "rect", "WIDTH", "HEIGHT");
  Blockly.Blocks[v0BlockTypes.drawLine] = {
    init() {
      this.appendDummyInput()
        .appendField("draw line color")
        .appendField(new Blockly.FieldTextInput("#ffffff"), "COLOR");
      this.appendValueInput("X1").setCheck("Number").appendField("x1");
      this.appendValueInput("Y1").setCheck("Number").appendField("y1");
      this.appendValueInput("X2").setCheck("Number").appendField("x2");
      this.appendValueInput("Y2").setCheck("Number").appendField("y2");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };
  Blockly.Blocks[v0BlockTypes.drawCircle] = shapeBlock("draw", "circle", "RADIUS");

  Blockly.Blocks[v0BlockTypes.createSprite] = {
    init() {
      this.appendDummyInput()
        .appendField("make sprite")
        .appendField(new Blockly.FieldTextInput("player"), "VARIABLE")
        .appendField("from")
        .appendField(new Blockly.FieldDropdown(getSpriteOptions), "SPRITE");
      this.appendValueInput("X").setCheck("Number").appendField("x");
      this.appendValueInput("Y").setCheck("Number").appendField("y");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonTeal);
    },
  };

  Blockly.Blocks[v0BlockTypes.setSpriteFrame] = spriteNumberCommand("set sprite", "FRAME", carbonTeal);
  Blockly.Blocks[v0BlockTypes.moveSprite] = spriteTwoNumberCommand("move sprite", "DX", "dy", "DY");
  Blockly.Blocks[v0BlockTypes.setSpriteX] = spriteNumberCommand("set sprite", "VALUE", carbonTeal);
  Blockly.Blocks[v0BlockTypes.setSpriteY] = spriteNumberCommand("set sprite", "VALUE", carbonTeal);
  Blockly.Blocks[v0BlockTypes.setSpritePosition] = spriteTwoNumberCommand("set sprite position", "X", "y", "Y");
  Blockly.Blocks[v0BlockTypes.spriteXValue] = spritePropertyReporter("x");
  Blockly.Blocks[v0BlockTypes.spriteYValue] = spritePropertyReporter("y");
  Blockly.Blocks[v0BlockTypes.spriteWidthValue] = spritePropertyReporter("width");
  Blockly.Blocks[v0BlockTypes.spriteHeightValue] = spritePropertyReporter("height");
  Blockly.Blocks[v0BlockTypes.spriteTouching] = {
    init() {
      this.appendDummyInput()
        .appendField("sprite")
        .appendField(new Blockly.FieldTextInput("player"), "LEFT")
        .appendField("overlaps")
        .appendField(new Blockly.FieldTextInput("enemy"), "RIGHT");
      this.setOutput(true, "Boolean");
      setBlockColor(this, carbonTeal);
    },
  };

  Blockly.Blocks[v0BlockTypes.spriteTouchingTilemap] = {
    init() {
      this.appendDummyInput()
        .appendField("sprite")
        .appendField(new Blockly.FieldTextInput("player"), "SPRITE")
        .appendField("overlaps tilemap")
        .appendField(new Blockly.FieldDropdown(getTilemapOptions), "TILEMAP");
      this.appendValueInput("X").setCheck("Number").appendField("tilemap x");
      this.appendValueInput("Y").setCheck("Number").appendField("y");
      this.setOutput(true, "Boolean");
      setBlockColor(this, carbonTeal);
    },
  };

  Blockly.Blocks[v0BlockTypes.ifThen] = conditionStatementBlock("if", carbonRed);
  Blockly.Blocks[v0BlockTypes.ifThenElse] = {
    init() {
      this.appendValueInput("COND").setCheck("Boolean").appendField("if");
      this.appendStatementInput("THEN").appendField("then");
      this.appendStatementInput("ELSE").appendField("else");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonRed);
    },
  };
  Blockly.Blocks[v0BlockTypes.whileLoop] = conditionStatementBlock("while", carbonRed);
  Blockly.Blocks[v0BlockTypes.repeatTimes] = statementNumberBlock("repeat", "TIMES", "times");
  Blockly.Blocks[v0BlockTypes.everyFrames] = statementNumberBlock("every", "FRAMES", "frames");
  Blockly.Blocks[v0BlockTypes.breakLoop] = commandBlock("break", [], carbonRed);
  Blockly.Blocks[v0BlockTypes.continueLoop] = commandBlock("continue", [], carbonRed);
  Blockly.Blocks[v0BlockTypes.waitFrames] = commandBlock("wait", [["number", "FRAMES", 1], ["label", "frames"]], carbonRed);
  Blockly.Blocks[v0BlockTypes.waitSeconds] = commandBlock("wait", [["number", "SECONDS", 1], ["label", "seconds"]], carbonRed);

  Blockly.Blocks[v0BlockTypes.forLoop] = {
    init() {
      this.appendDummyInput()
        .appendField("for")
        .appendField(new Blockly.FieldTextInput("i"), "VARIABLE")
        .appendField("from")
        .appendField(new Blockly.FieldNumber(0), "FROM")
        .appendField("to")
        .appendField(new Blockly.FieldNumber(10), "TO")
        .appendField("step")
        .appendField(new Blockly.FieldNumber(1), "STEP");
      this.appendStatementInput("DO").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonRed);
    },
  };

  Blockly.Blocks[v0BlockTypes.incrementVariable] = commandBlock("change", [["text", "VARIABLE", "score"], ["label", "by"], ["number", "AMOUNT", 1]], carbonGray);
  Blockly.Blocks[v0BlockTypes.decrementVariable] = commandBlock("change", [["text", "VARIABLE", "score"], ["label", "by"], ["number", "AMOUNT", -1]], carbonGray);
  Blockly.Blocks[v0BlockTypes.setVariable] = variableNumberCommand("set", "VALUE", "to", carbonGray);
  Blockly.Blocks[v0BlockTypes.initTextVariable] = {
    init() {
      this.appendDummyInput()
        .appendField("init text")
        .appendField(new Blockly.FieldTextInput("message"), "VARIABLE")
        .appendField("length")
        .appendField(new Blockly.FieldNumber(32, 1, 256, 1), "LENGTH")
        .appendField("to");
      this.appendValueInput("VALUE").setCheck("String");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonGray);
    },
  };
  Blockly.Blocks[v0BlockTypes.variableValue] = reporterTextBlock("value", "VARIABLE", "Number", carbonGray);
  Blockly.Blocks[v0BlockTypes.textVariableValue] = reporterTextBlock("text value", "VARIABLE", "String", carbonGray);
  Blockly.Blocks[v0BlockTypes.setArrayItem] = {
    init() {
      this.appendDummyInput()
        .appendField("set array")
        .appendField(new Blockly.FieldTextInput("buffer"), "ARRAY");
      this.appendValueInput("INDEX").setCheck("Number").appendField("index");
      this.appendValueInput("VALUE").setCheck("Number").appendField("to");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonGray);
    },
  };
  Blockly.Blocks[v0BlockTypes.arrayItemValue] = {
    init() {
      this.appendValueInput("INDEX")
        .setCheck("Number")
        .appendField("array")
        .appendField(new Blockly.FieldTextInput("buffer"), "ARRAY")
        .appendField("index");
      this.setOutput(true, "Number");
      setBlockColor(this, carbonGray);
    },
  };
  Blockly.Blocks[v0BlockTypes.arrayLength] = reporterTextBlock("array length", "ARRAY", "Number", carbonGray);
  Blockly.Blocks[v0BlockTypes.clearArray] = commandBlock("clear array", [["text", "ARRAY", "buffer"]], carbonGray);

  Blockly.Blocks[v0BlockTypes.compare] = {
    init() {
      this.appendValueInput("A").setCheck("Number");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown(compareOperatorOptions), "OP");
      this.appendValueInput("B").setCheck("Number");
      this.setOutput(true, "Boolean");
      setBlockColor(this, carbonRed);
    },
  };
  Blockly.Blocks[v0BlockTypes.buttonDown] = buttonStateBlock("down");
  Blockly.Blocks[v0BlockTypes.buttonPressed] = buttonStateBlock("pressed");
  Blockly.Blocks[v0BlockTypes.buttonReleased] = buttonStateBlock("released");
  Blockly.Blocks[v0BlockTypes.dpadAxis] = {
    init() {
      this.appendDummyInput()
        .appendField("dpad")
        .appendField(new Blockly.FieldDropdown(axisOptions), "AXIS")
        .appendField("player")
        .appendField(new Blockly.FieldDropdown(playerOptions), "PLAYER");
      this.setOutput(true, "Number");
      setBlockColor(this, carbonRed);
    },
  };
  Blockly.Blocks[v0BlockTypes.mathBinary] = twoNumberOperatorBlock(mathOperatorOptions);
  Blockly.Blocks[v0BlockTypes.random] = twoNumberReporter("random", "FROM", "to", "TO", carbonRed);
  Blockly.Blocks[v0BlockTypes.mathUnary] = unaryNumberBlock(mathUnaryOptions);
  Blockly.Blocks[v0BlockTypes.minMax] = twoNumberOperatorBlock(minMaxOptions);
  Blockly.Blocks[v0BlockTypes.clamp] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("clamp");
      this.appendValueInput("MIN").setCheck("Number").appendField("min");
      this.appendValueInput("MAX").setCheck("Number").appendField("max");
      this.setOutput(true, "Number");
      setBlockColor(this, carbonRed);
    },
  };
  Blockly.Blocks[v0BlockTypes.trig] = unaryNumberBlock(trigOptions);
  Blockly.Blocks[v0BlockTypes.boolBinary] = twoBooleanOperatorBlock(booleanOperatorOptions);
  Blockly.Blocks[v0BlockTypes.boolNot] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Boolean").appendField("not");
      this.setOutput(true, "Boolean");
      setBlockColor(this, carbonRed);
    },
  };
  Blockly.Blocks[v0BlockTypes.stringLiteral] = reporterTextBlock("text", "TEXT", "String", carbonRed);
  Blockly.Blocks[v0BlockTypes.numberToString] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("number as text");
      this.setOutput(true, "String");
      setBlockColor(this, carbonRed);
    },
  };
  Blockly.Blocks[v0BlockTypes.numberToHexString] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("number as hex text");
      this.setOutput(true, "String");
      setBlockColor(this, carbonRed);
    },
  };

  Blockly.Blocks[v0BlockTypes.playSound] = soundCommand("play sound");
  Blockly.Blocks[v0BlockTypes.stopAllSounds] = commandBlock("stop all sounds", [], carbonGreen);
  Blockly.Blocks[v0BlockTypes.playSoundAndWait] = soundCommand("play sound and wait");
  Blockly.Blocks[v0BlockTypes.setSoundTempo] = commandBlock("set sound tempo", [["number", "BPM", 120]], carbonGreen);

  Blockly.Blocks[v0BlockTypes.defineProcedure] = {
    init() {
      this.appendDummyInput()
        .appendField("procedure")
        .appendField(new Blockly.FieldTextInput("do_thing"), "NAME");
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };
  Blockly.Blocks[v0BlockTypes.callProcedure] = commandBlock("call", [["text", "NAME", "do_thing"]], carbonPurple);
}

export function mountBlocklyWorkspace(
  element: HTMLElement,
  project?: Risc96Project,
  scriptId?: string,
): Blockly.WorkspaceSvg | undefined {
  registerV0Blocks();
  refreshProjectBlockOptions(project);
  element.replaceChildren();

  const workspace = Blockly.inject(element, {
    toolbox: v0Toolbox,
    trashcan: true,
  });

  const script = project?.scripts.find((candidate) => candidate.id === scriptId) ?? project?.scripts[0];
  const workspaceState = script?.workspace ?? (script?.target === "stage" || !script ? createStarterWorkspaceState(project) : createEmptyWorkspaceState());
  Blockly.serialization.workspaces.load(
    workspaceState as Parameters<typeof Blockly.serialization.workspaces.load>[0],
    workspace,
  );
  Blockly.svgResize(workspace);

  return workspace;
}

function reporterBlock(label: string, output: string, color: string): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendDummyInput().appendField(label);
      this.setOutput(true, output);
      setBlockColor(this, color);
    },
  };
}

function reporterTextBlock(label: string, fieldName: string, output: string, color: string): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendDummyInput().appendField(label).appendField(new Blockly.FieldTextInput("value"), fieldName);
      this.setOutput(true, output);
      setBlockColor(this, color);
    },
  };
}

function spritePropertyReporter(property: string): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendDummyInput()
        .appendField(`${property} of sprite`)
        .appendField(new Blockly.FieldTextInput("player"), "SPRITE");
      this.setOutput(true, "Number");
      setBlockColor(this, carbonTeal);
    },
  };
}

function spriteTwoNumberCommand(label: string, first: string, middle: string, second: string): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendValueInput(first)
        .setCheck("Number")
        .appendField(label)
        .appendField(new Blockly.FieldTextInput("player"), "SPRITE");
      this.appendValueInput(second).setCheck("Number").appendField(middle);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonTeal);
    },
  };
}

function shapeBlock(label: string, shape: string, firstSize: string, secondSize?: string): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendDummyInput()
        .appendField(label)
        .appendField(new Blockly.FieldDropdown(fillOptions), "FILL")
        .appendField(shape)
        .appendField("color")
        .appendField(new Blockly.FieldTextInput("#ffffff"), "COLOR");
      this.appendValueInput("X").setCheck("Number").appendField("x");
      this.appendValueInput("Y").setCheck("Number").appendField("y");
      this.appendValueInput(firstSize).setCheck("Number").appendField(firstSize.toLowerCase());
      if (secondSize) this.appendValueInput(secondSize).setCheck("Number").appendField(secondSize.toLowerCase());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonPurple);
    },
  };
}

function statementNumberBlock(label: string, inputName: string, suffix: string): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendValueInput(inputName).setCheck("Number").appendField(label);
      this.appendStatementInput("DO").appendField(suffix);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonRed);
    },
  };
}

function buttonStateBlock(state: ReturnType<typeof buttonStateOptions>[number][1]): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendDummyInput()
        .appendField("button player")
        .appendField(new Blockly.FieldDropdown(playerOptions), "PLAYER")
        .appendField(new Blockly.FieldDropdown(buttonOptions), "BUTTON")
        .appendField(state);
      this.setOutput(true, "Boolean");
      setBlockColor(this, carbonRed);
    },
  };
}

function twoNumberOperatorBlock(options: () => [string, string][]): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendValueInput("A").setCheck("Number");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown(options), "OP");
      this.appendValueInput("B").setCheck("Number");
      this.setOutput(true, "Number");
      setBlockColor(this, carbonRed);
    },
  };
}

function twoBooleanOperatorBlock(options: () => [string, string][]): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendValueInput("A").setCheck("Boolean");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown(options), "OP");
      this.appendValueInput("B").setCheck("Boolean");
      this.setOutput(true, "Boolean");
      setBlockColor(this, carbonRed);
    },
  };
}

function unaryNumberBlock(options: () => [string, string][]): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendValueInput("VALUE")
        .setCheck("Number")
        .appendField(new Blockly.FieldDropdown(options), "OP");
      this.setOutput(true, "Number");
      setBlockColor(this, carbonRed);
    },
  };
}

function soundCommand(label: string): { init(this: Blockly.Block): void } {
  return {
    init() {
      this.appendDummyInput()
        .appendField(label)
        .appendField(new Blockly.FieldDropdown(getSoundOptions), "SOUND");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, carbonGreen);
    },
  };
}
