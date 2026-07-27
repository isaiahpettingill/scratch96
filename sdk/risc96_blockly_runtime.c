#include "risc96_blockly_runtime.h"
#include "generated_assets.h"

#if R96_CUSTOM_SPRITE_RENDERER
int r96_user_draw_sprite(const r96_sprite_t *sprite);
#endif

#define RISC96_SYS_GET_FRAMEBUFFER 500u
#define RISC96_SYS_GET_AUDIOBUFFER 501u
#define RISC96_SYS_CONTROLLER_1 502u
#define RISC96_SYS_CONTROLLER_2 503u
#define RISC96_SYS_CONTROLLER_3 504u
#define RISC96_SYS_CONTROLLER_4 505u
#define RISC96_SYS_PRESENT 506u
#define RISC96_SYS_SET_RESOLUTION 507u
#define RISC96_SYS_DEBUG_LOG 495u

#define RISC96_FRAMEBUFFER_PITCH_PIXELS 320
#define RISC96_AUDIO_SAMPLES 1600
#define R96_MAX_SPRITES 16
#define R96_MAX_EVENTS 16
#define R96_MAX_TEXTS 32

typedef struct {
  int active;
  unsigned int generation;
  int font_id;
  const char *text;
  int x;
  int y;
  int scale;
  r96_u32_t color;
} r96_text_slot_t;

static int r96_screen_width = 320;
static int r96_screen_height = 224;
static r96_u32_t r96_stage_background_color = 0x00000000u;
#if R96_INPUT_ENABLED
static r96_u8_t r96_input_now[4][3];
static r96_u8_t r96_input_prev[4][3];
#endif
#if R96_SPRITES_ENABLED
static r96_sprite_t r96_sprites[R96_MAX_SPRITES];
static int r96_sprite_count = 0;
#endif
#if R96_EVENTS_ENABLED
static const char *r96_events[R96_MAX_EVENTS];
static int r96_event_count = 0;
#endif
#if R96_AUDIO_ENABLED
static int r96_sound_playing = 0;
static int r96_sound_id = 0;
static int r96_sound_samples_left = 0;
static int r96_sound_phase = 0;
#endif
#if R96_TEXT_HANDLE_COUNT > 0
static r96_text_slot_t r96_texts[R96_MAX_TEXTS];
#endif

static r96_uintptr_t r96_syscall0(r96_u32_t sysno);
static r96_uintptr_t r96_syscall2(r96_u32_t sysno, r96_uintptr_t arg0, r96_uintptr_t arg1);
static r96_uintptr_t r96_ecall7(
  r96_uintptr_t arg0,
  r96_uintptr_t arg1,
  r96_uintptr_t arg2,
  r96_uintptr_t arg3,
  r96_uintptr_t arg4,
  r96_uintptr_t arg5,
  r96_uintptr_t arg6,
  r96_uintptr_t sysno);
#if R96_INPUT_ENABLED
static int r96_button_level(r96_u8_t input[4][3], int port, int button);
#endif
static void r96_clear_framebuffer(void);
#if R96_TEXT_HANDLE_COUNT > 0
static void r96_draw_all_texts(void);
#endif
#if R96_DRAW_TEXT_ENABLED > 0
static int r96_find_font_glyph(int font_id, int code);
static void r96_draw_text_scaled(int font_id, const char *text, int x, int y, int scale, r96_u32_t color);
#endif
static r96_size_t r96_cstr_len(const char *message);
#if R96_INPUT_ENABLED
static void r96_copy_controller(int port, r96_u32_t sysno);
#endif
#if R96_EVENTS_ENABLED
static int r96_cstr_eq(const char *left, const char *right);
#endif
static int r96_rects_overlap(int ax, int ay, const r96_rect_collider_t *a, int bx, int by, const r96_rect_collider_t *b);

