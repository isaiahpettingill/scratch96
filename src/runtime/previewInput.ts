import type { ControllerInput, ProjectControls, Risc96Button } from "../project/model.ts";
import type { ControllerState } from "./adapters.ts";

type GamepadDirection = "+" | "-";

const emptyControllerState: ControllerState = {
  up: false,
  down: false,
  left: false,
  right: false,
  a: false,
  b: false,
  x: false,
  y: false,
  l: false,
  r: false,
  select: false,
  start: false,
};

const controlStateKeys: Record<Risc96Button, keyof ControllerState> = {
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
  A: "a",
  B: "b",
  X: "x",
  Y: "y",
  L: "l",
  R: "r",
  SELECT: "select",
  START: "start",
};

const gamepadButtonIndexes: Record<string, number> = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  L: 4,
  R: 5,
  SELECT: 8,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
};

export class PreviewInputTracker {
  private readonly pressedKeys = new Set<string>();
  private readonly pressedMouseButtons = new Set<number>();
  private inputFrameHandle?: number;
  private readonly onPreviewKeyDown = (event: KeyboardEvent): void => this.setPreviewKey(event, true);
  private readonly onPreviewKeyUp = (event: KeyboardEvent): void => this.setPreviewKey(event, false);
  private readonly onPreviewMouseDown = (event: MouseEvent): void => this.setPreviewMouseButton(event, true);
  private readonly onPreviewMouseUp = (event: MouseEvent): void => this.setPreviewMouseButton(event, false);
  private readonly onPreviewBlur = (): void => this.clear();

  constructor(
    private readonly controls: () => ProjectControls,
    private readonly setControllerState: (playerIndex: number, state: ControllerState) => void,
  ) {}

  start(): void {
    window.addEventListener("keydown", this.onPreviewKeyDown, true);
    window.addEventListener("keyup", this.onPreviewKeyUp, true);
    window.addEventListener("mousedown", this.onPreviewMouseDown, true);
    window.addEventListener("mouseup", this.onPreviewMouseUp, true);
    window.addEventListener("blur", this.onPreviewBlur);
    this.poll();
  }

  stop(): void {
    window.removeEventListener("keydown", this.onPreviewKeyDown, true);
    window.removeEventListener("keyup", this.onPreviewKeyUp, true);
    window.removeEventListener("mousedown", this.onPreviewMouseDown, true);
    window.removeEventListener("mouseup", this.onPreviewMouseUp, true);
    window.removeEventListener("blur", this.onPreviewBlur);
    if (this.inputFrameHandle !== undefined) {
      cancelAnimationFrame(this.inputFrameHandle);
      this.inputFrameHandle = undefined;
    }
    this.clear();
  }

  update(): void {
    const gamepads = navigator.getGamepads?.() ?? [];
    for (const player of this.controls().players) {
      const state: ControllerState = { ...emptyControllerState };
      for (const binding of player.bindings) {
        if (this.isInputPressed(binding.input, gamepads)) {
          state[controlStateKeys[binding.control]] = true;
        }
      }
      this.setControllerState(player.player - 1, state);
    }
  }

  private poll(): void {
    this.update();
    this.inputFrameHandle = requestAnimationFrame(() => this.poll());
  }

  private setPreviewKey(event: KeyboardEvent, pressed: boolean): void {
    if (isEditableTarget(event.target)) return;
    if (!this.hasKeyboardBinding(event.code)) return;

    event.preventDefault();
    if (pressed) this.pressedKeys.add(event.code);
    else this.pressedKeys.delete(event.code);
    this.update();
  }

  private setPreviewMouseButton(event: MouseEvent, pressed: boolean): void {
    if (isEditableTarget(event.target)) return;
    if (!this.hasMouseBinding(event.button)) return;

    event.preventDefault();
    if (pressed) this.pressedMouseButtons.add(event.button);
    else this.pressedMouseButtons.delete(event.button);
    this.update();
  }

  private clear(): void {
    this.pressedKeys.clear();
    this.pressedMouseButtons.clear();
    this.update();
  }

  private hasKeyboardBinding(code: string): boolean {
    return this.controls().players.some((player) =>
      player.bindings.some((binding) => binding.input.kind === "keyboard" && binding.input.code === code),
    );
  }

  private hasMouseBinding(button: number): boolean {
    return this.controls().players.some((player) =>
      player.bindings.some((binding) => binding.input.kind === "mouse" && binding.input.button === button),
    );
  }

  private isInputPressed(input: ControllerInput, gamepads: readonly (Gamepad | null)[]): boolean {
    if (input.kind === "keyboard") return this.pressedKeys.has(input.code);
    if (input.kind === "mouse") return this.pressedMouseButtons.has(input.button);

    const gamepad = gamepads[input.gamepad];
    if (!gamepad) return false;

    const buttonMatch = /^button:(\d+)$/.exec(input.control);
    if (buttonMatch) return gamepad.buttons[Number(buttonMatch[1])]?.pressed ?? false;

    const axisMatch = /^axis:(\d+):([+-])$/.exec(input.control);
    if (axisMatch) {
      return isGamepadAxisPressed(gamepad.axes[Number(axisMatch[1])] ?? 0, axisMatch[2] as GamepadDirection);
    }

    return gamepad.buttons[gamepadButtonIndexes[input.control]]?.pressed ?? false;
  }
}

function isGamepadAxisPressed(value: number, direction: GamepadDirection): boolean {
  return direction === "+" ? value > 0.6 : value < -0.6;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable
  );
}
