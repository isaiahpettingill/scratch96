import * as Blockly from "blockly/core";
import { describe, expect, it } from "vite-plus/test";

import {
  createStarterWorkspaceState,
  lowerStarterWorkspaceToBlocks,
  lowerWorkspaceToBlocks,
  registerV0Blocks,
  v0BlockTypes,
  v0Toolbox,
} from "./v0Block.ts";

describe("v0 Blockly blocks", () => {
  it("registers and constructs the procedural v0 blocks", () => {
    registerV0Blocks();
    const workspace = new Blockly.Workspace();

    try {
      for (const blockType of Object.values(v0BlockTypes)) {
        expect(Blockly.Blocks[blockType], blockType).toBeDefined();
        expect(workspace.newBlock(blockType).type).toBe(blockType);
      }
    } finally {
      workspace.dispose();
    }
  });

  it("exposes procedural toolbox categories", () => {
    expect(v0Toolbox.contents.map((category) => category.name)).toEqual([
      "Program",
      "Drawing",
      "Sprites",
      "Control",
      "Input",
      "Variables",
      "Math",
      "Sound",
      "Procedures",
      "Debug",
    ]);
  });

  it("does not expose removed Scratch/event/clone blocks", () => {
    expect(Object.keys(v0BlockTypes)).not.toContain("publishEvent");
    expect(Object.keys(v0BlockTypes)).not.toContain("broadcastAndWait");
    expect(Object.keys(v0BlockTypes)).not.toContain("onEvent");
    expect(Object.keys(v0BlockTypes)).not.toContain("onButtonPressed");
    expect(Object.keys(v0BlockTypes)).not.toContain("createClone");
    expect(Object.keys(v0BlockTypes)).not.toContain("deleteClone");
  });

  it("lowers the starter workspace to setup/update/draw buckets", () => {
    registerV0Blocks();
    const workspace = new Blockly.Workspace();

    try {
      Blockly.serialization.workspaces.load(
        createStarterWorkspaceState() as Parameters<typeof Blockly.serialization.workspaces.load>[0],
        workspace,
      );

      expect(lowerWorkspaceToBlocks(workspace)).toEqual(lowerStarterWorkspaceToBlocks());
    } finally {
      workspace.dispose();
    }
  });

  it("lists registered blocks in the toolbox", () => {
    const toolboxBlockTypes = collectToolboxBlockTypes(v0Toolbox.contents);
    toolboxBlockTypes.delete("math_number");

    expect([...toolboxBlockTypes].sort(compareStrings)).toEqual(
      Object.values(v0BlockTypes).sort(compareStrings),
    );
  });
});

function collectToolboxBlockTypes(contents: unknown[]): Set<string> {
  const blockTypes = new Set<string>();

  for (const item of contents) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.kind === "block" && typeof record.type === "string") blockTypes.add(record.type);
    if (Array.isArray(record.contents)) {
      for (const blockType of collectToolboxBlockTypes(record.contents)) blockTypes.add(blockType);
    }
  }

  return blockTypes;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
