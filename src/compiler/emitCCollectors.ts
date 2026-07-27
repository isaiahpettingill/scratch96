import type {
  BooleanExpression,
  DrawCommand,
  NumericExpression,
  Risc96Project,
  StringExpression,
  UpdateCommand,
} from "../project/model.ts";

export function collectSpriteVariables(project: Risc96Project): string[] {
  const variables = new Set<string>();

  for (const script of project.scripts) {
    for (const command of script.blocks.start) {
      if (command.kind === "createSprite") variables.add(command.variable);
    }
    for (const command of script.blocks.update) collectSpriteVariablesFromCommand(command, variables);
    for (const eventScript of script.blocks.events ?? [])
      eventScript.commands.forEach((command) => collectSpriteVariablesFromCommand(command, variables));
    for (const buttonEventScript of script.blocks.buttonEvents ?? [])
      buttonEventScript.commands.forEach((command) => collectSpriteVariablesFromCommand(command, variables));
    for (const timerScript of script.blocks.timerEvents ?? [])
      timerScript.commands.forEach((command) => collectSpriteVariablesFromCommand(command, variables));
    for (const procedure of script.blocks.procedures ?? [])
      procedure.commands.forEach((command) => collectSpriteVariablesFromCommand(command, variables));
  }

  return [...variables];
}

export function collectScalarVariables(project: Risc96Project): string[] {
  const variables = new Set<string>();

  for (const command of project.scripts.flatMap((script) => script.blocks.start)) {
    if (command.kind === "initTextVariable") collectStringExpressionVariables(command.value, variables);
  }
  for (const command of project.scripts.flatMap((script) => script.blocks.update))
    collectVariables(command, variables);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.events ?? [])
    .flatMap((eventScript) => eventScript.commands))
    collectVariables(command, variables);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.buttonEvents ?? [])
    .flatMap((buttonEventScript) => buttonEventScript.commands))
    collectVariables(command, variables);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.timerEvents ?? [])
    .flatMap((timerScript) => timerScript.commands))
    collectVariables(command, variables);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.procedures ?? [])
    .flatMap((procedure) => procedure.commands))
    collectVariables(command, variables);
  for (const command of project.scripts.flatMap((script) => script.blocks.draw ?? []))
    collectDrawVariables(command, variables);

  return [...variables];
}

export function collectTextVariables(project: Risc96Project): { name: string; length: number }[] {
  const variables = new Map<string, number>();
  const add = (name: string, length: number): void => {
    variables.set(name, Math.max(variables.get(name) ?? 0, Math.max(1, Math.min(256, length))));
  };

  for (const script of project.scripts) {
    for (const command of script.blocks.start) {
      if (command.kind === "initTextVariable") add(command.variable, command.length);
    }
    for (const command of script.blocks.update) collectCommandTextVariables(command, add);
    for (const command of script.blocks.events ?? []) command.commands.forEach((child) => collectCommandTextVariables(child, add));
    for (const command of script.blocks.buttonEvents ?? []) command.commands.forEach((child) => collectCommandTextVariables(child, add));
    for (const command of script.blocks.timerEvents ?? []) command.commands.forEach((child) => collectCommandTextVariables(child, add));
    for (const procedure of script.blocks.procedures ?? []) procedure.commands.forEach((child) => collectCommandTextVariables(child, add));
  }

  return [...variables].map(([name, length]) => ({ name, length }));
}

export function collectTextHandles(project: Risc96Project): string[] {
  const handles = new Set<string>();

  for (const command of project.scripts.flatMap((script) => script.blocks.update))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.events ?? [])
    .flatMap((eventScript) => eventScript.commands))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.buttonEvents ?? [])
    .flatMap((buttonEventScript) => buttonEventScript.commands))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.timerEvents ?? [])
    .flatMap((timerScript) => timerScript.commands))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.procedures ?? [])
    .flatMap((procedure) => procedure.commands))
    collectTextHandle(command, handles);

  return [...handles];
}

export function collectArrays(project: Risc96Project): string[] {
  const arrays = new Set<string>();
  for (const command of project.scripts.flatMap((script) => script.blocks.update))
    collectCommandArrays(command, arrays);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.events ?? [])
    .flatMap((eventScript) => eventScript.commands))
    collectCommandArrays(command, arrays);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.buttonEvents ?? [])
    .flatMap((buttonEventScript) => buttonEventScript.commands))
    collectCommandArrays(command, arrays);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.timerEvents ?? [])
    .flatMap((timerScript) => timerScript.commands))
    collectCommandArrays(command, arrays);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.procedures ?? [])
    .flatMap((procedure) => procedure.commands))
    collectCommandArrays(command, arrays);
  for (const command of project.scripts.flatMap((script) => script.blocks.draw ?? []))
    collectDrawArrays(command, arrays);
  return [...arrays];
}

