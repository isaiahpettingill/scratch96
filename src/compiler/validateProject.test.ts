import { describe, expect, it } from "vite-plus/test";

import { validateProject } from "./validateProject.ts";
import { sampleProject } from "../project/sampleProject.ts";

describe("validateProject", () => {
  it("accepts the sample project", () => {
    expect(validateProject(sampleProject)).toEqual([]);
  });

  it("reports invalid indexed sprite frames", () => {
    const project = structuredClone(sampleProject);
    project.sprites[0].frames[0].colorIndexes = [99];

    expect(validateProject(project)).toEqual([
      "Frame idle in sprite player has the wrong pixel count.",
      "Frame idle in sprite player references missing palette index 99.",
    ]);
  });
});
