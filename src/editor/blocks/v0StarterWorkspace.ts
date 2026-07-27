import type { Risc96Project, SerializedBlocks } from "../../project/model.ts";
import { v0BlockTypes } from "./v0BlockTypes.ts";

export type StarterWorkspaceState = {
  variables?: Array<{ name: string; id: string; type: string }>;
  blocks: {
    languageVersion: number;
    blocks: StarterBlock[];
  };
};

type StarterBlock = {
  type: string;
  x?: number;
  y?: number;
  fields?: Record<string, string | number>;
  inputs?: Record<string, { shadow?: StarterBlock; block?: StarterBlock }>;
  next?: { block: StarterBlock };
};

export function createStarterWorkspaceState(project?: Risc96Project): StarterWorkspaceState {
  const width = project?.settings.width ?? 320;
  const height = project?.settings.height ?? 224;

  return {
    variables: [],
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: v0BlockTypes.setup,
          x: 24,
          y: 24,
          fields: { WIDTH: width, HEIGHT: height },
          next: {
            block: {
              type: v0BlockTypes.debugLog,
              fields: { TEXT: "Hello" },
              next: {
                block: {
                  type: v0BlockTypes.setClearColor,
                  fields: { COLOR: "#102030" },
                  next: {
                    block: {
                      type: v0BlockTypes.createSprite,
                      fields: { SPRITE: "player", VARIABLE: "player" },
                      inputs: { X: numberShadow(100), Y: numberShadow(80) },
                    },
                  },
                },
              },
            },
          },
        },
        {
          type: v0BlockTypes.updateLoop,
          x: 24,
          y: 248,
          next: {
            block: {
              type: v0BlockTypes.ifThen,
              inputs: {
                COND: {
                  shadow: {
                    type: v0BlockTypes.buttonDown,
                    fields: { PLAYER: "1", BUTTON: "RIGHT" },
                  },
                },
                DO: {
                  block: {
                  type: v0BlockTypes.moveSprite,
                  fields: { SPRITE: "player" },
                  inputs: { DX: numberShadow(2), DY: numberShadow(0) },
                  },
                },
              },
            },
          },
        },
        {
          type: v0BlockTypes.drawLoop,
          x: 360,
          y: 24,
          next: {
            block: {
              type: v0BlockTypes.clearScreen,
              fields: { COLOR: "#102030" },
              next: {
                block: {
                  type: v0BlockTypes.drawSprite,
                  fields: { SPRITE: "player" },
                  next: {
                    block: {
                      type: v0BlockTypes.drawText,
                      fields: { FONT: "msx_international_8x8", COLOR: "#ffffff" },
                      inputs: { TEXT: stringShadow("Hello World"), X: numberShadow(96), Y: numberShadow(108) },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  };
}

export function createEmptyWorkspaceState(): StarterWorkspaceState {
  return { variables: [], blocks: { languageVersion: 0, blocks: [] } };
}

export function lowerStarterWorkspaceToBlocks(): SerializedBlocks {
  return {
    start: [
      { kind: "setResolution", width: 320, height: 224 },
      { kind: "debugLog", text: "Hello" },
      { kind: "setClearColor", color: 0x00102030 },
      { kind: "createSprite", variable: "player", spriteId: "player", x: 100, y: 80 },
    ],
    update: [
      {
        kind: "if",
        condition: { kind: "buttonDown", player: 1, button: "RIGHT" },
        thenCommands: [
          {
            kind: "moveSprite",
            sprite: "player",
            dx: { kind: "integer", value: 2 },
            dy: { kind: "integer", value: 0 },
          },
        ],
        elseCommands: [],
      },
    ],
    draw: [
      { kind: "clearScreen", color: 0x00102030 },
      { kind: "drawSprite", sprite: "player" },
      {
        kind: "drawText",
        fontId: "msx_international_8x8",
        text: { kind: "literal", value: "Hello World" },
        x: { kind: "integer", value: 96 },
        y: { kind: "integer", value: 108 },
        color: 0x00ffffff,
      },
    ],
  };
}

function numberShadow(value: number): { shadow: StarterBlock } {
  return { shadow: { type: "math_number", fields: { NUM: value } } };
}

function stringShadow(value: string): { shadow: StarterBlock } {
  return { shadow: { type: v0BlockTypes.stringLiteral, fields: { TEXT: value } } };
}
