#ifndef RISC96_BLOCKLY_RUNTIME_H
#define RISC96_BLOCKLY_RUNTIME_H

#define R96_BUTTON_UP 0
#define R96_BUTTON_DOWN 1
#define R96_BUTTON_LEFT 2
#define R96_BUTTON_RIGHT 3
#define R96_BUTTON_A 4
#define R96_BUTTON_B 5
#define R96_BUTTON_X 6
#define R96_BUTTON_Y 7
#define R96_BUTTON_L 8
#define R96_BUTTON_R 9
#define R96_BUTTON_SELECT 10
#define R96_BUTTON_START 11

#define R96_TRANSPARENT 0x00000000u

typedef unsigned char r96_u8_t;
typedef unsigned int r96_u32_t;
typedef unsigned long r96_uintptr_t;
typedef unsigned long r96_size_t;

typedef struct {
  int x;
  int y;
  int width;
  int height;
} r96_rect_collider_t;

typedef struct {
  int width;
  int height;
  int frame_count;
  const r96_u32_t **frames;
  int collider_count;
  const r96_rect_collider_t *colliders;
} r96_sprite_def_t;

typedef struct {
  int freq;
  int ms;
} r96_tone_note_t;

typedef struct {
  int note_count;
  const r96_tone_note_t *notes;
} r96_sound_def_t;

typedef struct {
  int line_height;
  int glyph_count;
  int glyph_offset;
} r96_font_def_t;

typedef struct {
  int tileset_sprite_id;
  int width;
  int height;
  int tile_width;
  int tile_height;
  const unsigned short *tiles;
  const unsigned short *collision_tiles;
} r96_tilemap_def_t;

typedef struct {
  int slot;
  int id;
  int x;
  int y;
  int width;
  int height;
  int visible;
  int frame;
  int direction;
  int scale;
  int effect_kind;
  int effect_value;
  const r96_u32_t *pixels;
} r96_sprite_t;

typedef struct {
  int slot;
  unsigned int generation;
} r96_object_handle_t;

typedef r96_object_handle_t r96_text_handle_t;

void r96_user_start(void);
void r96_user_update(void);
void r96_user_draw(void);
#if R96_CUSTOM_SPRITE_RENDERER
int r96_user_draw_sprite(const r96_sprite_t *sprite);
#endif

void r96_engine_main(void);
void r96_set_resolution(int width, int height);
void r96_stage_set_background(unsigned int color);
void r96_debug_log_cstr(const char *message);

void r96_input_poll(void);
int r96_button_down(int port, int button);
int r96_button_pressed(int port, int button);
int r96_button_released(int port, int button);

r96_sprite_t r96_sprite_create(int sprite_id, int x, int y);
void r96_sprite_move(r96_sprite_t *sprite, int dx, int dy);
void r96_sprite_set_frame(r96_sprite_t *sprite, int frame);
void r96_sprite_set_position(r96_sprite_t *sprite, int x, int y);
int r96_sprite_x(const r96_sprite_t *sprite);
int r96_sprite_y(const r96_sprite_t *sprite);
void r96_sprite_show(r96_sprite_t *sprite);
void r96_sprite_hide(r96_sprite_t *sprite);
int r96_sprite_touching(const r96_sprite_t *a, const r96_sprite_t *b);
void r96_draw_all_sprites(void);
void r96_draw_sprite(const r96_sprite_t *sprite);
void r96_draw_sprite_frame(int sprite_id, int frame, int x, int y);

void r96_play_sound(int sound_id);
void r96_stop_all_sounds(void);
void r96_draw_font_glyph(int font_id, int glyph_index, int x, int y, int scale, unsigned int color);
void r96_draw_text(int font_id, const char *text, int x, int y, int scale, unsigned int color);
r96_text_handle_t r96_text_write(int font_id, const char *text, int x, int y, int scale, unsigned int color);
void r96_text_erase(r96_text_handle_t *handle);
void r96_text_move(r96_text_handle_t *handle, int dx, int dy);
void r96_text_set_position(r96_text_handle_t *handle, int x, int y);
void r96_clear_screen(unsigned int color);
void r96_event_publish(const char *event_name);
int r96_event_poll(const char *event_name);
void r96_yield_tick(void);
void r96_audio_mix_frame(void);
void r96_present(void);

#endif
