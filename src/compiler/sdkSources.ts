import runtimeSource from "../../sdk/risc96_blockly_runtime.c?raw";
import runtimeHeader from "../../sdk/risc96_blockly_runtime.h?raw";

import type { GeneratedSourceFile } from "./emitC.ts";

export function getSdkSourceFiles(): GeneratedSourceFile[] {
  return [
    { path: "risc96_blockly_runtime.h", contents: runtimeHeader },
    { path: "risc96_blockly_runtime.c", contents: runtimeSource },
  ];
}
