import type {
  DrawCommand,
  FontAsset,
  FontGlyph,
  Risc96Project,
  SoundAsset,
  SpriteAsset,
  SpriteCollider,
  SpriteFrame,
  StartCommand,
  StringValue,
  TilemapAsset,
  UpdateCommand,
} from "../project/model.ts";

type SpriteEmitEntry = {
  id: string;
  source: SpriteAsset;
  frames: (number | undefined)[];
  colliders: SpriteCollider[];
};

type TilemapEmitEntry = {
  tilemap: TilemapAsset;
  tilesetSpriteIndex: number;
  tiles: number[];
  collisionTiles: boolean[];
};

type AssetEmitPlan = {
  sprites: SpriteEmitEntry[];
  projectSpriteIndexes: Map<string, number>;
  tilemaps: TilemapEmitEntry[];
};

type FontGlyphEmitData = {
  entries: { glyph: FontGlyph; rowOffset: number }[];
  fontOffsets: Map<string, number>;
  rowBytes: number[];
};

export function emitAssetsHeader(project: Risc96Project): string {
  const lines: string[] = [];
  const plan = createAssetEmitPlan(project);
  const usesText = projectUsesText(project);
  const fontGlyphCodes = collectFontGlyphCodes(project);
  const fonts = project.fonts.map((font) => filterFontGlyphs(font, fontGlyphCodes.get(font.id)));
  const fontGlyphData = createFontGlyphEmitData(fonts);

  lines.push("#ifndef SCRATCH96_GENERATED_ASSETS_H");
  lines.push("#define SCRATCH96_GENERATED_ASSETS_H");
  lines.push("");
  lines.push('#include "risc96_blockly_runtime.h"');
  lines.push("");
  lines.push(`#define R96_FONT_COUNT ${fonts.length}`);
  lines.push(`#define R96_DRAW_TEXT_ENABLED ${usesText ? 1 : 0}`);
  lines.push(`#define R96_TILEMAP_COUNT ${project.tilemaps.length}`);
  lines.push(`#define R96_TEXT_HANDLE_COUNT ${collectTextHandles(project).length}`);
  lines.push(`#define R96_INPUT_ENABLED ${projectUsesInput(project) ? 1 : 0}`);
  lines.push(`#define R96_EVENTS_ENABLED ${projectUsesEvents(project) ? 1 : 0}`);
  lines.push(`#define R96_AUDIO_ENABLED ${projectUsesAudio(project) ? 1 : 0}`);
  lines.push(`#define R96_SPRITES_ENABLED ${projectUsesSprites(project) ? 1 : 0}`);
  lines.push("#define R96_CUSTOM_SPRITE_RENDERER 0");
  lines.push(
    `#define R96_ADVANCED_SPRITE_RENDERER ${usesAdvancedSpriteRendering(project) ? 1 : 0}`,
  );
  lines.push("");

  for (const [spriteId, index] of plan.projectSpriteIndexes) {
    lines.push(`#define ${spriteConstant(spriteId)} ${index}`);
  }

  project.sounds.forEach((sound, index) => {
    lines.push(`#define ${soundConstant(sound.id)} ${index}`);
  });

  project.fonts.forEach((font, index) => {
    lines.push(`#define ${fontConstant(font.id)} ${index}`);
  });

  project.tilemaps.forEach((tilemap, index) => {
    lines.push(`#define ${tilemapConstant(tilemap.id)} ${index}`);
  });

  if (
    project.sprites.length > 0 ||
    project.sounds.length > 0 ||
    fonts.length > 0 ||
    project.tilemaps.length > 0
  ) {
    lines.push("");
  }

  for (const sprite of plan.sprites) {
    lines.push(...emitSpritePixels(sprite));
    lines.push(...emitSpriteColliders(sprite));
    lines.push("");
  }

  lines.push("static const r96_sprite_def_t r96_sprite_defs[] = {");

  for (const sprite of plan.sprites) {
    lines.push(
      `  {.width = ${sprite.source.width}, .height = ${sprite.source.height}, .frame_count = ${sprite.frames.length}, .frames = ${spriteFramesName(sprite)}, .collider_count = ${sprite.colliders.length}, .colliders = ${spriteCollidersName(sprite)}},`,
    );
  }

  lines.push("};");
  lines.push("");

  lines.push(...emitFontGlyphArrays(fontGlyphData));
  lines.push("");

  lines.push("static const r96_font_def_t r96_font_defs[] = {");

  if (fonts.length === 0) {
    lines.push("  {.line_height = 0, .glyph_count = 0, .glyph_offset = 0},");
  } else {
    for (const font of fonts) {
      if (font.glyphs.length === 0) {
        lines.push(
          `  {.line_height = ${font.lineHeight}, .glyph_count = 0, .glyph_offset = ${fontGlyphData.fontOffsets.get(font.id) ?? 0}},`,
        );
        continue;
      }
      lines.push(
        `  {.line_height = ${font.lineHeight}, .glyph_count = ${font.glyphs.length}, .glyph_offset = ${fontGlyphData.fontOffsets.get(font.id) ?? 0}},`,
      );
    }
  }

  lines.push("};");
  lines.push("");

  for (const tilemap of plan.tilemaps) {
    lines.push(...emitTilemap(tilemap));
    lines.push("");
  }

  lines.push("static const r96_tilemap_def_t r96_tilemap_defs[] = {");

  if (project.tilemaps.length === 0) {
    lines.push(
      "  {.tileset_sprite_id = 0, .width = 0, .height = 0, .tile_width = 0, .tile_height = 0, .tiles = 0, .collision_tiles = 0},",
    );
  } else {
    for (const tilemap of plan.tilemaps) {
      lines.push(
        `  {.tileset_sprite_id = ${tilemap.tilesetSpriteIndex}, .width = ${tilemap.tilemap.width}, .height = ${tilemap.tilemap.height}, .tile_width = ${tilemap.tilemap.tileWidth}, .tile_height = ${tilemap.tilemap.tileHeight}, .tiles = ${tilemapTilesName(tilemap.tilemap)}, .collision_tiles = ${tilemapCollisionTilesReference(tilemap)}},`,
      );
    }
  }

  lines.push("};");
  lines.push("");

  for (const sound of project.sounds) {
    lines.push(...emitSoundNotes(sound));
    lines.push("");
  }

  lines.push("static const r96_sound_def_t r96_sound_defs[] = {");

  for (const sound of project.sounds) {
    if (sound.format === "tone_sequence") {
      lines.push(`  {.note_count = ${sound.notes.length}, .notes = ${soundNotesName(sound)}},`);
    } else {
      lines.push("  {.note_count = 0, .notes = 0},");
    }
  }

  lines.push("};");
  lines.push("");
  lines.push("#endif");

  return lines.join("\n");
}

