import type { PlayerControlMapping, ProjectControls, Risc96Button } from "./model.ts";

export const risc96Buttons: Risc96Button[] = [
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "A",
  "B",
  "X",
  "Y",
  "L",
  "R",
  "SELECT",
  "START",
];

const playerOneDefaults: Record<Risc96Button, string> = {
  UP: "ArrowUp",
  DOWN: "ArrowDown",
  LEFT: "ArrowLeft",
  RIGHT: "ArrowRight",
  A: "KeyZ",
  B: "KeyX",
  X: "KeyA",
  Y: "KeyS",
  L: "KeyQ",
  R: "KeyW",
  SELECT: "ShiftRight",
  START: "Enter",
};

export function createDefaultControls(): ProjectControls {
  return {
    players: [1, 2, 3, 4].map((player) => createPlayerDefaults(player as 1 | 2 | 3 | 4)),
  };
}

function createPlayerDefaults(player: 1 | 2 | 3 | 4): PlayerControlMapping {
  return {
    player,
    bindings: risc96Buttons.map((control) => ({
      control,
      input:
        player === 1
          ? { kind: "keyboard", code: playerOneDefaults[control], label: playerOneDefaults[control] }
          : { kind: "gamepad", gamepad: player - 1, control, label: `Gamepad ${player} ${control}` },
    })),
  };
}
