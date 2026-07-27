import type { Risc96Project } from "./model.ts";
import { createDefaultControls } from "./controls.ts";
import { defaultMsxFont } from "./defaultFonts.ts";

const transparent = 0x00000000;
const amber = 0x00f6b74b;
const brown = 0x006c4b2f;

export const sampleProject: Risc96Project = {
  version: 1,
  metadata: {
    name: "Hello Cartridge",
    author: "scratch96",
  },
  settings: {
    width: 320,
    height: 224,
    fps: 60,
  },
  controls: createDefaultControls(),
  sprites: [
    {
      id: "player",
      name: "Player",
      width: 4,
      height: 4,
      palette: [
        { index: 0, color: transparent },
        { index: 1, color: amber },
        { index: 2, color: brown },
      ],
      transparentIndex: 0,
      frames: [
        {
          id: "idle",
          colorIndexes: [0, 1, 1, 0, 1, 2, 2, 1, 1, 2, 2, 1, 0, 1, 1, 0],
        },
      ],
      colliders: [{ id: "body", name: "Body", shape: "rect", x: 0, y: 0, width: 4, height: 4 }],
    },
  ],
  sounds: [
    {
      id: "coin",
      name: "Coin",
      format: "tone_sequence",
      notes: [
        { freq: 880, ms: 80 },
        { freq: 1320, ms: 120 },
      ],
    },
  ],
  fonts: [defaultMsxFont],
  tilemaps: [],
  scripts: [
    {
      id: "stage-main",
      target: "stage",
      blocks: {
        start: [
          { kind: "setResolution", width: 320, height: 224 },
          { kind: "debugLog", text: "Hello from scratch96" },
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
            text: "Hello World",
            x: 96,
            y: 108,
            color: 0x00ffffff,
          },
        ],
      },
    },
  ],
};
