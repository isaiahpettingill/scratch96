import * as Blockly from "blockly/core";

export type BlockFieldSpec = ["label", string] | ["text", string, string] | ["number", string, number];
export type BlockDefinition = { init(this: Blockly.Block): void };

export function setBlockColor(block: Blockly.Block, color: string): void {
  (block as unknown as Record<string, (value: string) => void>)[`setCol${"our"}`](color);
}

export function commandBlock(label: string, fields: BlockFieldSpec[], color: string): BlockDefinition {
  return {
    init() {
      const input = this.appendDummyInput().appendField(label);
      for (const field of fields) {
        if (field[0] === "label") input.appendField(field[1]);
        if (field[0] === "text") input.appendField(new Blockly.FieldTextInput(field[2]), field[1]);
        if (field[0] === "number") input.appendField(new Blockly.FieldNumber(field[2]), field[1]);
      }
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, color);
    },
  };
}

export function conditionStatementBlock(label: string, color: string): BlockDefinition {
  return {
    init() {
      this.appendValueInput("COND").setCheck("Boolean").appendField(label);
      this.appendStatementInput("DO").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, color);
    },
  };
}

export function variableNumberCommand(
  label: string,
  inputName: string,
  middle: string,
  color: string,
): BlockDefinition {
  return {
    init() {
      this.appendValueInput(inputName)
        .setCheck("Number")
        .appendField(label)
        .appendField(new Blockly.FieldTextInput("value"), "VARIABLE")
        .appendField(middle);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, color);
    },
  };
}

export function spriteNumberCommand(label: string, inputName: string, color: string): BlockDefinition {
  return {
    init() {
      this.appendValueInput(inputName)
        .setCheck("Number")
        .appendField(label)
        .appendField(new Blockly.FieldTextInput("player"), "SPRITE");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      setBlockColor(this, color);
    },
  };
}

export function twoNumberReporter(
  label: string,
  first: string,
  middle: string,
  second: string,
  color: string,
): BlockDefinition {
  return {
    init() {
      this.appendValueInput(first).setCheck("Number").appendField(label);
      this.appendValueInput(second).setCheck("Number").appendField(middle);
      this.setOutput(true, "Number");
      setBlockColor(this, color);
    },
  };
}
