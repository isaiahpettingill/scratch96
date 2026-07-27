import type { ControllerInput } from "../project/model.ts";

export function captureNextControlInput(apply: (input: ControllerInput) => void): void {
  const onKey = (event: KeyboardEvent) => {
    event.preventDefault();
    cleanup();
    apply({ kind: "keyboard", code: event.code, label: event.code });
  };
  const onMouse = (event: MouseEvent) => {
    event.preventDefault();
    cleanup();
    apply({ kind: "mouse", button: event.button, label: `Mouse ${event.button}` });
  };
  const cleanup = () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("mousedown", onMouse, true);
  };

  window.addEventListener("keydown", onKey, true);
  window.addEventListener("mousedown", onMouse, true);
  void pollGamepads(cleanup, apply);
}

async function pollGamepads(cleanup: () => void, apply: (input: ControllerInput) => void): Promise<void> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const input = readPressedGamepadInput();

    if (input) {
      cleanup();
      apply(input);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function readPressedGamepadInput(): ControllerInput | undefined {
  const gamepads = navigator.getGamepads?.() ?? [];

  for (const gamepad of gamepads) {
    if (!gamepad) continue;
    const buttonIndex = gamepad.buttons.findIndex((button) => button.pressed);

    if (buttonIndex >= 0) {
      return {
        kind: "gamepad",
        gamepad: gamepad.index,
        control: `button:${buttonIndex}`,
        label: `Gamepad ${gamepad.index + 1} button ${buttonIndex}`,
      };
    }

    const axisIndex = gamepad.axes.findIndex((axis) => Math.abs(axis) > 0.6);

    if (axisIndex >= 0) {
      return {
        kind: "gamepad",
        gamepad: gamepad.index,
        control: `axis:${axisIndex}:${gamepad.axes[axisIndex] > 0 ? "+" : "-"}`,
        label: `Gamepad ${gamepad.index + 1} axis ${axisIndex}`,
      };
    }
  }

  return undefined;
}