function filterFontGlyphs(font: FontAsset, codes: Set<number> | undefined): FontAsset {
  if (!codes) return { ...font, glyphs: [] };
  return { ...font, glyphs: font.glyphs.filter((glyph) => codes.has(glyph.code)) };
}

function createFontGlyphEmitData(fonts: FontAsset[]): FontGlyphEmitData {
  const entries: FontGlyphEmitData["entries"] = [];
  const fontOffsets = new Map<string, number>();
  const rowBytes: number[] = [];

  for (const font of fonts) {
    fontOffsets.set(font.id, entries.length);
    for (const glyph of font.glyphs) {
      const glyphBytes = glyphRowBytes(glyph);
      entries.push({ glyph, rowOffset: rowBytes.length });
      rowBytes.push(...glyphBytes);
    }
  }

  return { entries, fontOffsets, rowBytes };
}

function emitFontGlyphArrays(data: FontGlyphEmitData): string[] {
  const entries = data.entries;
  return [
    ...emitIntArray("r96_font_glyph_codes", entries.map((entry) => entry.glyph.code)),
    ...emitIntArray("r96_font_glyph_widths", entries.map((entry) => entry.glyph.width)),
    ...emitIntArray("r96_font_glyph_heights", entries.map((entry) => entry.glyph.height)),
    ...emitIntArray("r96_font_glyph_x_offsets", entries.map((entry) => entry.glyph.xOffset)),
    ...emitIntArray("r96_font_glyph_y_offsets", entries.map((entry) => entry.glyph.yOffset)),
    ...emitIntArray("r96_font_glyph_x_advances", entries.map((entry) => entry.glyph.xAdvance)),
    ...emitIntArray("r96_font_glyph_row_offsets", entries.map((entry) => entry.rowOffset)),
    ...emitByteArray("r96_font_row_bytes", data.rowBytes),
  ];
}