void r96_engine_main(void) {
  r96_set_resolution(r96_screen_width, r96_screen_height);
  r96_user_start();

  for (;;) {
#if R96_EVENTS_ENABLED
    r96_event_count = 0;
#endif
#if R96_INPUT_ENABLED
    r96_input_poll();
#endif
    r96_user_update();
    r96_user_draw();
#if R96_TEXT_HANDLE_COUNT > 0
    r96_draw_all_texts();
#endif
#if R96_AUDIO_ENABLED
    r96_audio_mix_frame();
#endif
    r96_present();
  }
}

r96_uintptr_t r96_syscall0(r96_u32_t sysno) {
  return r96_ecall7(0, 0, 0, 0, 0, 0, 0, (r96_uintptr_t)sysno);
}

r96_uintptr_t r96_syscall2(r96_u32_t sysno, r96_uintptr_t arg0, r96_uintptr_t arg1) {
  return r96_ecall7(arg0, arg1, 0, 0, 0, 0, 0, (r96_uintptr_t)sysno);
}

static r96_uintptr_t r96_ecall7(
  r96_uintptr_t arg0,
  r96_uintptr_t arg1,
  r96_uintptr_t arg2,
  r96_uintptr_t arg3,
  r96_uintptr_t arg4,
  r96_uintptr_t arg5,
  r96_uintptr_t arg6,
  r96_uintptr_t sysno) {
  (void)arg0;
  (void)arg1;
  (void)arg2;
  (void)arg3;
  (void)arg4;
  (void)arg5;
  (void)arg6;
  (void)sysno;
  __asm__ volatile("ecall");
}

void r96_set_resolution(int width, int height) {
  r96_screen_width = width;
  r96_screen_height = height;
  (void)r96_syscall2(RISC96_SYS_SET_RESOLUTION, (r96_uintptr_t)width, (r96_uintptr_t)height);
}

void r96_stage_set_background(r96_u32_t color) {
  r96_stage_background_color = color;
}

void r96_debug_log_cstr(const char *message) {
  (void)r96_syscall2(RISC96_SYS_DEBUG_LOG, (r96_uintptr_t)message, (r96_uintptr_t)r96_cstr_len(message));
}

#if R96_INPUT_ENABLED
void r96_input_poll(void) {
  for (int port = 0; port < 4; port++) {
    for (int byte = 0; byte < 3; byte++) {
      r96_input_prev[port][byte] = r96_input_now[port][byte];
    }
  }

  r96_copy_controller(0, RISC96_SYS_CONTROLLER_1);
  r96_copy_controller(1, RISC96_SYS_CONTROLLER_2);
  r96_copy_controller(2, RISC96_SYS_CONTROLLER_3);
  r96_copy_controller(3, RISC96_SYS_CONTROLLER_4);
}

int r96_button_down(int port, int button) {
  return r96_button_level(r96_input_now, port, button) != 0;
}

int r96_button_pressed(int port, int button) {
  return r96_button_level(r96_input_now, port, button) != 0 && r96_button_level(r96_input_prev, port, button) == 0;
}

int r96_button_released(int port, int button) {
  return r96_button_level(r96_input_now, port, button) == 0 && r96_button_level(r96_input_prev, port, button) != 0;
}
#endif

#if R96_SPRITES_ENABLED
r96_sprite_t r96_sprite_create(int sprite_id, int x, int y) {
  const r96_sprite_def_t *def = &r96_sprite_defs[sprite_id];
  int slot = r96_sprite_count;
  r96_sprite_t sprite;
  sprite.slot = slot;
  sprite.id = sprite_id;
  sprite.x = x;
  sprite.y = y;
  sprite.width = def->width;
  sprite.height = def->height;
  sprite.visible = 1;
  sprite.frame = 0;
  sprite.direction = 90;
  sprite.scale = 100;
  sprite.effect_kind = 0;
  sprite.effect_value = 0;
  sprite.pixels = def->frames[0];
  if (r96_sprite_count < R96_MAX_SPRITES) {
    r96_sprites[r96_sprite_count] = sprite;
    r96_sprite_count++;
  }
  return sprite;
}