export function collectTimers(project: Risc96Project): string[] {
  const timers = new Set<string>();
  for (const command of project.scripts.flatMap((script) => script.blocks.update))
    collectCommandTimers(command, timers);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.events ?? [])
    .flatMap((eventScript) => eventScript.commands))
    collectCommandTimers(command, timers);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.buttonEvents ?? [])
    .flatMap((buttonEventScript) => buttonEventScript.commands))
    collectCommandTimers(command, timers);
  for (const timerScript of project.scripts.flatMap((script) => script.blocks.timerEvents ?? [])) {
    timers.add(timerScript.timer);
    timerScript.commands.forEach((command) => collectCommandTimers(command, timers));
  }
  for (const command of project.scripts
    .flatMap((script) => script.blocks.procedures ?? [])
    .flatMap((procedure) => procedure.commands))
    collectCommandTimers(command, timers);
  for (const command of project.scripts.flatMap((script) => script.blocks.draw ?? []))
    collectDrawTimers(command, timers);
  return [...timers];
}

function collectSpriteVariablesFromCommand(command: UpdateCommand, variables: Set<string>): void {
  if (command.kind === "createSprite") variables.add(command.variable);
  if (command.kind === "createClone") variables.add(command.variable);
  if (command.kind === "if") {
    command.thenCommands.forEach((child) => collectSpriteVariablesFromCommand(child, variables));
    command.elseCommands.forEach((child) => collectSpriteVariablesFromCommand(child, variables));
  }
  if (isCommandContainer(command)) {
    command.commands.forEach((child) => collectSpriteVariablesFromCommand(child, variables));
  }
}

function collectDrawVariables(command: DrawCommand, variables: Set<string>): void {
  if (command.kind === "drawSpriteFrame") {
    collectExpressionVariables(command.x, variables);
    collectExpressionVariables(command.y, variables);
  }

  if (command.kind === "drawText" || command.kind === "drawTilemap") {
    collectMaybeExpressionVariables(command.x, variables);
    collectMaybeExpressionVariables(command.y, variables);
  }
  if (command.kind === "drawText" && typeof command.text !== "string") collectStringExpressionVariables(command.text, variables);

  if (command.kind === "drawRect") {
    collectExpressionVariables(command.x, variables);
    collectExpressionVariables(command.y, variables);
    collectExpressionVariables(command.width, variables);
    collectExpressionVariables(command.height, variables);
  }

  if (command.kind === "drawLine") {
    collectExpressionVariables(command.x1, variables);
    collectExpressionVariables(command.y1, variables);
    collectExpressionVariables(command.x2, variables);
    collectExpressionVariables(command.y2, variables);
  }

  if (command.kind === "drawCircle") {
    collectExpressionVariables(command.x, variables);
    collectExpressionVariables(command.y, variables);
    collectExpressionVariables(command.radius, variables);
  }
}

function collectTextHandle(command: UpdateCommand, handles: Set<string>): void {
  if (
    command.kind === "writeText" ||
    command.kind === "eraseText" ||
    command.kind === "moveText" ||
    command.kind === "setTextPosition"
  )
    handles.add(command.handle);

  if (command.kind === "if") {
    command.thenCommands.forEach((child) => collectTextHandle(child, handles));
    command.elseCommands.forEach((child) => collectTextHandle(child, handles));
  }

  if (isCommandContainer(command)) {
    command.commands.forEach((child) => collectTextHandle(child, handles));
  }
}