function emitIntArray(name: string, values: number[]): string[] {
  return [`static const int ${name}[] = {`, `  ${(values.length > 0 ? values : [0]).join(", ")},`, "};"];
}

function emitByteArray(name: string, values: number[]): string[] {
  return [`static const r96_u8_t ${name}[] = {`, `  ${(values.length > 0 ? values : [0]).join(", ")},`, "};"];
}

function glyphRowBytes(glyph: FontGlyph): number[] {
  const bytesPerRow = Math.max(1, Math.ceil(glyph.width / 8));
  const bytes = Array.from({ length: Math.max(0, glyph.height) * bytesPerRow }, () => 0);

  for (let y = 0; y < glyph.height; y += 1) {
    for (let x = 0; x < glyph.width; x += 1) {
      if (glyph.bitmap[y * glyph.width + x] === 0) continue;
      bytes[y * bytesPerRow + Math.floor(x / 8)] |= 1 << (x % 8);
    }
  }

  return bytes;
}

function collectFontGlyphCodes(project: Risc96Project): Map<string, Set<number>> {
  const codes = new Map<string, Set<number>>();

  for (const script of project.scripts) {
    for (const command of script.blocks.update) collectUpdateTextGlyphCodes(command, codes);
    for (const command of script.blocks.draw ?? []) collectDrawTextGlyphCodes(command, codes);
    for (const eventScript of script.blocks.events ?? [])
      for (const command of eventScript.commands) collectUpdateTextGlyphCodes(command, codes);
    for (const buttonEventScript of script.blocks.buttonEvents ?? [])
      for (const command of buttonEventScript.commands) collectUpdateTextGlyphCodes(command, codes);
    for (const timerScript of script.blocks.timerEvents ?? [])
      for (const command of timerScript.commands) collectUpdateTextGlyphCodes(command, codes);
    for (const procedure of script.blocks.procedures ?? [])
      for (const command of procedure.commands) collectUpdateTextGlyphCodes(command, codes);
  }

  return codes;
}

function collectUpdateTextGlyphCodes(command: UpdateCommand, codes: Map<string, Set<number>>): void {
  if (command.kind === "drawText" || command.kind === "writeText") {
    addTextValueGlyphCodes(codes, command.fontId, command.text);
  }
  if (command.kind === "if") {
    command.thenCommands.forEach((child) => collectUpdateTextGlyphCodes(child, codes));
    command.elseCommands.forEach((child) => collectUpdateTextGlyphCodes(child, codes));
  }
  if (
    command.kind === "while" ||
    command.kind === "doWhile" ||
    command.kind === "for" ||
    command.kind === "everyFrames" ||
    command.kind === "onEvent"
  ) {
    command.commands.forEach((child) => collectUpdateTextGlyphCodes(child, codes));
  }
}

function collectDrawTextGlyphCodes(command: DrawCommand, codes: Map<string, Set<number>>): void {
  if (command.kind === "drawText") addTextValueGlyphCodes(codes, command.fontId, command.text);
}

function projectUsesText(project: Risc96Project): boolean {
  for (const script of project.scripts) {
    for (const command of script.blocks.update) if (updateCommandUsesText(command)) return true;
    for (const command of script.blocks.draw ?? []) if (command.kind === "drawText") return true;
    for (const eventScript of script.blocks.events ?? [])
      for (const command of eventScript.commands) if (updateCommandUsesText(command)) return true;
    for (const buttonEventScript of script.blocks.buttonEvents ?? [])
      for (const command of buttonEventScript.commands) if (updateCommandUsesText(command)) return true;
    for (const timerScript of script.blocks.timerEvents ?? [])
      for (const command of timerScript.commands) if (updateCommandUsesText(command)) return true;
    for (const procedure of script.blocks.procedures ?? [])
      for (const command of procedure.commands) if (updateCommandUsesText(command)) return true;
  }
  return false;
}