void r96_sprite_set_frame(r96_sprite_t *sprite, int frame) {
  const r96_sprite_def_t *def = &r96_sprite_defs[sprite->id];
  if (frame < 0 || frame >= def->frame_count) return;
  sprite->frame = frame;
  sprite->pixels = def->frames[frame];

  if (sprite->slot >= 0 && sprite->slot < r96_sprite_count) {
    r96_sprites[sprite->slot].frame = frame;
    r96_sprites[sprite->slot].pixels = sprite->pixels;
  }
}

void r96_sprite_move(r96_sprite_t *sprite, int dx, int dy) {
  sprite->x += dx;
  sprite->y += dy;

  if (sprite->slot >= 0 && sprite->slot < r96_sprite_count) {
    r96_sprites[sprite->slot].x = sprite->x;
    r96_sprites[sprite->slot].y = sprite->y;
  }
}

void r96_sprite_set_position(r96_sprite_t *sprite, int x, int y) {
  sprite->x = x;
  sprite->y = y;

  if (sprite->slot >= 0 && sprite->slot < r96_sprite_count) {
    r96_sprites[sprite->slot].x = sprite->x;
    r96_sprites[sprite->slot].y = sprite->y;
  }
}

int r96_sprite_x(const r96_sprite_t *sprite) {
  return sprite->x;
}

int r96_sprite_y(const r96_sprite_t *sprite) {
  return sprite->y;
}

void r96_sprite_show(r96_sprite_t *sprite) {
  sprite->visible = 1;

  if (sprite->slot >= 0 && sprite->slot < r96_sprite_count) r96_sprites[sprite->slot].visible = 1;
}

void r96_sprite_hide(r96_sprite_t *sprite) {
  sprite->visible = 0;

  if (sprite->slot >= 0 && sprite->slot < r96_sprite_count) r96_sprites[sprite->slot].visible = 0;
}

int r96_sprite_touching(const r96_sprite_t *a, const r96_sprite_t *b) {
  if (!a->visible || !b->visible) return 0;

  const r96_sprite_def_t *a_def = &r96_sprite_defs[a->id];
  const r96_sprite_def_t *b_def = &r96_sprite_defs[b->id];

  for (int ai = 0; ai < a_def->collider_count; ai++) {
    for (int bi = 0; bi < b_def->collider_count; bi++) {
      if (r96_rects_overlap(a->x, a->y, &a_def->colliders[ai], b->x, b->y, &b_def->colliders[bi])) return 1;
    }
  }

  return 0;
}

void r96_draw_all_sprites(void) {
  for (int index = 0; index < r96_sprite_count; index++) {
    r96_draw_sprite(&r96_sprites[index]);
  }
}
#endif

#if R96_AUDIO_ENABLED
void r96_play_sound(int sound_id) {
  r96_sound_playing = 1;
  r96_sound_id = sound_id;
  r96_sound_samples_left = 4800;
  r96_sound_phase = 0;
}

void r96_stop_all_sounds(void) {
  r96_sound_playing = 0;
}
#endif

void r96_draw_font_glyph(int font_id, int glyph_index, int x, int y, int scale, r96_u32_t color) {
  (void)font_id;
  (void)glyph_index;
  (void)x;
  (void)y;
  (void)scale;
  (void)color;
}

void r96_draw_text(int font_id, const char *text, int x, int y, int scale, r96_u32_t color) {
#if R96_DRAW_TEXT_ENABLED > 0
  r96_draw_text_scaled(font_id, text, x, y, scale, color);
#else
  (void)font_id;
  (void)text;
  (void)x;
  (void)y;
  (void)scale;
  (void)color;
#endif
}

