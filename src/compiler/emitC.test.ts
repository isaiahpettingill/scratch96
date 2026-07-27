import { describe, expect, it } from "vite-plus/test";

import { compileProjectToC } from "./emitC.ts";
import type {
  BooleanExpression,
  NumericExpression,
  Risc96Project,
  UpdateCommand,
} from "../project/model.ts";
import { sampleProject } from "../project/sampleProject.ts";

describe("compileProjectToC", () => {
  it("emits setup-derived resolution before user blocks", () => {
    const result = compileProjectToC(sampleProject);

    expect(result.diagnostics).toEqual([]);
    expect(result.files.map((file) => file.path)).toEqual([
      "risc96_blockly_runtime.h",
      "generated_assets.h",
      "risc96_blockly_runtime.c",
      "main.c",
    ]);
    expect(result.source).toContain("r96_set_resolution(320, 224);");
    expect(result.source).toContain("r96_user_screen_width = 320;");
  });

  it("emits v0 debug, background, sprite, and button movement code", () => {
    const result = compileProjectToC(sampleProject);

    expect(result.source).toContain('r96_debug_log_cstr("Hello from scratch96\\n");');
    expect(result.source).toContain("r96_stage_set_background(0x00102030);");
    expect(result.source).toContain("player = r96_sprite_create(SPRITE_PLAYER, 100, 80);");
    expect(result.source).toContain("if (r96_button_down(0, R96_BUTTON_RIGHT))");
    expect(result.source).toContain("r96_sprite_move(&player, 2, 0);");
  });

  it("emits shaped pixels for the bundled default font", () => {
    const result = compileProjectToC(sampleProject);

    expect(result.source).toContain(
      'r96_draw_text(FONT_MSX_INTERNATIONAL_8X8, "Hello World", 96, 108, 1, 0x00ffffff);',
    );
  });

  it("emits text variables as char arrays for draw text", () => {
    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.start.push({
      kind: "initTextVariable",
      variable: "message",
      length: 16,
      value: { kind: "numberToString", value: { kind: "variable", name: "setup_score" } },
    });
    project.scripts[0].blocks.update = [
      {
        kind: "initTextVariable",
        variable: "score_text",
        length: 12,
        value: { kind: "numberToString", value: { kind: "variable", name: "score" } },
      },
    ];
    project.scripts[0].blocks.draw = [
      {
        kind: "drawText",
        fontId: "msx_international_8x8",
        text: { kind: "variable", name: "message" },
        x: 4,
        y: 8,
        color: 0x00ffffff,
      },
      {
        kind: "drawText",
        fontId: "msx_international_8x8",
        text: { kind: "numberToHexString", value: { kind: "integer", value: 96 } },
        x: 4,
        y: 18,
        color: 0x00ffffff,
      },
    ];

    const result = compileProjectToC(project);

    expect(result.diagnostics).toEqual([]);
    expect(result.source).toContain("static int setup_score;");
    expect(result.source).toContain("static char message[17];");
    expect(result.source).toContain("static char score_text[13];");
    expect(result.source).toContain("r96_user_copy_text(message, sizeof(message), r96_user_int_to_text(setup_score));");
    expect(result.source).toContain("r96_user_copy_text(score_text, sizeof(score_text), r96_user_int_to_text(score));");
    expect(result.source).toContain("r96_draw_text(FONT_MSX_INTERNATIONAL_8X8, message, 4, 8, 1, 0x00ffffff);");
    expect(result.source).toContain("r96_draw_text(FONT_MSX_INTERNATIONAL_8X8, r96_user_int_to_hex_text(96), 4, 18, 1, 0x00ffffff);");
  });

  it("escapes C string content in debug logs", () => {
    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.start = [{ kind: "debugLog", text: 'quote " slash \\' }];

    const result = compileProjectToC(project);

    expect(result.source).toContain('r96_debug_log_cstr("quote \\" slash \\\\\\n");');
  });

  it("emits frame, event, and basic control-flow commands", () => {
    const project = structuredClone(sampleProject);
    project.tilemaps = [
      {
        id: "level_1",
        name: "Level 1",
        tilesetSpriteId: "player",
        width: 1,
        height: 1,
        tileWidth: 4,
        tileHeight: 4,
        tiles: [0],
      },
    ];
    project.scripts[0].blocks.update = [
      { kind: "setSpriteFrame", variable: "player", frame: 1 },
      { kind: "incrementVariable", variable: "score", amount: 1 },
      { kind: "decrementVariable", variable: "score", amount: 2 },
      {
        kind: "setVariable",
        variable: "speed",
        value: {
          kind: "binary",
          left: { kind: "variable", name: "score" },
          operator: "*",
          right: { kind: "integer", value: 2 },
        },
      },
      { kind: "setVariableToSpriteX", variable: "player_x", sprite: "player" },
      { kind: "setVariableToSpriteY", variable: "player_y", sprite: "player" },
      {
        kind: "setSpriteX",
        sprite: "player",
        value: {
          kind: "binary",
          left: { kind: "variable", name: "player_x" },
          operator: "+",
          right: { kind: "integer", value: 4 },
        },
      },
      { kind: "setSpriteY", sprite: "player", value: { kind: "spriteY", sprite: "enemy" } },
      { kind: "drawText", fontId: "tiny", text: "Hi", x: 4, y: 5, color: 0x00ffffff },
      { kind: "drawTilemap", tilemapId: "level_1", x: 0, y: 0 },
      { kind: "publishEvent", event: "hit" },
      { kind: "onEvent", event: "hit", commands: [{ kind: "debugLog", text: "hit" }] },
      {
        kind: "if",
        condition: { kind: "spriteTouching", left: "player", right: "enemy" },
        thenCommands: [{ kind: "debugLog", text: "then" }],
        elseCommands: [{ kind: "debugLog", text: "else" }],
      },
      { kind: "while", condition: { kind: "literal", value: false }, commands: [] },
      { kind: "doWhile", condition: { kind: "literal", value: false }, commands: [] },
      { kind: "for", variable: "i", from: 0, to: 3, step: 1, commands: [] },
    ];

    const result = compileProjectToC(project);

    expect(result.source).toContain("static int score;");
    expect(result.source).toContain("static int speed;");
    expect(result.source).toContain("static int player_x;");
    expect(result.source).toContain("static int player_y;");
    expect(result.source).toContain("static int i;");
    expect(result.source).toContain("r96_sprite_set_frame(&player, 1);");
    expect(result.source).toContain("score += 1;");
    expect(result.source).toContain("score -= 2;");
    expect(result.source).toContain("speed = (score * 2);");
    expect(result.source).toContain("player_x = r96_sprite_x(&player);");
    expect(result.source).toContain("player_y = r96_sprite_y(&player);");
    expect(result.source).toContain(
      "r96_sprite_set_position(&player, (player_x + 4), r96_sprite_y(&player));",
    );
    expect(result.source).toContain(
      "r96_sprite_set_position(&player, r96_sprite_x(&player), r96_sprite_y(&enemy));",
    );
    expect(result.source).toContain('r96_draw_text(FONT_TINY, "Hi", 4, 5, 1, 0x00ffffff);');
    expect(result.source).toContain("r96_draw_sprite_frame(SPRITE_PLAYER, 0, 0, 0);");
    expect(result.source).toContain('r96_event_publish("hit");');
    expect(result.source).toContain('if (r96_event_poll("hit"))');
    expect(result.source).toContain("if (r96_sprite_touching(&player, &enemy))");
    expect(result.source).toContain("while (0)");
    expect(result.source).toContain("do {");
    expect(result.source).toContain("for (i = 0; i <= 3; i += 1)");
  });

  it("emits draw loop shape commands after update loop", () => {
    const project = structuredClone(sampleProject);
    project.scripts[0].blocks.draw = [
      {
        kind: "drawRect",
        x: { kind: "variable", name: "box_x" },
        y: { kind: "integer", value: 12 },
        width: { kind: "integer", value: 20 },
        height: { kind: "integer", value: 8 },
        color: 0x00ff00aa,
        filled: true,
      },
      {
        kind: "drawLine",
        x1: { kind: "integer", value: 0 },
        y1: { kind: "integer", value: 0 },
        x2: {
          kind: "binary",
          left: { kind: "variable", name: "box_x" },
          operator: ">>",
          right: { kind: "integer", value: 1 },
        },
        y2: { kind: "integer", value: 40 },
        color: 0x0000ff00,
      },
      {
        kind: "drawCircle",
        x: { kind: "integer", value: 80 },
        y: { kind: "integer", value: 60 },
        radius: { kind: "integer", value: 16 },
        color: 0x00ffffff,
        filled: false,
      },
    ];

    const result = compileProjectToC(project);

    expect(result.source).toContain("static int box_x;");
    expect(result.source).toContain("void r96_user_draw(void) {");
    expect(result.source).toContain(
      "volatile r96_u32_t *r96_fb = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);",
    );
    expect(result.source).toContain("for (int r96_x = box_x; r96_x < box_x + 20; r96_x++)");
    expect(result.source).toContain("int r96_x2 = (box_x >> 1);");
    expect(result.source).toContain(
      "r96_fb[r96_y * RISC96_FRAMEBUFFER_PITCH_PIXELS + r96_x] = 0x0000ff00;",
    );
    expect(result.source).toContain("int r96_radius = 16;");
    expect(result.source).toContain("int r96_dist2 = r96_px * r96_px + r96_py * r96_py;");
  });

  it("emits sprite tilemap collision conditions", () => {
    const project = structuredClone(sampleProject);
    project.tilemaps = [
      {
        id: "level_1",
        name: "Level 1",
        tilesetSpriteId: "player",
        width: 1,
        height: 1,
        tileWidth: 4,
        tileHeight: 4,
        tiles: [0],
        collisionTiles: [true],
      },
    ];
    project.scripts[0].blocks.update = [
      {
        kind: "if",
        condition: {
          kind: "spriteTouchingTilemap",
          sprite: "player",
          tilemapId: "level_1",
          x: { kind: "integer", value: 0 },
          y: { kind: "integer", value: 0 },
        },
        thenCommands: [{ kind: "debugLog", text: "solid" }],
        elseCommands: [],
      },
    ];

    const result = compileProjectToC(project);

    expect(result.source).toContain("r96_sprite_touching_rect(&player, (0) + 0, (0) + 0, 4, 4)");
    expect(result.assetsHeader).toContain("tilemap_level_1_collision_tiles");
  });

  it("emits every update command family and supported expression family", () => {
    const project = createCompilerCoverageProject();
    const result = compileProjectToC(project);

    expect(result.diagnostics).toEqual([]);
    expect(collectUpdateCommandKinds(project)).toEqual([
      "addArrayItem",
      "bringSpriteToFront",
      "broadcastAndWait",
      "callProcedure",
      "changeSoundTempo",
      "changeSpriteScale",
      "clearArray",
      "clearSpriteEffects",
      "createClone",
      "debugLog",
      "decrementVariable",
      "deleteArrayItem",
      "deleteClone",
      "doWhile",
      "drawText",
      "drawTilemap",
      "eraseText",
      "for",
      "goToSprite",
      "hideSprite",
      "if",
      "incrementVariable",
      "insertArrayItem",
      "moveSprite",
      "moveSpriteIfButtonDown",
      "moveText",
      "onEvent",
      "playSound",
      "playSoundAndWait",
      "pointSpriteDirection",
      "publishEvent",
      "repeat",
      "repeatUntil",
      "replaceArrayItem",
      "resetTimer",
      "sendSpriteToBack",
      "setArrayItem",
      "setSoundTempo",
      "setSpriteEffect",
      "setSpriteFrame",
      "setSpritePosition",
      "setSpriteScale",
      "setSpriteX",
      "setSpriteY",
      "setTextPosition",
      "setVariable",
      "setVariableToSpriteX",
      "setVariableToSpriteY",
      "showSprite",
      "stopAllSounds",
      "stopEverything",
      "switchFrame",
      "turnSprite",
      "wait",
      "waitUntil",
      "while",
      "writeText",
    ]);

    expect(result.source).toContain("static unsigned int r96_random_seed = 2463534242u;");
    expect(result.source).toContain("static int buffer[256];");
    expect(result.source).toContain("static int scratch[256];");
    expect(result.source).toContain("static r96_text_handle_t label;");
    expect(result.source).toContain(
      "r96_sprite_move(&player, r96_user_random(1, 3), r96_user_abs(-2));",
    );
    expect(result.source).toContain(
      'r96_sprite_set_position(&player, r96_user_letter_of("abc", 1), r96_user_strlen("hello"));',
    );
    expect(result.source).toContain(
      "r96_sprite_set_position(&player, r96_sprite_x(&enemy), r96_sprite_y(&enemy));",
    );
    expect(result.source).toContain("player.direction = r96_user_cos(30);");
    expect(result.source).toContain("player.direction += r96_user_tan(15);");
    expect(result.source).toContain("player.scale = r96_user_sqrt(400);");
    expect(result.source).toContain("player.scale += r96_user_log(8);");
    expect(result.source).toContain("player.effect_kind = 1;");
    expect(result.source).toContain("player.effect_value = r96_user_random(1, 2);");
    expect(result.source).toContain("r96_sprite_set_frame(&player, 0);");
    expect(result.source).toContain("r96_sprite_show(&player);");
    expect(result.source).toContain("r96_sprite_hide(&player);");
    expect(result.source).toContain("r96_play_sound(SOUND_COIN);");
    expect(result.source).toContain("r96_stop_all_sounds();");
    expect(result.source).toContain("r96_sound_tempo = 140;");
    expect(result.source).toContain("r96_sound_tempo += -10;");
    expect(result.source).toContain("for (int r96_wait = 0; r96_wait < 3; r96_wait++)");
    expect(result.source).toContain(
      'while (!(((r96_button_down(0, R96_BUTTON_A)) && ((!(r96_user_contains("abc", "b")))))))',
    );
    expect(result.source).toContain("while (r96_repeat < 2)");
    expect(result.source).toContain("while (!(score < 10))");
    expect(result.source).toContain("for (i = 0; i <= 2; i += 1)");
    expect(result.source).toContain("buffer[(0) & 255] = 7;");
    expect(result.source).toContain("if (buffer_length < 256) buffer[buffer_length++] = 8;");
    expect(result.source).toContain("scratch_length = 0;");
    expect(result.source).toContain("player_x = r96_sprite_x(&player);");
    expect(result.source).toContain("player_y = r96_sprite_y(&player);");
    expect(result.source).toContain(
      'label = r96_text_write(FONT_MSX_INTERNATIONAL_8X8, "Hi", 1, 2, 2, 0x00ffffff);',
    );
    expect(result.source).toContain("r96_text_move(&label, 1, 0);");
    expect(result.source).toContain("r96_text_set_position(&label, 12, 16);");
    expect(result.source).toContain("r96_text_erase(&label);");
    expect(result.source).toContain("r96_draw_sprite_frame(SPRITE_PLAYER, 0, 0, 0);");
    expect(result.source).toContain('r96_event_publish("hit");');
    expect(result.source).toContain('if (r96_event_poll("hit"))');
    expect(result.source).toContain("if (r96_button_down(1, R96_BUTTON_START))");
    expect(result.source).toContain('r96_debug_log_cstr("button event\\n");');
    expect(result.source).toContain("/* player layer front requested */");
    expect(result.source).toContain("/* player layer back requested */");
    expect(result.source).toContain(
      "clone = r96_sprite_create(player.id, r96_sprite_x(&player), r96_sprite_y(&player));",
    );
    expect(result.source).toContain("r96_sprite_hide(&clone);");
  });
});

