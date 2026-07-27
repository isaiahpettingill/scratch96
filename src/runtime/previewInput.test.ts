import { describe, expect, it, vi } from "vite-plus/test";

import type { ProjectControls } from "../project/model.ts";
import { PreviewInputTracker } from "./previewInput.ts";

const controls: ProjectControls = {
  players: [
    {
      player: 1,
      bindings: [{ control: "UP", input: { kind: "keyboard", code: "KeyW", label: "W" } }],
    },
  ],
};

describe("PreviewInputTracker", () => {
  it("does not capture bound keys while typing in text inputs", () => {
    const setControllerState = vi.fn();
    const tracker = new PreviewInputTracker(() => controls, setControllerState);
    const input = document.createElement("input");
    document.body.append(input);

    tracker.start();
    try {
      const inputEvent = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyW",
        key: "w",
      });

      input.dispatchEvent(inputEvent);

      expect(inputEvent.defaultPrevented).toBe(false);
    } finally {
      tracker.stop();
      input.remove();
    }
  });

  it("captures bound keys outside text inputs", () => {
    const setControllerState = vi.fn();
    const tracker = new PreviewInputTracker(() => controls, setControllerState);

    tracker.start();
    try {
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyW",
        key: "w",
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(setControllerState).toHaveBeenCalledWith(0, expect.objectContaining({ up: true }));
    } finally {
      tracker.stop();
    }
  });
});
