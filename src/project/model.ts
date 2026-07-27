export type Risc96Project = {
  version: 1;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  controls: ProjectControls;
  sprites: SpriteAsset[];
  sounds: SoundAsset[];
  fonts: FontAsset[];
  tilemaps: TilemapAsset[];
  scripts: Script[];
};

export type ProjectMetadata = {
  name: string;
  author?: string;
};

export type ProjectSettings = {
  width: number;
  height: number;
  fps: 60;
};

export type ProjectControls = {
  players: PlayerControlMapping[];
};

export type PlayerControlMapping = {
  player: 1 | 2 | 3 | 4;
  bindings: ControlBinding[];
};

export type ControlBinding = {
  control: Risc96Button;
  input: ControllerInput;
};

export type ControllerInput =
  | { kind: "keyboard"; code: string; label: string }
  | { kind: "mouse"; button: number; label: string }
  | { kind: "gamepad"; gamepad: number; control: string; label: string };

export type SpriteAsset = {
  id: string;
  name: string;
  source?: UploadedAssetSource;
  asepriteSource?: UploadedAssetSource;
  width: number;
  height: number;
  palette: SpritePaletteColor[];
  transparentIndex: number;
  frames: SpriteFrame[];
  animations?: SpriteAnimation[];
  colliders: SpriteCollider[];
};

export type SpriteAnimation = {
  id: string;
  name: string;
  from: number;
  to: number;
  direction: "forward" | "reverse" | "pingpong";
  repeat: number;
};