function createCompilerCoverageProject(): Risc96Project {
  const project = structuredClone(sampleProject);
  project.tilemaps = [
    {
      id: "level_1",
      name: "Level 1",
      tilesetSpriteId: "player",
      width: 1,
      height: 1,
      tileWidth: 4,
      tileHeight: 4,
      tiles: [0],
    },
  ];
  project.scripts[0].blocks.start = [
    { kind: "createSprite", variable: "player", spriteId: "player", x: 100, y: 80 },
    { kind: "createSprite", variable: "enemy", spriteId: "player", x: 120, y: 80 },
  ];
  project.scripts[0].blocks.update = createUpdateCoverageCommands();
  project.scripts[0].blocks.events = [
    { event: "hit", commands: [{ kind: "debugLog", text: "event" }] },
  ];
  project.scripts[0].blocks.buttonEvents = [
    { player: 2, button: "START", commands: [{ kind: "debugLog", text: "button event" }] },
  ];
  project.scripts[0].blocks.timerEvents = [
    { timer: "main", ticks: 60, commands: [{ kind: "debugLog", text: "timer" }] },
  ];
  project.scripts[0].blocks.procedures = [
    { name: "flash", commands: [{ kind: "debugLog", text: "procedure" }] },
  ];
  return project;
}

function createUpdateCoverageCommands(): UpdateCommand[] {
  const buttonAndStringCondition: BooleanExpression = {
    kind: "and",
    left: { kind: "buttonDown", player: 1, button: "A" },
    right: {
      kind: "not",
      value: {
        kind: "stringContains",
        haystack: { kind: "literal", value: "abc" },
        needle: { kind: "literal", value: "b" },
      },
    },
  };
  const scoreLessThanTen: BooleanExpression = {
    kind: "compare",
    left: { kind: "variable", name: "score" },
    operator: "<",
    right: { kind: "integer", value: 10 },
  };

  return [
    { kind: "debugLog", text: "coverage" },
    {
      kind: "moveSpriteIfButtonDown",
      variable: "player",
      player: 1,
      button: "RIGHT",
      dx: 1,
      dy: 0,
    },
    { kind: "setSpriteFrame", variable: "player", frame: 0 },
    { kind: "switchFrame", sprite: "player", frame: 0 },
    { kind: "showSprite", sprite: "player" },
    { kind: "hideSprite", sprite: "player" },
    { kind: "playSound", soundId: "coin" },
    { kind: "playSoundAndWait", soundId: "coin", ticks: 2 },
    { kind: "stopAllSounds" },
    { kind: "setSoundTempo", bpm: 140 },
    { kind: "changeSoundTempo", amount: -10 },
    { kind: "wait", ticks: 3 },
    { kind: "waitUntil", condition: buttonAndStringCondition },
    {
      kind: "repeat",
      times: { kind: "integer", value: 2 },
      commands: [{ kind: "incrementVariable", variable: "inside_repeat", amount: 1 }],
    },
    {
      kind: "repeatUntil",
      condition: scoreLessThanTen,
      commands: [{ kind: "decrementVariable", variable: "score", amount: 1 }],
    },
    { kind: "stopEverything" },
    { kind: "resetTimer", timer: "main" },
    { kind: "incrementVariable", variable: "score", amount: 1 },
    { kind: "decrementVariable", variable: "score", amount: 2 },
    { kind: "setVariable", variable: "score", value: fullNumericExpression() },
    {
      kind: "setArrayItem",
      array: "buffer",
      index: { kind: "integer", value: 0 },
      value: { kind: "integer", value: 7 },
    },
    { kind: "addArrayItem", array: "buffer", value: { kind: "integer", value: 8 } },
    { kind: "deleteArrayItem", array: "buffer", index: { kind: "integer", value: 0 } },
    {
      kind: "insertArrayItem",
      array: "buffer",
      index: { kind: "integer", value: 0 },
      value: { kind: "integer", value: 9 },
    },
    {
      kind: "replaceArrayItem",
      array: "buffer",
      index: { kind: "integer", value: 0 },
      value: { kind: "integer", value: 10 },
    },
    { kind: "clearArray", array: "scratch" },
    { kind: "setVariableToSpriteX", variable: "player_x", sprite: "player" },
    { kind: "setVariableToSpriteY", variable: "player_y", sprite: "player" },
    {
      kind: "moveSprite",
      sprite: "player",
      dx: {
        kind: "random",
        from: { kind: "integer", value: 1 },
        to: { kind: "integer", value: 3 },
      },
      dy: { kind: "mathUnary", operator: "abs", value: { kind: "integer", value: -2 } },
    },
    {
      kind: "setSpriteX",
      sprite: "player",
      value: { kind: "arrayItem", array: "buffer", index: { kind: "integer", value: 0 } },
    },
    { kind: "setSpriteY", sprite: "player", value: { kind: "arrayLength", array: "buffer" } },
    {
      kind: "setSpritePosition",
      sprite: "player",
      x: {
        kind: "letterOf",
        value: { kind: "literal", value: "abc" },
        index: { kind: "integer", value: 1 },
      },
      y: { kind: "stringLength", value: { kind: "literal", value: "hello" } },
    },
    { kind: "goToSprite", sprite: "player", target: "enemy" },
    {
      kind: "pointSpriteDirection",
      sprite: "player",
      direction: { kind: "mathUnary", operator: "cos", value: { kind: "integer", value: 30 } },
    },
    {
      kind: "turnSprite",
      sprite: "player",
      degrees: { kind: "mathUnary", operator: "tan", value: { kind: "integer", value: 15 } },
    },
    {
      kind: "setSpriteScale",
      sprite: "player",
      scale: { kind: "mathUnary", operator: "sqrt", value: { kind: "integer", value: 400 } },
    },
    {
      kind: "changeSpriteScale",
      sprite: "player",
      amount: { kind: "mathUnary", operator: "log", value: { kind: "integer", value: 8 } },
    },
    {
      kind: "setSpriteEffect",
      sprite: "player",
      effect: "invert",
      value: {
        kind: "random",
        from: { kind: "integer", value: 1 },
        to: { kind: "integer", value: 2 },
      },
    },
    { kind: "clearSpriteEffects", sprite: "player" },
    { kind: "bringSpriteToFront", sprite: "player" },
    { kind: "sendSpriteToBack", sprite: "player" },
    { kind: "createClone", source: "player", variable: "clone" },
    { kind: "deleteClone", sprite: "clone" },
    {
      kind: "drawText",
      fontId: "msx_international_8x8",
      text: "Hi",
      x: 1,
      y: 2,
      color: 0x00ffffff,
    },
    {
      kind: "writeText",
      handle: "label",
      fontId: "msx_international_8x8",
      text: "Hi",
      x: 1,
      y: 2,
      scale: 2,
      color: 0x00ffffff,
    },
    {
      kind: "moveText",
      handle: "label",
      dx: { kind: "integer", value: 1 },
      dy: { kind: "integer", value: 0 },
    },
    {
      kind: "setTextPosition",
      handle: "label",
      x: { kind: "integer", value: 12 },
      y: { kind: "integer", value: 16 },
    },
    { kind: "eraseText", handle: "label" },
    { kind: "drawTilemap", tilemapId: "level_1", x: 0, y: 0 },
    {
      kind: "if",
      condition: { kind: "spriteTouching", left: "player", right: "enemy" },
      thenCommands: [{ kind: "debugLog", text: "then" }],
      elseCommands: [{ kind: "debugLog", text: "else" }],
    },
    {
      kind: "while",
      condition: { kind: "literal", value: false },
      commands: [{ kind: "debugLog", text: "while" }],
    },
    {
      kind: "doWhile",
      condition: { kind: "literal", value: false },
      commands: [{ kind: "debugLog", text: "do" }],
    },
    {
      kind: "for",
      variable: "i",
      from: 0,
      to: 2,
      step: 1,
      commands: [{ kind: "debugLog", text: "for" }],
    },
    { kind: "publishEvent", event: "hit" },
    { kind: "broadcastAndWait", event: "hit" },
    { kind: "callProcedure", name: "flash" },
    { kind: "onEvent", event: "hit", commands: [{ kind: "debugLog", text: "inline event" }] },
  ];
}

