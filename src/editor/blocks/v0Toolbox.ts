import {
  blocklyColorKey,
  carbonBlue,
  carbonGray,
  carbonGreen,
  carbonPurple,
  carbonRed,
  carbonTeal,
  v0BlockTypes,
} from "./v0BlockTypes.ts";

export const v0Toolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Program",
      [blocklyColorKey]: carbonBlue,
      contents: [
        { kind: "block", type: v0BlockTypes.setup },
        { kind: "block", type: v0BlockTypes.updateLoop },
        { kind: "block", type: v0BlockTypes.drawLoop },
        { kind: "block", type: v0BlockTypes.yieldFrame },
        { kind: "block", type: v0BlockTypes.stopProgram },
        { kind: "block", type: v0BlockTypes.frameCount },
        { kind: "block", type: v0BlockTypes.screenWidth },
        { kind: "block", type: v0BlockTypes.screenHeight },
      ],
    },
    {
      kind: "category",
      name: "Drawing",
      [blocklyColorKey]: carbonPurple,
      contents: [
        { kind: "block", type: v0BlockTypes.setClearColor },
        { kind: "block", type: v0BlockTypes.clearScreen },
        { kind: "block", type: v0BlockTypes.drawSprite },
        shapeBlockWithNumberShadows(v0BlockTypes.drawSpriteFrame, { X: 100, Y: 80 }),
        shapeBlockWithNumberShadows(v0BlockTypes.drawRect, { X: 40, Y: 40, WIDTH: 32, HEIGHT: 24 }),
        shapeBlockWithNumberShadows(v0BlockTypes.drawLine, { X1: 0, Y1: 0, X2: 64, Y2: 64 }),
        shapeBlockWithNumberShadows(v0BlockTypes.drawCircle, { X: 80, Y: 60, RADIUS: 16 }),
        drawTextBlock(),
        shapeBlockWithNumberShadows(v0BlockTypes.drawTilemap, { X: 0, Y: 0 }),
      ],
    },
    {
      kind: "category",
      name: "Sprites",
      [blocklyColorKey]: carbonTeal,
      contents: [
        shapeBlockWithNumberShadows(v0BlockTypes.createSprite, { X: 100, Y: 80 }),
        blockWithNumberShadow(v0BlockTypes.setSpriteFrame, "FRAME", 0),
        shapeBlockWithNumberShadows(v0BlockTypes.moveSprite, { DX: 1, DY: 0 }),
        blockWithNumberShadow(v0BlockTypes.setSpriteX, "VALUE", 100),
        blockWithNumberShadow(v0BlockTypes.setSpriteY, "VALUE", 80),
        shapeBlockWithNumberShadows(v0BlockTypes.setSpritePosition, { X: 100, Y: 80 }),
        { kind: "block", type: v0BlockTypes.spriteXValue },
        { kind: "block", type: v0BlockTypes.spriteYValue },
        { kind: "block", type: v0BlockTypes.spriteWidthValue },
        { kind: "block", type: v0BlockTypes.spriteHeightValue },
        { kind: "block", type: v0BlockTypes.spriteTouching },
        shapeBlockWithNumberShadows(v0BlockTypes.spriteTouchingTilemap, { X: 0, Y: 0 }),
      ],
    },
    {
      kind: "category",
      name: "Control",
      [blocklyColorKey]: carbonRed,
      contents: [
        { kind: "block", type: v0BlockTypes.ifThen },
        { kind: "block", type: v0BlockTypes.ifThenElse },
        { kind: "block", type: v0BlockTypes.whileLoop },
        blockWithNumberShadow(v0BlockTypes.repeatTimes, "TIMES", 10),
        { kind: "block", type: v0BlockTypes.forLoop },
        blockWithNumberShadow(v0BlockTypes.everyFrames, "FRAMES", 60),
        { kind: "block", type: v0BlockTypes.breakLoop },
        { kind: "block", type: v0BlockTypes.continueLoop },
        { kind: "block", type: v0BlockTypes.waitFrames },
        { kind: "block", type: v0BlockTypes.waitSeconds },
      ],
    },
    {
      kind: "category",
      name: "Input",
      [blocklyColorKey]: carbonRed,
      contents: [
        { kind: "block", type: v0BlockTypes.buttonDown },
        { kind: "block", type: v0BlockTypes.buttonPressed },
        { kind: "block", type: v0BlockTypes.buttonReleased },
        { kind: "block", type: v0BlockTypes.dpadAxis },
      ],
    },
    {
      kind: "category",
      name: "Variables",
      [blocklyColorKey]: carbonGray,
      contents: [
        blockWithNumberShadow(v0BlockTypes.setVariable, "VALUE", 0),
        blockWithStringShadow(v0BlockTypes.initTextVariable, "VALUE", "Hello"),
        { kind: "block", type: v0BlockTypes.incrementVariable },
        { kind: "block", type: v0BlockTypes.decrementVariable },
        { kind: "block", type: v0BlockTypes.variableValue },
        { kind: "block", type: v0BlockTypes.textVariableValue },
        shapeBlockWithNumberShadows(v0BlockTypes.setArrayItem, { INDEX: 0, VALUE: 0 }),
        blockWithNumberShadow(v0BlockTypes.arrayItemValue, "INDEX", 0),
        { kind: "block", type: v0BlockTypes.arrayLength },
        { kind: "block", type: v0BlockTypes.clearArray },
      ],
    },
    {
      kind: "category",
      name: "Math",
      [blocklyColorKey]: carbonRed,
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: v0BlockTypes.mathBinary },
        shapeBlockWithNumberShadows(v0BlockTypes.random, { FROM: 1, TO: 10 }),
        blockWithNumberShadow(v0BlockTypes.mathUnary, "VALUE", 10),
        { kind: "block", type: v0BlockTypes.minMax },
        shapeBlockWithNumberShadows(v0BlockTypes.clamp, { VALUE: 0, MIN: 0, MAX: 100 }),
        blockWithNumberShadow(v0BlockTypes.trig, "VALUE", 90),
        { kind: "block", type: v0BlockTypes.compare },
        { kind: "block", type: v0BlockTypes.boolBinary },
        { kind: "block", type: v0BlockTypes.boolNot },
        { kind: "block", type: v0BlockTypes.stringLiteral },
        blockWithNumberShadow(v0BlockTypes.numberToString, "VALUE", 0),
        blockWithNumberShadow(v0BlockTypes.numberToHexString, "VALUE", 0),
      ],
    },
    {
      kind: "category",
      name: "Sound",
      [blocklyColorKey]: carbonGreen,
      contents: [
        { kind: "block", type: v0BlockTypes.playSound },
        { kind: "block", type: v0BlockTypes.playSoundAndWait },
        { kind: "block", type: v0BlockTypes.stopAllSounds },
        { kind: "block", type: v0BlockTypes.setSoundTempo },
      ],
    },
    {
      kind: "category",
      name: "Procedures",
      [blocklyColorKey]: carbonPurple,
      contents: [
        { kind: "block", type: v0BlockTypes.defineProcedure },
        { kind: "block", type: v0BlockTypes.callProcedure },
      ],
    },
    {
      kind: "category",
      name: "Debug",
      [blocklyColorKey]: carbonGreen,
      contents: [{ kind: "block", type: v0BlockTypes.debugLog }],
    },
  ],
};

function blockWithNumberShadow(type: string, inputName: string, value: number): Record<string, unknown> {
  return {
    kind: "block",
    type,
    inputs: {
      [inputName]: numberShadow(value),
    },
  };
}

function shapeBlockWithNumberShadows(type: string, values: Record<string, number>): Record<string, unknown> {
  return {
    kind: "block",
    type,
    inputs: Object.fromEntries(
      Object.entries(values).map(([inputName, value]) => [inputName, numberShadow(value)]),
    ),
  };
}

function drawTextBlock(): Record<string, unknown> {
  return {
    kind: "block",
    type: v0BlockTypes.drawText,
    inputs: {
      TEXT: stringShadow("Hello"),
      X: numberShadow(8),
      Y: numberShadow(8),
    },
  };
}

function blockWithStringShadow(type: string, inputName: string, value: string): Record<string, unknown> {
  return {
    kind: "block",
    type,
    inputs: {
      [inputName]: stringShadow(value),
    },
  };
}

function numberShadow(value: number): Record<string, unknown> {
  return { shadow: { type: "math_number", fields: { NUM: value } } };
}

function stringShadow(value: string): Record<string, unknown> {
  return { shadow: { type: v0BlockTypes.stringLiteral, fields: { TEXT: value } } };
}