function projectUsesInput(project: Risc96Project): boolean {
  const source = JSON.stringify(project.scripts);
  return /"kind":"(buttonDown|buttonPressed|buttonReleased|buttonEvent|moveSpriteWithButtons)"/.test(source) ||
    source.includes('"buttonEvents":');
}

function projectUsesEvents(project: Risc96Project): boolean {
  const source = JSON.stringify(project.scripts);
  return /"kind":"(onEvent|publishEvent|eventPublish|event)"/.test(source) ||
    source.includes('"events":') || source.includes('"timerEvents":');
}

function projectUsesAudio(project: Risc96Project): boolean {
  return /"kind":"(playSound|stopAllSounds|playNote)"/.test(JSON.stringify(project.scripts));
}

function projectUsesSprites(project: Risc96Project): boolean {
  return /"kind":"(createSprite|drawSprite|drawSpriteFrame|setSprite|moveSprite|sprite)"/.test(
    JSON.stringify(project.scripts),
  );
}

function updateCommandUsesText(command: UpdateCommand): boolean {
  if (command.kind === "drawText" || command.kind === "writeText" || command.kind === "initTextVariable") return true;
  if (command.kind === "if") {
    return command.thenCommands.some(updateCommandUsesText) || command.elseCommands.some(updateCommandUsesText);
  }
  if (
    command.kind === "while" ||
    command.kind === "doWhile" ||
    command.kind === "for" ||
    command.kind === "everyFrames" ||
    command.kind === "onEvent"
  ) {
    return command.commands.some(updateCommandUsesText);
  }
  return false;
}

function addTextValueGlyphCodes(codes: Map<string, Set<number>>, fontId: string, text: StringValue): void {
  if (typeof text === "string") {
    addTextGlyphCodes(codes, fontId, text);
    return;
  }

  if (text.kind === "literal") {
    addTextGlyphCodes(codes, fontId, text.value);
    return;
  }

  addPrintableAsciiGlyphCodes(codes, fontId);
}

function addPrintableAsciiGlyphCodes(codes: Map<string, Set<number>>, fontId: string): void {
  let fontCodes = codes.get(fontId);
  if (!fontCodes) {
    fontCodes = new Set<number>();
    codes.set(fontId, fontCodes);
  }
  for (let code = 32; code <= 126; code += 1) fontCodes.add(code);
}

function addTextGlyphCodes(codes: Map<string, Set<number>>, fontId: string, text: string): void {
  let fontCodes = codes.get(fontId);
  if (!fontCodes) {
    fontCodes = new Set<number>();
    codes.set(fontId, fontCodes);
  }

  for (const character of text) {
    const code = character.codePointAt(0);
    if (code !== undefined) fontCodes.add(code);
  }
}

function emitTilemap(tilemap: TilemapEmitEntry): string[] {
  return [
    `static const unsigned short ${tilemapTilesName(tilemap.tilemap)}[] = {`,
    ...chunk(tilemap.tiles, tilemap.tilemap.width).map((row) => `  ${row.join(", ")},`),
    "};",
    ...(tilemap.collisionTiles.some(Boolean)
      ? [
          `static const unsigned short ${tilemapCollisionTilesName(tilemap.tilemap)}[] = {`,
          ...chunk(tilemap.collisionTiles.map((solid) => (solid ? 1 : 0)), tilemap.tilemap.width).map((row) => `  ${row.join(", ")},`),
          "};",
        ]
      : []),
  ];
}

function emitSpriteColliders(sprite: SpriteEmitEntry): string[] {
  const lines: string[] = [];

  lines.push(`static const r96_rect_collider_t ${spriteCollidersName(sprite)}[] = {`);
  const colliders = sprite.colliders.length > 0 ? sprite.colliders : [{ x: 0, y: 0, width: 0, height: 0 }];
  for (const collider of colliders) {
    lines.push(`  ${formatCollider(collider)},`);
  }
  lines.push("};");

  return lines;
}