export type SpriteCollider = {
  id: string;
  name: string;
  shape: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UploadedAssetSource = {
  filename: string;
  mimeType: string;
  data: number[];
};

export type SpritePaletteColor = {
  index: number;
  color: number;
};

export type SpriteFrame = {
  id: string;
  name?: string;
  source?: UploadedAssetSource;
  colorIndexes: number[];
};

export type SoundAsset = PcmSoundAsset | SourceAudioSoundAsset | ToneSequenceSoundAsset;

export type FontAsset = {
  id: string;
  name: string;
  source?: UploadedAssetSource;
  lineHeight: number;
  glyphs: FontGlyph[];
};

export type FontGlyph = {
  code: number;
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
  bitmap: number[];
  runs?: FontGlyphRun[];
  rowMasks?: number[];
};

export type FontGlyphRun = {
  x: number;
  y: number;
  width: number;
};

export type TilemapAsset = {
  id: string;
  name: string;
  tilesetSpriteId: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tiles: number[];
  collisionTiles?: boolean[];
};

export type PcmSoundAsset = {
  id: string;
  name: string;
  source?: UploadedAssetSource;
  format: "pcm_s16_stereo_48000";
  data: number[];
};

export type SourceAudioSoundAsset = {
  id: string;
  name: string;
  source?: UploadedAssetSource;
  format: "source_audio";
  sourceFormat: "wav" | "mp3" | "ogg" | "flac" | "unknown";
  data: number[];
  converted?: PcmSoundAsset;
};

export type ToneSequenceSoundAsset = {
  id: string;
  name: string;
  source?: UploadedAssetSource;
  format: "tone_sequence";
  notes: ToneNote[];
};

export type ToneNote = {
  freq: number;
  ms: number;
};

export type Script = {
  id: string;
  target: "stage" | { spriteId: string };
  workspace?: unknown;
  blocks: SerializedBlocks;
};

export type SerializedBlocks = {
  start: StartCommand[];
  update: UpdateCommand[];
  draw?: DrawCommand[];
  events?: EventScript[];
  buttonEvents?: ButtonEventScript[];
  timerEvents?: TimerEventScript[];
  procedures?: ProcedureScript[];
};

export type EventScript = { event: string; commands: UpdateCommand[] };
export type ButtonEventScript = {
  player: 1 | 2 | 3 | 4;
  button: Risc96Button;
  commands: UpdateCommand[];
};
export type TimerEventScript = { timer: string; ticks: number; commands: UpdateCommand[] };
export type ProcedureScript = { name: string; commands: UpdateCommand[] };

export type StartCommand =
  | { kind: "setResolution"; width: number; height: number }
  | { kind: "debugLog"; text: string }
  | { kind: "initTextVariable"; variable: string; length: number; value: StringExpression }
  | { kind: "setBackground"; color: number }
  | { kind: "setClearColor"; color: number }
  | { kind: "createSprite"; variable: string; spriteId: string; x: number; y: number }
  | { kind: "setSpriteFrame"; variable: string; frame: number }
  | { kind: "publishEvent"; event: string }
  | { kind: "broadcastAndWait"; event: string }
  | { kind: "onEvent"; event: string; commands: UpdateCommand[] };

export type UpdateCommand =
  | { kind: "debugLog"; text: string }
  | { kind: "yieldFrame" }
  | {
      kind: "moveSpriteIfButtonDown";
      variable: string;
      player: 1 | 2 | 3 | 4;
      button: Risc96Button;
      dx: number;
      dy: number;
    }
  | { kind: "setSpriteFrame"; variable: string; frame: number }
  | { kind: "switchFrame"; sprite: string; frame: number }
  | { kind: "showSprite"; sprite: string }
  | { kind: "hideSprite"; sprite: string }
  | { kind: "playSound"; soundId: string }
  | { kind: "playSoundAndWait"; soundId: string; ticks: number }
  | { kind: "stopAllSounds" }
  | { kind: "setSoundTempo"; bpm: number }
  | { kind: "changeSoundTempo"; amount: number }
  | { kind: "wait"; ticks: number }
  | { kind: "waitUntil"; condition: BooleanExpression }
  | { kind: "repeat"; times: NumericExpression; commands: UpdateCommand[] }
  | { kind: "playSpriteAnimation"; sprite: string; animation: string }
  | { kind: "repeatUntil"; condition: BooleanExpression; commands: UpdateCommand[] }
  | { kind: "stopEverything" }
  | { kind: "break" }
  | { kind: "continue" }
  | { kind: "resetTimer"; timer: string }
  | { kind: "initTextVariable"; variable: string; length: number; value: StringExpression }
  | { kind: "incrementVariable"; variable: string; amount: number }
  | { kind: "decrementVariable"; variable: string; amount: number }
  | { kind: "setVariable"; variable: string; value: NumericExpression }
  | { kind: "setArrayItem"; array: string; index: NumericExpression; value: NumericExpression }
  | { kind: "addArrayItem"; array: string; value: NumericExpression }
  | { kind: "deleteArrayItem"; array: string; index: NumericExpression }
  | { kind: "insertArrayItem"; array: string; index: NumericExpression; value: NumericExpression }
  | { kind: "replaceArrayItem"; array: string; index: NumericExpression; value: NumericExpression }
  | { kind: "clearArray"; array: string }
  | { kind: "setVariableToSpriteX"; variable: string; sprite: string }
  | { kind: "setVariableToSpriteY"; variable: string; sprite: string }
  | { kind: "createSprite"; variable: string; spriteId: string; x: number; y: number }
  | { kind: "moveSprite"; sprite: string; dx: NumericExpression; dy: NumericExpression }
  | { kind: "setSpriteX"; sprite: string; value: NumericExpression }
  | { kind: "setSpriteY"; sprite: string; value: NumericExpression }
  | { kind: "setSpritePosition"; sprite: string; x: NumericExpression; y: NumericExpression }
  | { kind: "goToSprite"; sprite: string; target: string }
  | { kind: "pointSpriteDirection"; sprite: string; direction: NumericExpression }
  | { kind: "turnSprite"; sprite: string; degrees: NumericExpression }
  | { kind: "setSpriteScale"; sprite: string; scale: NumericExpression }
  | { kind: "changeSpriteScale"; sprite: string; amount: NumericExpression }
  | {
      kind: "setSpriteEffect";
      sprite: string;
      effect: "brightness" | "invert";
      value: NumericExpression;
    }
  | { kind: "clearSpriteEffects"; sprite: string }
  | { kind: "bringSpriteToFront"; sprite: string }
  | { kind: "sendSpriteToBack"; sprite: string }
  | { kind: "createClone"; source: string; variable: string }
  | { kind: "deleteClone"; sprite: string }
  | { kind: "drawText"; fontId: string; text: StringValue; x: NumericExpression | number; y: NumericExpression | number; color: number }
  | {
      kind: "writeText";
      handle: string;
      fontId: string;
      text: string;
      x: number;
      y: number;
      scale: number;
      color: number;
    }
  | { kind: "eraseText"; handle: string }
  | { kind: "moveText"; handle: string; dx: NumericExpression; dy: NumericExpression }
  | { kind: "setTextPosition"; handle: string; x: NumericExpression; y: NumericExpression }
  | { kind: "drawTilemap"; tilemapId: string; x: NumericExpression | number; y: NumericExpression | number }
  | { kind: "clearScreen"; color: number }
  | { kind: "drawSprite"; sprite: string }
  | {
      kind: "if";
      condition: BooleanExpression;
      thenCommands: UpdateCommand[];
      elseCommands: UpdateCommand[];
    }
  | { kind: "while"; condition: BooleanExpression; commands: UpdateCommand[] }
  | { kind: "doWhile"; condition: BooleanExpression; commands: UpdateCommand[] }
  | {
      kind: "for";
      variable: string;
      from: number;
      to: number;
      step: number;
      commands: UpdateCommand[];
    }
  | { kind: "everyFrames"; frames: NumericExpression; commands: UpdateCommand[] }
  | { kind: "publishEvent"; event: string }
  | { kind: "broadcastAndWait"; event: string }
  | { kind: "callProcedure"; name: string }
  | { kind: "onEvent"; event: string; commands: UpdateCommand[] };

export type DrawCommand =
  | { kind: "clearScreen"; color: number }
  | { kind: "drawSprite"; sprite: string }
  | { kind: "drawSpriteFrame"; spriteId: string; frame: number; x: NumericExpression; y: NumericExpression }
  | { kind: "drawText"; fontId: string; text: StringValue; x: NumericExpression | number; y: NumericExpression | number; color: number }
  | { kind: "drawTilemap"; tilemapId: string; x: NumericExpression | number; y: NumericExpression | number }
  | {
      kind: "drawRect";
      x: NumericExpression;
      y: NumericExpression;
      width: NumericExpression;
      height: NumericExpression;
      color: number;
      filled: boolean;
    }
  | {
      kind: "drawLine";
      x1: NumericExpression;
      y1: NumericExpression;
      x2: NumericExpression;
      y2: NumericExpression;
      color: number;
    }
  | {
      kind: "drawCircle";
      x: NumericExpression;
      y: NumericExpression;
      radius: NumericExpression;
      color: number;
      filled: boolean;
    };

export type BooleanExpression =
  | { kind: "literal"; value: boolean }
  | {
      kind: "compare";
      left: NumericExpression;
      operator: "==" | "!=" | "<" | "<=" | ">" | ">=";
      right: NumericExpression;
    }
  | { kind: "buttonDown"; player: 1 | 2 | 3 | 4; button: Risc96Button }
  | { kind: "buttonPressed"; player: 1 | 2 | 3 | 4; button: Risc96Button }
  | { kind: "buttonReleased"; player: 1 | 2 | 3 | 4; button: Risc96Button }
  | { kind: "spriteTouching"; left: string; right: string }
  | { kind: "spriteTouchingTilemap"; sprite: string; tilemapId: string; x: NumericExpression; y: NumericExpression }
  | { kind: "and"; left: BooleanExpression; right: BooleanExpression }
  | { kind: "or"; left: BooleanExpression; right: BooleanExpression }
  | { kind: "not"; value: BooleanExpression }
  | { kind: "stringContains"; haystack: StringExpression; needle: StringExpression };

export type NumericExpression =
  | { kind: "integer"; value: number }
  | { kind: "fixed"; value: number }
  | { kind: "variable"; name: string }
  | { kind: "random"; from: NumericExpression; to: NumericExpression }
  | {
      kind: "mathUnary";
      operator: "round" | "abs" | "floor" | "ceiling" | "sqrt" | "cos" | "sin" | "tan" | "log";
      value: NumericExpression;
    }
  | { kind: "timer"; timer: string }
  | { kind: "frameCount" }
  | { kind: "screenWidth" }
  | { kind: "screenHeight" }
  | { kind: "arrayItem"; array: string; index: NumericExpression }
  | { kind: "arrayLength"; array: string }
  | { kind: "stringLength"; value: StringExpression }
  | { kind: "letterOf"; index: NumericExpression; value: StringExpression }
  | { kind: "spriteX"; sprite: string }
  | { kind: "spriteY"; sprite: string }
  | { kind: "spriteWidth"; sprite: string }
  | { kind: "spriteHeight"; sprite: string }
  | { kind: "dpadAxis"; player: 1 | 2 | 3 | 4; axis: "x" | "y" }
  | { kind: "minMax"; operator: "min" | "max"; left: NumericExpression; right: NumericExpression }
  | { kind: "clamp"; value: NumericExpression; min: NumericExpression; max: NumericExpression }
  | {
      kind: "binary";
      left: NumericExpression;
      operator: "+" | "-" | "*" | "/" | "%" | "<<" | ">>" | "&" | "|" | "^";
      right: NumericExpression;
    };

export type StringExpression =
  | { kind: "literal"; value: string }
  | { kind: "variable"; name: string }
  | { kind: "join"; left: StringExpression; right: StringExpression }
  | { kind: "numberToString"; value: NumericExpression }
  | { kind: "numberToHexString"; value: NumericExpression };

export type StringValue = string | StringExpression;

export type Risc96Button =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT"
  | "A"
  | "B"
  | "X"
  | "Y"
  | "L"
  | "R"
  | "SELECT"
  | "START";