function collectVariables(command: UpdateCommand, variables: Set<string>): void {
  if (
    command.kind === "incrementVariable" ||
    command.kind === "decrementVariable" ||
    command.kind === "setVariable" ||
    command.kind === "setVariableToSpriteX" ||
    command.kind === "setVariableToSpriteY" ||
    command.kind === "for"
  ) {
    variables.add(command.variable);
  }

  if (
    command.kind === "setVariable" ||
    command.kind === "setSpriteX" ||
    command.kind === "setSpriteY" ||
    command.kind === "setSpritePosition" ||
    command.kind === "moveSprite" ||
    command.kind === "moveText" ||
    command.kind === "setTextPosition" ||
    command.kind === "pointSpriteDirection" ||
    command.kind === "turnSprite" ||
    command.kind === "setSpriteScale" ||
    command.kind === "changeSpriteScale" ||
    command.kind === "setSpriteEffect"
  ) {
    if ("value" in command) collectExpressionVariables(command.value, variables);
    if ("x" in command) collectExpressionVariables(command.x, variables);
    if ("y" in command) collectExpressionVariables(command.y, variables);
    if ("dx" in command) collectExpressionVariables(command.dx, variables);
    if ("dy" in command) collectExpressionVariables(command.dy, variables);
    if ("direction" in command) collectExpressionVariables(command.direction, variables);
    if ("degrees" in command) collectExpressionVariables(command.degrees, variables);
    if ("scale" in command) collectExpressionVariables(command.scale, variables);
    if ("amount" in command && typeof command.amount !== "number")
      collectExpressionVariables(command.amount, variables);
  }

  if (command.kind === "repeat") collectExpressionVariables(command.times, variables);
  if (command.kind === "initTextVariable") collectStringExpressionVariables(command.value, variables);
  if (command.kind === "drawText" && typeof command.text !== "string") collectStringExpressionVariables(command.text, variables);
  if (command.kind === "everyFrames") collectExpressionVariables(command.frames, variables);
  if (command.kind === "waitUntil" || command.kind === "repeatUntil")
    collectBooleanVariables(command.condition, variables);
  if (command.kind === "setVariable" || command.kind === "setSpriteX" || command.kind === "setSpriteY")
    collectExpressionVariables(command.value, variables);

  if (
    command.kind === "setArrayItem" ||
    command.kind === "addArrayItem" ||
    command.kind === "deleteArrayItem" ||
    command.kind === "insertArrayItem" ||
    command.kind === "replaceArrayItem"
  ) {
    if ("index" in command) collectExpressionVariables(command.index, variables);
    if ("value" in command) collectExpressionVariables(command.value, variables);
  }

  if (command.kind === "if" || command.kind === "while" || command.kind === "doWhile")
    collectBooleanVariables(command.condition, variables);

  if (command.kind === "if") {
    command.thenCommands.forEach((child) => collectVariables(child, variables));
    command.elseCommands.forEach((child) => collectVariables(child, variables));
  }

  if (isCommandContainer(command)) {
    command.commands.forEach((child) => collectVariables(child, variables));
  }
}

function collectStringExpressionVariables(expression: StringExpression, variables: Set<string>): void {
  if (expression.kind === "join") {
    collectStringExpressionVariables(expression.left, variables);
    collectStringExpressionVariables(expression.right, variables);
  }
  if (expression.kind === "numberToString" || expression.kind === "numberToHexString") collectExpressionVariables(expression.value, variables);
}

function collectCommandTextVariables(command: UpdateCommand, add: (name: string, length: number) => void): void {
  if (command.kind === "initTextVariable") add(command.variable, command.length);
  if (command.kind === "if") {
    command.thenCommands.forEach((child) => collectCommandTextVariables(child, add));
    command.elseCommands.forEach((child) => collectCommandTextVariables(child, add));
  }
  if (isCommandContainer(command)) command.commands.forEach((child) => collectCommandTextVariables(child, add));
}

function collectExpressionVariables(expression: NumericExpression, variables: Set<string>): void {
  if (expression.kind === "variable") variables.add(expression.name);
  if (expression.kind === "arrayItem") collectExpressionVariables(expression.index, variables);
  if (expression.kind === "random") {
    collectExpressionVariables(expression.from, variables);
    collectExpressionVariables(expression.to, variables);
  }
  if (expression.kind === "mathUnary") collectExpressionVariables(expression.value, variables);
  if (expression.kind === "minMax") {
    collectExpressionVariables(expression.left, variables);
    collectExpressionVariables(expression.right, variables);
  }
  if (expression.kind === "clamp") {
    collectExpressionVariables(expression.value, variables);
    collectExpressionVariables(expression.min, variables);
    collectExpressionVariables(expression.max, variables);
  }
  if (expression.kind === "letterOf") collectExpressionVariables(expression.index, variables);
  if (expression.kind === "binary") {
    collectExpressionVariables(expression.left, variables);
    collectExpressionVariables(expression.right, variables);
  }
}

function collectMaybeExpressionVariables(
  expression: NumericExpression | number,
  variables: Set<string>,
): void {
  if (typeof expression !== "number") collectExpressionVariables(expression, variables);
}

function collectBooleanVariables(expression: BooleanExpression, variables: Set<string>): void {
  if (expression.kind === "compare") {
    collectExpressionVariables(expression.left, variables);
    collectExpressionVariables(expression.right, variables);
  }
  if (expression.kind === "spriteTouchingTilemap") {
    collectExpressionVariables(expression.x, variables);
    collectExpressionVariables(expression.y, variables);
  }
  if (expression.kind === "and" || expression.kind === "or") {
    collectBooleanVariables(expression.left, variables);
    collectBooleanVariables(expression.right, variables);
  }
  if (expression.kind === "not") collectBooleanVariables(expression.value, variables);
}