function collectTextHandles(project: Risc96Project): string[] {
  const handles = new Set<string>();

  for (const command of project.scripts.flatMap((script) => script.blocks.update))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.events ?? [])
    .flatMap((eventScript) => eventScript.commands))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.buttonEvents ?? [])
    .flatMap((buttonEventScript) => buttonEventScript.commands))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.timerEvents ?? [])
    .flatMap((timerScript) => timerScript.commands))
    collectTextHandle(command, handles);
  for (const command of project.scripts
    .flatMap((script) => script.blocks.procedures ?? [])
    .flatMap((procedure) => procedure.commands))
    collectTextHandle(command, handles);

  return [...handles];
}

function collectTextHandle(command: UpdateCommand, handles: Set<string>): void {
  if (
    command.kind === "writeText" ||
    command.kind === "eraseText" ||
    command.kind === "moveText" ||
    command.kind === "setTextPosition"
  )
    handles.add(command.handle);

  if (command.kind === "if") {
    command.thenCommands.forEach((child) => collectTextHandle(child, handles));
    command.elseCommands.forEach((child) => collectTextHandle(child, handles));
  }

  if (
    command.kind === "while" ||
    command.kind === "doWhile" ||
    command.kind === "for" ||
    command.kind === "onEvent" ||
    command.kind === "repeat" ||
    command.kind === "repeatUntil"
  ) {
    command.commands.forEach((child) => collectTextHandle(child, handles));
  }
}

function usesAdvancedSpriteRendering(project: Risc96Project): boolean {
  for (const script of project.scripts) {
    for (const command of script.blocks.update)
      if (commandUsesAdvancedSpriteRendering(command)) return true;
    for (const eventScript of script.blocks.events ?? [])
      for (const command of eventScript.commands)
        if (commandUsesAdvancedSpriteRendering(command)) return true;
    for (const buttonEventScript of script.blocks.buttonEvents ?? [])
      for (const command of buttonEventScript.commands)
        if (commandUsesAdvancedSpriteRendering(command)) return true;
    for (const timerScript of script.blocks.timerEvents ?? [])
      for (const command of timerScript.commands)
        if (commandUsesAdvancedSpriteRendering(command)) return true;
    for (const procedure of script.blocks.procedures ?? [])
      for (const command of procedure.commands)
        if (commandUsesAdvancedSpriteRendering(command)) return true;
  }
  return false;
}

function commandUsesAdvancedSpriteRendering(command: UpdateCommand): boolean {
  if (
    command.kind === "setSpriteScale" ||
    command.kind === "changeSpriteScale" ||
    command.kind === "setSpriteEffect" ||
    command.kind === "clearSpriteEffects"
  )
    return true;
  if (command.kind === "if")
    return (
      command.thenCommands.some(commandUsesAdvancedSpriteRendering) ||
      command.elseCommands.some(commandUsesAdvancedSpriteRendering)
    );
  if (
    command.kind === "while" ||
    command.kind === "doWhile" ||
    command.kind === "for" ||
    command.kind === "onEvent" ||
    command.kind === "repeat" ||
    command.kind === "repeatUntil"
  )
    return command.commands.some(commandUsesAdvancedSpriteRendering);
  return false;
}

function createAssetEmitPlan(project: Risc96Project): AssetEmitPlan {
  const normalSpriteIds = collectNormalSpriteIds(project);
  const sprites: SpriteEmitEntry[] = [];
  const projectSpriteIndexes = new Map<string, number>();

  for (const sprite of project.sprites) {
    if (!normalSpriteIds.has(sprite.id)) continue;
    projectSpriteIndexes.set(sprite.id, sprites.length);
    sprites.push({ id: sprite.id, source: sprite, frames: sprite.frames.map((_, index) => index), colliders: sprite.colliders });
  }

  const tilemaps = project.tilemaps.map((tilemap) => {
    const tileset = project.sprites.find((sprite) => sprite.id === tilemap.tilesetSpriteId) ?? project.sprites[0];
    const normalTilesetIndex = tileset ? projectSpriteIndexes.get(tileset.id) : undefined;

    if (normalTilesetIndex !== undefined && !tilemap.tiles.some(isEmptyTile)) {
      return {
        tilemap,
        tilesetSpriteIndex: normalTilesetIndex,
        tiles: tilemap.tiles.map((tile) => normalizeTileFrameIndex(tile, tileset)),
        collisionTiles: normalizeCollisionTiles(tilemap),
      };
    }

    const frameIndexes = collectTilemapFrameIndexes(tilemap, tileset);
    const frames = tilemap.tiles.some(isEmptyTile) ? [undefined, ...frameIndexes] : frameIndexes;
    const frameOffset = frames[0] === undefined ? 1 : 0;
    const remap = new Map(frameIndexes.map((frame, index) => [frame, index + frameOffset]));
    const entry: SpriteEmitEntry = {
      id: `tilemap_${tilemap.id}_tileset`,
      source: tileset ?? createMissingTileset(),
      frames,
      colliders: [],
    };

    const tilesetSpriteIndex = sprites.length;
    sprites.push(entry);

    return {
      tilemap,
      tilesetSpriteIndex,
      tiles: tilemap.tiles.map((tile) => (isEmptyTile(tile) ? 0 : remap.get(normalizeTileFrameIndex(tile, tileset)) ?? 0)),
      collisionTiles: normalizeCollisionTiles(tilemap),
    };
  });

  return { sprites, projectSpriteIndexes, tilemaps };
}

