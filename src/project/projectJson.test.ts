import { describe, expect, it } from "vite-plus/test";

import { sampleProject } from "./sampleProject.ts";
import { parseProjectJson, serializeProjectJson } from "./projectJson.ts";

describe("project JSON", () => {
  it("round-trips a project", () => {
    const serialized = serializeProjectJson(sampleProject);
    const result = parseProjectJson(serialized);

    expect(serialized.endsWith("\n")).toBe(true);
    expect(result).toEqual({ ok: true, project: sampleProject });
  });

  it("reports malformed JSON", () => {
    const result = parseProjectJson("{");

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.diagnostics).toHaveLength(1);
  });

  it("reports missing required project fields", () => {
    const result = parseProjectJson(JSON.stringify({ version: 2 }));

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        "Project version must be 1.",
        "Project metadata.name is required.",
        "Project settings are required.",
        "Project sprites must be an array.",
        "Project sounds must be an array.",
        "Project scripts must be an array.",
      ],
    });
  });
});
