import { describe, expect, it } from "vite-plus/test";

import { getSdkSourceFiles } from "./sdkSources.ts";

describe("getSdkSourceFiles", () => {
  it("loads the C SDK files as TCC inputs", () => {
    const files = getSdkSourceFiles();

    expect(files.map((file) => file.path)).toEqual([
      "risc96_blockly_runtime.h",
      "risc96_blockly_runtime.c",
    ]);
    expect(files[0].contents).toContain("typedef struct");
    expect(files[0].contents).toContain("r96_sound_def_t");
    expect(files[1].contents).toContain("void r96_engine_main(void)");
  });
});