function collectCommandArrays(command: UpdateCommand, arrays: Set<string>): void {
  if (
    command.kind === "setArrayItem" ||
    command.kind === "addArrayItem" ||
    command.kind === "deleteArrayItem" ||
    command.kind === "insertArrayItem" ||
    command.kind === "replaceArrayItem" ||
    command.kind === "clearArray"
  ) {
    arrays.add(command.array);
  }
  if (
    command.kind === "setArrayItem" ||
    command.kind === "insertArrayItem" ||
    command.kind === "replaceArrayItem"
  ) {
    collectExpressionArrays(command.index, arrays);
    collectExpressionArrays(command.value, arrays);
  }
  if (command.kind === "addArrayItem") collectExpressionArrays(command.value, arrays);
  if (command.kind === "deleteArrayItem") collectExpressionArrays(command.index, arrays);
  if (command.kind === "everyFrames") collectExpressionArrays(command.frames, arrays);
  if (command.kind === "setVariable" || command.kind === "setSpriteX" || command.kind === "setSpriteY")
    collectExpressionArrays(command.value, arrays);
  if (command.kind === "moveText") {
    collectExpressionArrays(command.dx, arrays);
    collectExpressionArrays(command.dy, arrays);
  }
  if (command.kind === "setTextPosition") {
    collectExpressionArrays(command.x, arrays);
    collectExpressionArrays(command.y, arrays);
  }
  if (command.kind === "if") {
    collectBooleanArrays(command.condition, arrays);
    command.thenCommands.forEach((child) => collectCommandArrays(child, arrays));
    command.elseCommands.forEach((child) => collectCommandArrays(child, arrays));
  }
  if (isCommandContainer(command)) command.commands.forEach((child) => collectCommandArrays(child, arrays));
}

function collectDrawArrays(command: DrawCommand, arrays: Set<string>): void {
  if (command.kind === "drawSpriteFrame") {
    collectExpressionArrays(command.x, arrays);
    collectExpressionArrays(command.y, arrays);
  }
  if (command.kind === "drawText" || command.kind === "drawTilemap") {
    collectMaybeExpressionArrays(command.x, arrays);
    collectMaybeExpressionArrays(command.y, arrays);
  }
  if (command.kind === "drawRect")
    [command.x, command.y, command.width, command.height].forEach((expression) =>
      collectExpressionArrays(expression, arrays),
    );
  if (command.kind === "drawLine")
    [command.x1, command.y1, command.x2, command.y2].forEach((expression) =>
      collectExpressionArrays(expression, arrays),
    );
  if (command.kind === "drawCircle")
    [command.x, command.y, command.radius].forEach((expression) => collectExpressionArrays(expression, arrays));
}

function collectExpressionArrays(expression: NumericExpression, arrays: Set<string>): void {
  if (expression.kind === "arrayItem") {
    arrays.add(expression.array);
    collectExpressionArrays(expression.index, arrays);
  }
  if (expression.kind === "binary") {
    collectExpressionArrays(expression.left, arrays);
    collectExpressionArrays(expression.right, arrays);
  }
  if (expression.kind === "random") {
    collectExpressionArrays(expression.from, arrays);
    collectExpressionArrays(expression.to, arrays);
  }
  if (expression.kind === "mathUnary") collectExpressionArrays(expression.value, arrays);
  if (expression.kind === "minMax") {
    collectExpressionArrays(expression.left, arrays);
    collectExpressionArrays(expression.right, arrays);
  }
  if (expression.kind === "clamp") {
    collectExpressionArrays(expression.value, arrays);
    collectExpressionArrays(expression.min, arrays);
    collectExpressionArrays(expression.max, arrays);
  }
}

function collectMaybeExpressionArrays(expression: NumericExpression | number, arrays: Set<string>): void {
  if (typeof expression !== "number") collectExpressionArrays(expression, arrays);
}

function collectBooleanArrays(expression: BooleanExpression, arrays: Set<string>): void {
  if (expression.kind === "compare") {
    collectExpressionArrays(expression.left, arrays);
    collectExpressionArrays(expression.right, arrays);
  }
  if (expression.kind === "spriteTouchingTilemap") {
    collectExpressionArrays(expression.x, arrays);
    collectExpressionArrays(expression.y, arrays);
  }
  if (expression.kind === "and" || expression.kind === "or") {
    collectBooleanArrays(expression.left, arrays);
    collectBooleanArrays(expression.right, arrays);
  }
  if (expression.kind === "not") collectBooleanArrays(expression.value, arrays);
}

