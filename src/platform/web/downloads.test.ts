import { describe, expect, it, vi } from "vite-plus/test";

import { compileProjectToC } from "../../compiler/emitC.ts";
import { sampleProject } from "../../project/sampleProject.ts";
import {
  createCartridgeElfFile,
  createGeneratedSourceFiles,
  createProjectJsonFile,
  downloadFile,
} from "./downloads.ts";

describe("web downloads", () => {
  it("creates a stable project JSON download", () => {
    const file = createProjectJsonFile(sampleProject);
    const contents = file.contents[0];

    expect(file.filename).toBe("Hello_Cartridge.scratch96.json");
    expect(file.type).toBe("application/json");
    expect(typeof contents).toBe("string");
    expect(JSON.parse(contents as string)).toMatchObject({ version: 1 });
  });

  it("creates generated source downloads", () => {
    const compiled = compileProjectToC(sampleProject);

    expect(createGeneratedSourceFiles(compiled.files).map((file) => file.filename)).toEqual([
      "risc96_blockly_runtime.h",
      "generated_assets.h",
      "risc96_blockly_runtime.c",
      "main.c",
    ]);
  });

  it("creates a cartridge ELF download", () => {
    const file = createCartridgeElfFile({ bytes: new Uint8Array([1, 2, 3]) });

    expect(file.filename).toBe("cartridge.elf");
    expect(file.type).toBe("application/octet-stream");
  });

  it("downloads through an anchor and revokes the object URL", () => {
    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:scratch96");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    downloadFile({ filename: "test.txt", contents: ["hello"], type: "text/plain" });

    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.download).toBe("test.txt");
    expect(anchor.href).toBe("blob:scratch96");
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:scratch96");

    createElement.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