function fullNumericExpression(): NumericExpression {
  return {
    kind: "binary",
    left: { kind: "fixed", value: 1.25 },
    operator: "+",
    right: { kind: "timer", timer: "main" },
  };
}

function collectUpdateCommandKinds(project: Risc96Project): string[] {
  const kinds = new Set<string>();
  const visit = (command: UpdateCommand) => {
    kinds.add(command.kind);
    if (command.kind === "if") {
      command.thenCommands.forEach(visit);
      command.elseCommands.forEach(visit);
    }
    if (
      command.kind === "while" ||
      command.kind === "doWhile" ||
      command.kind === "for" ||
      command.kind === "onEvent" ||
      command.kind === "repeat" ||
      command.kind === "repeatUntil"
    )
      command.commands.forEach(visit);
  };

  for (const script of project.scripts) {
    script.blocks.update.forEach(visit);
    for (const eventScript of script.blocks.events ?? []) eventScript.commands.forEach(visit);
    for (const buttonEventScript of script.blocks.buttonEvents ?? [])
      buttonEventScript.commands.forEach(visit);
    for (const timerScript of script.blocks.timerEvents ?? []) timerScript.commands.forEach(visit);
    for (const procedure of script.blocks.procedures ?? []) procedure.commands.forEach(visit);
  }

  return [...kinds].sort();
}