#if R96_TEXT_HANDLE_COUNT > 0
r96_text_handle_t r96_text_write(int font_id, const char *text, int x, int y, int scale, r96_u32_t color) {
  r96_text_handle_t handle = {-1, 0};
  if (scale < 1) scale = 1;

  for (int index = 0; index < R96_MAX_TEXTS; index++) {
    if (!r96_texts[index].active) {
      r96_texts[index].active = 1;
      r96_texts[index].generation++;
      if (r96_texts[index].generation == 0) r96_texts[index].generation = 1;
      r96_texts[index].font_id = font_id;
      r96_texts[index].text = text;
      r96_texts[index].x = x;
      r96_texts[index].y = y;
      r96_texts[index].scale = scale;
      r96_texts[index].color = color;
      handle.slot = index;
      handle.generation = r96_texts[index].generation;
      return handle;
    }
  }

  return handle;
}

void r96_text_erase(r96_text_handle_t *handle) {
  if (!handle || handle->slot < 0 || handle->slot >= R96_MAX_TEXTS) return;

  r96_text_slot_t *slot = &r96_texts[handle->slot];
  if (slot->active && slot->generation == handle->generation) {
    slot->active = 0;
    slot->text = 0;
  }

  handle->slot = -1;
  handle->generation = 0;
}

void r96_text_move(r96_text_handle_t *handle, int dx, int dy) {
  if (!handle || handle->slot < 0 || handle->slot >= R96_MAX_TEXTS) return;

  r96_text_slot_t *slot = &r96_texts[handle->slot];
  if (slot->active && slot->generation == handle->generation) {
    slot->x += dx;
    slot->y += dy;
  }
}

void r96_text_set_position(r96_text_handle_t *handle, int x, int y) {
  if (!handle || handle->slot < 0 || handle->slot >= R96_MAX_TEXTS) return;

  r96_text_slot_t *slot = &r96_texts[handle->slot];
  if (slot->active && slot->generation == handle->generation) {
    slot->x = x;
    slot->y = y;
  }
}
#endif

void r96_clear_screen(r96_u32_t color) {
  r96_stage_background_color = color;
  r96_clear_framebuffer();
}

#if R96_TEXT_HANDLE_COUNT > 0
static void r96_draw_all_texts(void) {
#if R96_DRAW_TEXT_ENABLED > 0
  for (int index = 0; index < R96_MAX_TEXTS; index++) {
    if (r96_texts[index].active && r96_texts[index].text) {
      r96_draw_text_scaled(r96_texts[index].font_id, r96_texts[index].text, r96_texts[index].x, r96_texts[index].y, r96_texts[index].scale, r96_texts[index].color);
    }
  }
#endif
}
#endif

#if R96_DRAW_TEXT_ENABLED > 0
static int r96_find_font_glyph(int font_id, int code) {
  const r96_font_def_t *font;
  int start;
  int end;
  int index;

  if (font_id < 0 || font_id >= R96_FONT_COUNT) return -1;

  font = &r96_font_defs[font_id];
  start = font->glyph_offset;
  end = start + font->glyph_count;
  for (index = start; index < end; index++) {
    if (r96_font_glyph_codes[index] == code) return index;
  }

  return -1;
}