function collectCommandTimers(command: UpdateCommand, timers: Set<string>): void {
  if (command.kind === "resetTimer") timers.add(command.timer);
  if (command.kind === "setVariable" || command.kind === "setSpriteX" || command.kind === "setSpriteY")
    collectExpressionTimers(command.value, timers);
  if (command.kind === "moveText") {
    collectExpressionTimers(command.dx, timers);
    collectExpressionTimers(command.dy, timers);
  }
  if (command.kind === "setTextPosition") {
    collectExpressionTimers(command.x, timers);
    collectExpressionTimers(command.y, timers);
  }
  if (command.kind === "setArrayItem") {
    collectExpressionTimers(command.index, timers);
    collectExpressionTimers(command.value, timers);
  }
  if (command.kind === "if") {
    collectBooleanTimers(command.condition, timers);
    command.thenCommands.forEach((child) => collectCommandTimers(child, timers));
    command.elseCommands.forEach((child) => collectCommandTimers(child, timers));
  }
  if (command.kind === "waitUntil" || command.kind === "repeatUntil") collectBooleanTimers(command.condition, timers);
  if (command.kind === "repeat") collectExpressionTimers(command.times, timers);
  if (command.kind === "everyFrames") collectExpressionTimers(command.frames, timers);
  if (isCommandContainer(command)) command.commands.forEach((child) => collectCommandTimers(child, timers));
}

function collectDrawTimers(command: DrawCommand, timers: Set<string>): void {
  if (command.kind === "drawSpriteFrame") {
    collectExpressionTimers(command.x, timers);
    collectExpressionTimers(command.y, timers);
  }
  if (command.kind === "drawText" || command.kind === "drawTilemap") {
    collectMaybeExpressionTimers(command.x, timers);
    collectMaybeExpressionTimers(command.y, timers);
  }
  if (command.kind === "drawRect")
    [command.x, command.y, command.width, command.height].forEach((expression) =>
      collectExpressionTimers(expression, timers),
    );
  if (command.kind === "drawLine")
    [command.x1, command.y1, command.x2, command.y2].forEach((expression) =>
      collectExpressionTimers(expression, timers),
    );
  if (command.kind === "drawCircle")
    [command.x, command.y, command.radius].forEach((expression) => collectExpressionTimers(expression, timers));
}

function collectExpressionTimers(expression: NumericExpression, timers: Set<string>): void {
  if (expression.kind === "timer") timers.add(expression.timer);
  if (expression.kind === "arrayItem") collectExpressionTimers(expression.index, timers);
  if (expression.kind === "random") {
    collectExpressionTimers(expression.from, timers);
    collectExpressionTimers(expression.to, timers);
  }
  if (expression.kind === "mathUnary") collectExpressionTimers(expression.value, timers);
  if (expression.kind === "letterOf") collectExpressionTimers(expression.index, timers);
  if (expression.kind === "minMax") {
    collectExpressionTimers(expression.left, timers);
    collectExpressionTimers(expression.right, timers);
  }
  if (expression.kind === "clamp") {
    collectExpressionTimers(expression.value, timers);
    collectExpressionTimers(expression.min, timers);
    collectExpressionTimers(expression.max, timers);
  }
  if (expression.kind === "binary") {
    collectExpressionTimers(expression.left, timers);
    collectExpressionTimers(expression.right, timers);
  }
}

function collectMaybeExpressionTimers(expression: NumericExpression | number, timers: Set<string>): void {
  if (typeof expression !== "number") collectExpressionTimers(expression, timers);
}

function collectBooleanTimers(expression: BooleanExpression, timers: Set<string>): void {
  if (expression.kind === "compare") {
    collectExpressionTimers(expression.left, timers);
    collectExpressionTimers(expression.right, timers);
  }
  if (expression.kind === "spriteTouchingTilemap") {
    collectExpressionTimers(expression.x, timers);
    collectExpressionTimers(expression.y, timers);
  }
  if (expression.kind === "and" || expression.kind === "or") {
    collectBooleanTimers(expression.left, timers);
    collectBooleanTimers(expression.right, timers);
  }
  if (expression.kind === "not") collectBooleanTimers(expression.value, timers);
}

function isCommandContainer(
  command: UpdateCommand,
): command is Extract<UpdateCommand, { commands: UpdateCommand[] }> {
  return (
    command.kind === "while" ||
    command.kind === "doWhile" ||
    command.kind === "for" ||
    command.kind === "onEvent" ||
    command.kind === "repeat" ||
    command.kind === "repeatUntil" ||
    command.kind === "everyFrames"
  );
}
