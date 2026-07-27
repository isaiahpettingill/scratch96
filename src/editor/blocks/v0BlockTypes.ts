export const carbonBlue = "#0f62fe";
export const carbonPurple = "#8a3ffc";
export const carbonGreen = "#24a148";
export const carbonTeal = "#007d79";
export const carbonRed = "#da1e28";
export const carbonGray = "#525252";

export const blocklyColorKey = `colo${"ur"}`;

export const v0BlockTypes = {
  setup: "r96_setup",
  updateLoop: "r96_update_loop",
  drawLoop: "r96_draw_loop",
  yieldFrame: "r96_yield_frame",
  stopProgram: "r96_stop_program",
  frameCount: "r96_frame_count",
  screenWidth: "r96_screen_width",
  screenHeight: "r96_screen_height",

  debugLog: "r96_debug_log",
  setClearColor: "r96_set_clear_color",
  clearScreen: "r96_clear_screen",
  drawSprite: "r96_draw_sprite",
  drawSpriteFrame: "r96_draw_sprite_frame",
  drawRect: "r96_draw_rect",
  drawLine: "r96_draw_line",
  drawCircle: "r96_draw_circle",
  drawText: "r96_draw_text",
  drawTilemap: "r96_draw_tilemap",

  createSprite: "r96_create_sprite",
  setSpriteFrame: "r96_set_sprite_frame",
  moveSprite: "r96_move_sprite",
  setSpriteX: "r96_set_sprite_x",
  setSpriteY: "r96_set_sprite_y",
  setSpritePosition: "r96_set_sprite_position",
  spriteXValue: "r96_sprite_x_value",
  spriteYValue: "r96_sprite_y_value",
  spriteWidthValue: "r96_sprite_width_value",
  spriteHeightValue: "r96_sprite_height_value",
  spriteTouching: "r96_sprite_touching",
  spriteTouchingTilemap: "r96_sprite_touching_tilemap",

  ifThen: "r96_if_then",
  ifThenElse: "r96_if_then_else",
  whileLoop: "r96_while_loop",
  forLoop: "r96_for_loop",
  breakLoop: "r96_break_loop",
  continueLoop: "r96_continue_loop",
  waitFrames: "r96_wait_frames",
  waitSeconds: "r96_wait_seconds",
  repeatTimes: "r96_repeat_times",
  everyFrames: "r96_every_frames",

  incrementVariable: "r96_increment_variable",
  decrementVariable: "r96_decrement_variable",
  setVariable: "r96_set_variable",
  initTextVariable: "r96_init_text_variable",
  textVariableValue: "r96_text_variable_value",
  setArrayItem: "r96_set_array_item",
  arrayItemValue: "r96_array_item_value",
  variableValue: "r96_variable_value",
  arrayLength: "r96_array_length",
  clearArray: "r96_clear_array",

  compare: "r96_compare",
  buttonDown: "r96_button_down",
  buttonPressed: "r96_button_pressed",
  buttonReleased: "r96_button_released",
  dpadAxis: "r96_dpad_axis",
  mathBinary: "r96_math_binary",
  random: "r96_random",
  mathUnary: "r96_math_unary",
  minMax: "r96_min_max",
  clamp: "r96_clamp",
  trig: "r96_trig",
  boolBinary: "r96_bool_binary",
  boolNot: "r96_bool_not",
  stringLiteral: "r96_string_literal",
  numberToString: "r96_number_to_string",
  numberToHexString: "r96_number_to_hex_string",

  playSound: "r96_play_sound",
  stopAllSounds: "r96_stop_all_sounds",
  playSoundAndWait: "r96_play_sound_and_wait",
  setSoundTempo: "r96_set_sound_tempo",

  defineProcedure: "r96_define_procedure",
  callProcedure: "r96_call_procedure",
} as const;
