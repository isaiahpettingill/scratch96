import { describe, expect, it } from "vite-plus/test";

import { serializeProjectJson } from "../../project/projectJson.ts";
import { sampleProject } from "../../project/sampleProject.ts";
import { loadProjectFile } from "./projectFiles.ts";

describe("loadProjectFile", () => {
  it("loads a saved scratch96 project", async () => {
    const file = new File([serializeProjectJson(sampleProject)], "hello.scratch96.json", {
      type: "application/json",
    });

    await expect(loadProjectFile(file)).resolves.toEqual({ ok: true, project: sampleProject });
  });

  it("rejects non-project file extensions", async () => {
    const file = new File(["{}"], "hello.txt", { type: "text/plain" });

    await expect(loadProjectFile(file)).resolves.toEqual({
      ok: false,
      diagnostics: ["Project files must be .s96, .scratch96.json, or .json files."],
    });
  });
});