static void r96_draw_text_scaled(int font_id, const char *text, int x, int y, int scale, r96_u32_t color) {
  volatile r96_u32_t *framebuffer;
  int cursor;
  int char_index;
  int code;
  int glyph_index;
  int advance;
  int width;
  int height;
  int x_offset;
  int y_offset;
  int row_offset;
  int bytes_per_row;
  int row;
  int column;
  int sx;
  int sy;
  int px;
  int py;
  r96_u8_t row_byte;

  if (!text || font_id < 0 || font_id >= R96_FONT_COUNT) return;

  framebuffer = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);
  if (scale < 1) scale = 1;

  cursor = x;
  for (char_index = 0; text[char_index] != 0; char_index++) {
    code = (r96_u8_t)text[char_index];
    glyph_index = r96_find_font_glyph(font_id, code);
    advance = 0;

    if (glyph_index >= 0) advance = r96_font_glyph_x_advances[glyph_index];
    if (advance <= 0) {
      advance = r96_font_defs[font_id].line_height;
      if (advance <= 0) advance = 8;
    }

    if (glyph_index >= 0) {
      width = r96_font_glyph_widths[glyph_index];
      height = r96_font_glyph_heights[glyph_index];
      x_offset = r96_font_glyph_x_offsets[glyph_index];
      y_offset = r96_font_glyph_y_offsets[glyph_index];
      row_offset = r96_font_glyph_row_offsets[glyph_index];
      bytes_per_row = (width + 7) / 8;

      for (row = 0; row < height; row++) {
        for (column = 0; column < width; column++) {
          row_byte = r96_font_row_bytes[row_offset + row * bytes_per_row + column / 8];
          if ((row_byte & (1u << (column % 8))) == 0) continue;

          for (sy = 0; sy < scale; sy++) {
            py = y + (y_offset + row) * scale + sy;
            if (py < 0 || py >= r96_screen_height) continue;
            for (sx = 0; sx < scale; sx++) {
              px = cursor + (x_offset + column) * scale + sx;
              if (px >= 0 && px < r96_screen_width) framebuffer[py * RISC96_FRAMEBUFFER_PITCH_PIXELS + px] = color;
            }
          }
        }
      }
    }

    cursor += advance * scale;
  }
}

#endif

#if R96_EVENTS_ENABLED
void r96_event_publish(const char *event_name) {
  if (r96_event_count >= R96_MAX_EVENTS) return;
  r96_events[r96_event_count] = event_name;
  r96_event_count++;
}

int r96_event_poll(const char *event_name) {
  for (int index = 0; index < r96_event_count; index++) {
    if (r96_cstr_eq(r96_events[index], event_name)) return 1;
  }
  return 0;
}
#endif

void r96_yield_tick(void) {
  r96_present();
}

#if R96_AUDIO_ENABLED
void r96_audio_mix_frame(void) {
  volatile short *audio = (volatile short *)r96_syscall0(RISC96_SYS_GET_AUDIOBUFFER);
  for (int sample = 0; sample < RISC96_AUDIO_SAMPLES; sample++) {
    if (r96_sound_playing) {
      if (r96_sound_samples_left <= 0) {
        r96_sound_playing = 0;
        audio[sample] = 0;
      } else {
        int freq = 440 + (r96_sound_id & 7) * 110;
        int half_period = freq > 0 ? 24000 / freq : 24000;
        if (half_period < 1) half_period = 1;
        audio[sample] = (r96_sound_phase / half_period) & 1 ? 6000 : -6000;
        r96_sound_phase++;
        if (r96_sound_phase >= half_period * 2) r96_sound_phase = 0;
        r96_sound_samples_left--;
      }
    } else {
      audio[sample] = 0;
    }
  }
}
#endif

void r96_present(void) {
  (void)r96_syscall0(RISC96_SYS_PRESENT);
}

void *memset(void *dst, int value, r96_size_t count) {
  r96_u8_t *out = (r96_u8_t *)dst;
  for (r96_size_t index = 0; index < count; index++) {
    out[index] = (r96_u8_t)value;
  }
  return dst;
}

void *memmove(void *dst, const void *src, r96_size_t count) {
  r96_u8_t *out = (r96_u8_t *)dst;
  const r96_u8_t *in = (const r96_u8_t *)src;

  if (out < in) {
    for (r96_size_t index = 0; index < count; index++) out[index] = in[index];
    return dst;
  }

  while (count > 0) {
    count--;
    out[count] = in[count];
  }
  return dst;
}