function collectNormalSpriteIds(project: Risc96Project): Set<string> {
  const ids = new Set<string>();

  for (const script of project.scripts) {
    script.blocks.start.forEach((command) => collectStartSpriteIds(command, ids));
    script.blocks.update.forEach((command) => collectUpdateSpriteIds(command, ids));
    script.blocks.draw?.forEach((command) => collectDrawSpriteIds(command, ids));
    script.blocks.events?.flatMap((event) => event.commands).forEach((command) => collectUpdateSpriteIds(command, ids));
    script.blocks.buttonEvents?.flatMap((event) => event.commands).forEach((command) => collectUpdateSpriteIds(command, ids));
    script.blocks.timerEvents?.flatMap((timer) => timer.commands).forEach((command) => collectUpdateSpriteIds(command, ids));
    script.blocks.procedures?.flatMap((procedure) => procedure.commands).forEach((command) => collectUpdateSpriteIds(command, ids));
  }

  return ids;
}

function collectStartSpriteIds(command: StartCommand, ids: Set<string>): void {
  if (command.kind === "createSprite") ids.add(command.spriteId);
  if (command.kind === "onEvent") command.commands.forEach((child) => collectUpdateSpriteIds(child, ids));
}

function collectUpdateSpriteIds(command: UpdateCommand, ids: Set<string>): void {
  if (command.kind === "createSprite") ids.add(command.spriteId);
  if (command.kind === "if") {
    command.thenCommands.forEach((child) => collectUpdateSpriteIds(child, ids));
    command.elseCommands.forEach((child) => collectUpdateSpriteIds(child, ids));
  }
  if (
    command.kind === "while" ||
    command.kind === "doWhile" ||
    command.kind === "for" ||
    command.kind === "onEvent" ||
    command.kind === "repeat" ||
    command.kind === "repeatUntil" ||
    command.kind === "everyFrames"
  ) {
    command.commands.forEach((child) => collectUpdateSpriteIds(child, ids));
  }
}

function collectDrawSpriteIds(command: DrawCommand, ids: Set<string>): void {
  if (command.kind === "drawSpriteFrame") ids.add(command.spriteId);
}

function collectTilemapFrameIndexes(tilemap: TilemapAsset, tileset: SpriteAsset | undefined): number[] {
  const used = new Set(
    tilemap.tiles.filter((tile) => !isEmptyTile(tile)).map((tile) => normalizeTileFrameIndex(tile, tileset)),
  );
  return [...used].sort((left, right) => left - right);
}

function isEmptyTile(tile: number): boolean {
  return !Number.isFinite(tile) || tile < 0;
}

function normalizeTileFrameIndex(tile: number, tileset: SpriteAsset | undefined): number {
  const frameCount = Math.max(1, tileset?.frames.length ?? 1);
  return Math.max(0, Math.min(frameCount - 1, Math.floor(tile)));
}

function normalizeCollisionTiles(tilemap: TilemapAsset): boolean[] {
  const size = Math.max(1, tilemap.width) * Math.max(1, tilemap.height);
  return [...(tilemap.collisionTiles ?? []), ...Array.from({ length: size }, () => false)].slice(0, size);
}

