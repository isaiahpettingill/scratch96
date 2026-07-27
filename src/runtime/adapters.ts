export type CartridgeElf = {
  bytes: Uint8Array;
};

export type TccCompiler = {
  compile(sourceFiles: SourceFile[]): Promise<CartridgeElf>;
};

export type SourceFile = {
  path: string;
  contents: string | Uint8Array;
};

export type Risc96PreviewRuntime = {
  load(elf: CartridgeElf): Promise<void>;
  run(): void;
  stop(): void;
  reset(): Promise<void>;
  setControllerState(port: number, state: ControllerState): void;
};

export type ControllerState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  l: boolean;
  r: boolean;
  select: boolean;
  start: boolean;
};
