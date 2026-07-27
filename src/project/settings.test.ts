import { describe, expect, it } from "vite-plus/test";

import { sampleProject } from "./sampleProject.ts";
import { updateProjectSettings } from "./settings.ts";

describe("updateProjectSettings", () => {
  it("updates resolution without mutating the original project", () => {
    const updated = updateProjectSettings(sampleProject, { width: 400, height: 240 });

    expect(sampleProject.settings.width).toBe(320);
    expect(updated.settings).toMatchObject({ width: 400, height: 240, fps: 60 });
  });

  it("sanitizes invalid resolution values", () => {
    const updated = updateProjectSettings(sampleProject, { width: -10, height: 10.8 });

    expect(updated.settings.width).toBe(1);
    expect(updated.settings.height).toBe(10);
  });
});