function createMissingTileset(): SpriteAsset {
  return {
    id: "missing_tileset",
    name: "Missing tileset",
    width: 1,
    height: 1,
    palette: [{ index: 0, color: 0x00000000 }],
    transparentIndex: 0,
    frames: [{ id: "empty", colorIndexes: [0] }],
    colliders: [],
  };
}

function formatCollider(collider: Pick<SpriteCollider, "x" | "y" | "width" | "height">): string {
  return `{.x = ${collider.x}, .y = ${collider.y}, .width = ${collider.width}, .height = ${collider.height}}`;
}

function emitSoundNotes(sound: SoundAsset): string[] {
  if (sound.format !== "tone_sequence") {
    return [];
  }

  const lines: string[] = [];

  lines.push(`static const r96_tone_note_t ${soundNotesName(sound)}[] = {`);

  for (const note of sound.notes) {
    lines.push(`  {.freq = ${note.freq}, .ms = ${note.ms}},`);
  }

  lines.push("};");

  return lines;
}

function emitSpritePixels(sprite: SpriteEmitEntry): string[] {
  const lines: string[] = [];

  sprite.frames.forEach((frameIndex, index) => {
    const frame = frameIndex === undefined ? undefined : sprite.source.frames[frameIndex];
    const pixels = frame
      ? expandFrame(sprite.source, frame)
      : Array.from({ length: sprite.source.width * sprite.source.height }, () => 0x00000000);

    lines.push(
      `static const unsigned int ${spritePixelsName(sprite, index)}[${sprite.source.width} * ${sprite.source.height}] = {`,
    );

    for (const row of chunk(pixels, sprite.source.width)) {
      lines.push(`  ${row.map(formatHex).join(", ")},`);
    }

    lines.push("};");
  });

  lines.push(`static const unsigned int *${spriteFramesName(sprite)}[] = {`);
  sprite.frames.forEach((_, index) => {
    lines.push(`  ${spritePixelsName(sprite, index)},`);
  });
  lines.push("};");

  return lines;
}

function expandFrame(sprite: SpriteAsset, frame: SpriteFrame): number[] {
  const palette = new Map(sprite.palette.map((entry) => [entry.index, entry.color]));

  return frame.colorIndexes.map((index) => {
    if (index === sprite.transparentIndex) {
      return 0x00000000;
    }

    return palette.get(index) ?? 0x00000000;
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

function spriteConstant(spriteId: string): string {
  return `SPRITE_${safeIdentifier(spriteId).toUpperCase()}`;
}

function soundConstant(soundId: string): string {
  return `SOUND_${safeIdentifier(soundId).toUpperCase()}`;
}

function fontConstant(fontId: string): string {
  return `FONT_${safeIdentifier(fontId).toUpperCase()}`;
}

function tilemapConstant(tilemapId: string): string {
  return `TILEMAP_${safeIdentifier(tilemapId).toUpperCase()}`;
}

function spritePixelsName(sprite: SpriteEmitEntry, frame: number): string {
  return `sprite_${safeIdentifier(sprite.id)}_frame_${frame}_pixels`;
}

function spriteFramesName(sprite: SpriteEmitEntry): string {
  return `sprite_${safeIdentifier(sprite.id)}_frames`;
}

function spriteCollidersName(sprite: SpriteEmitEntry): string {
  return `sprite_${safeIdentifier(sprite.id)}_colliders`;
}

function soundNotesName(sound: SoundAsset): string {
  return `sound_${safeIdentifier(sound.id)}_notes`;
}

function tilemapTilesName(tilemap: TilemapAsset): string {
  return `tilemap_${safeIdentifier(tilemap.id)}_tiles`;
}

function tilemapCollisionTilesName(tilemap: TilemapAsset): string {
  return `tilemap_${safeIdentifier(tilemap.id)}_collision_tiles`;
}

function tilemapCollisionTilesReference(tilemap: TilemapEmitEntry): string {
  return tilemap.collisionTiles.some(Boolean) ? tilemapCollisionTilesName(tilemap.tilemap) : "0";
}

function safeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[^a-zA-Z_]/, "_");
}

function formatHex(value: number): string {
  return `0x${value.toString(16).padStart(8, "0")}`;
}