#if R96_INPUT_ENABLED
static int r96_button_level(r96_u8_t input[4][3], int port, int button) {
  int byte = button / 4;
  int shift = (button % 4) * 2;
  return (input[port][byte] >> shift) & 0x03;
}
#endif

static void r96_clear_framebuffer(void) {
  volatile r96_u32_t *framebuffer = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);

  for (int y = 0; y < r96_screen_height; y++) {
    for (int x = 0; x < r96_screen_width; x++) {
      framebuffer[y * RISC96_FRAMEBUFFER_PITCH_PIXELS + x] = r96_stage_background_color;
    }
  }
}

#if R96_SPRITES_ENABLED
void r96_draw_sprite(const r96_sprite_t *sprite) {
  if (!sprite->visible) return;
#if R96_CUSTOM_SPRITE_RENDERER
  if (r96_user_draw_sprite(sprite)) return;
#endif
#if R96_ADVANCED_SPRITE_RENDERER
  const r96_sprite_def_t *def = &r96_sprite_defs[sprite->id];
  const r96_u32_t *pixels = def->frames[sprite->frame];
  volatile r96_u32_t *framebuffer = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);
  int pixel_count = def->width * def->height;
  int scale_stride = sprite->scale >= 200 ? 2 : 1;

  for (int i = 0; i < pixel_count; i++) {
    r96_u32_t color = pixels[i];
    if (color == R96_TRANSPARENT) continue;
    if (sprite->effect_kind == 1) color = 0x00ffffffu - (color & 0x00ffffffu);
    if (sprite->effect_kind == 0 && sprite->effect_value != 0) color = (color + (r96_u32_t)sprite->effect_value) & 0x00ffffffu;
    framebuffer[sprite->y * RISC96_FRAMEBUFFER_PITCH_PIXELS + sprite->x + i * scale_stride] = color;
  }
#else
  r96_draw_sprite_frame(sprite->id, sprite->frame, sprite->x, sprite->y);
#endif
}

void r96_draw_sprite_frame(int sprite_id, int frame, int x, int y) {
  const r96_sprite_def_t *def = &r96_sprite_defs[sprite_id];
  const r96_u32_t *pixels = def->frames[frame];
  volatile r96_u32_t *framebuffer = (volatile r96_u32_t *)r96_syscall0(RISC96_SYS_GET_FRAMEBUFFER);

  for (int py = 0; py < def->height; py++) {
    for (int px = 0; px < def->width; px++) {
      r96_u32_t color = pixels[py * def->width + px];
      if (color != R96_TRANSPARENT) {
        framebuffer[(y + py) * RISC96_FRAMEBUFFER_PITCH_PIXELS + x + px] = color;
      }
    }
  }
}
#endif

static r96_size_t r96_cstr_len(const char *message) {
  r96_size_t len = 0;
  while (message[len] != 0) len++;
  return len;
}

#if R96_EVENTS_ENABLED
static int r96_cstr_eq(const char *left, const char *right) {
  int index = 0;
  while (left[index] != 0 && right[index] != 0) {
    if (left[index] != right[index]) return 0;
    index++;
  }
  return left[index] == right[index];
}
#endif

#if R96_INPUT_ENABLED
static void r96_copy_controller(int port, r96_u32_t sysno) {
  volatile r96_u8_t *controller = (volatile r96_u8_t *)r96_syscall0(sysno);
  for (int byte = 0; byte < 3; byte++) {
    r96_input_now[port][byte] = controller[byte];
  }
}
#endif

#if R96_SPRITES_ENABLED
static int r96_rects_overlap(int ax, int ay, const r96_rect_collider_t *a, int bx, int by, const r96_rect_collider_t *b) {
  int a_left = ax + a->x;
  int a_top = ay + a->y;
  int b_left = bx + b->x;
  int b_top = by + b->y;

  return a_left < b_left + b->width && a_left + a->width > b_left && a_top < b_top + b->height &&
         a_top + a->height > b_top;
}
#endif
