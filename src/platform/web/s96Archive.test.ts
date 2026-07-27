import { describe, expect, it } from "vite-plus/test";

import { sampleProject } from "../../project/sampleProject.ts";
import { createS96ProjectFile, loadS96ProjectFile } from "./s96Archive.ts";

describe("s96 project archives", () => {
  it("saves and restores a project archive", async () => {
    const download = createS96ProjectFile(sampleProject);
    const file = new File(download.contents, download.filename, { type: download.type });

    await expect(loadS96ProjectFile(file)).resolves.toEqual({ ok: true, project: sampleProject });
  });

  it("rejects non-s96 archive extensions", async () => {
    const file = new File(["{}"], "project.zip", { type: "application/zip" });

    await expect(loadS96ProjectFile(file)).resolves.toEqual({
      ok: false,
      diagnostics: ["Project archives must be .s96 files."],
    });
  });
});
