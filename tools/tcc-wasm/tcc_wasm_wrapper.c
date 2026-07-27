#include <emscripten/emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#include "libtcc.h"

static char error_log[8192];

EMSCRIPTEN_KEEPALIVE
const char *last_error(void) {
  return error_log;
}

EMSCRIPTEN_KEEPALIVE
unsigned char *allocUint8(unsigned int length) {
  return (unsigned char *)malloc(length);
}

EMSCRIPTEN_KEEPALIVE
void freeUint8(unsigned char *ptr) {
  free(ptr);
}

static void append_error(void *opaque, const char *message) {
  size_t used;
  size_t remaining;
  (void)opaque;

  used = strlen(error_log);
  if (used + 1 >= sizeof(error_log)) return;

  remaining = sizeof(error_log) - used - 1;
  strncat(error_log, message, remaining);
  used = strlen(error_log);
  if (used + 1 < sizeof(error_log)) strcat(error_log, "\n");
}

static unsigned char *length_prefixed_copy(const unsigned char *bytes, unsigned int length) {
  unsigned char *out = (unsigned char *)malloc(length + 4);
  if (!out) return 0;

  out[0] = (unsigned char)(length & 0xffu);
  out[1] = (unsigned char)((length >> 8) & 0xffu);
  out[2] = (unsigned char)((length >> 16) & 0xffu);
  out[3] = (unsigned char)((length >> 24) & 0xffu);
  if (length > 0) memcpy(out + 4, bytes, length);
  return out;
}

static unsigned char *empty_result(void) {
  return length_prefixed_copy((const unsigned char *)"", 0);
}

static int write_text_file(const char *path, const char *contents) {
  FILE *file = fopen(path, "wb");
  size_t length;

  if (!file) return -1;

  length = strlen(contents);
  if (length > 0 && fwrite(contents, 1, length, file) != length) {
    fclose(file);
    return -1;
  }

  return fclose(file) == 0 ? 0 : -1;
}

static unsigned char *read_file_result(const char *path) {
  FILE *file = fopen(path, "rb");
  long length;
  unsigned char *bytes;
  unsigned char *result;

  if (!file) return empty_result();
  if (fseek(file, 0, SEEK_END) != 0) {
    fclose(file);
    return empty_result();
  }

  length = ftell(file);
  if (length < 0 || fseek(file, 0, SEEK_SET) != 0) {
    fclose(file);
    return empty_result();
  }

  bytes = (unsigned char *)malloc((unsigned long)length);
  if (!bytes) {
    fclose(file);
    return empty_result();
  }

  if (length > 0 && fread(bytes, 1, (unsigned long)length, file) != (unsigned long)length) {
    free(bytes);
    fclose(file);
    return empty_result();
  }

  fclose(file);
  result = length_prefixed_copy(bytes, (unsigned int)length);
  free(bytes);
  return result ? result : empty_result();
}

static int set_options_from_json(TCCState *state, const char *json) {
  // Parse JSON array of strings like `["-nostdlib", "-static"]`
  // and pass them all to tcc_set_options.
  if (!json || *json != '[') return -1;

  // Build a single options string from the JSON array
  static char buf[4096];
  int pos = 0;
  const char *p = json + 1;

  while (*p && *p != ']' && pos < (int)sizeof(buf) - 2) {
    // Skip whitespace and commas
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
    if (*p == ']' || !*p) break;

    if (*p == '"') {
      p++; // skip opening quote
      while (*p && *p != '"' && pos < (int)sizeof(buf) - 2) {
        if (*p == '\\') { p++; if (*p) { buf[pos++] = *p++; } }
        else { buf[pos++] = *p++; }
      }
      if (*p == '"') p++; // skip closing quote
      buf[pos++] = ' ';
    } else {
      // Not a JSON string – skip this token
      while (*p && *p != ',' && *p != ']') p++;
    }
  }
  buf[pos] = '\0';

  if (pos > 0) tcc_set_options(state, buf);
  return 0;
}

EMSCRIPTEN_KEEPALIVE
unsigned char *compile_program(const char *options_json, const char *code) {
  const char *output_path = "/tmp/scratch96-tcc-output.elf";
  TCCState *state;
  int failed = 0;

  error_log[0] = 0;
  mkdir("/tmp", 0777);
  remove(output_path);

  state = tcc_new();
  if (!state) return empty_result();

  tcc_set_error_func(state, 0, append_error);
  tcc_set_lib_path(state, "/");
  set_options_from_json(state, options_json);
  if (tcc_set_output_type(state, TCC_OUTPUT_EXE) < 0) failed = 1;
  if (!failed && tcc_compile_string(state, code) < 0) failed = 1;
  if (!failed && tcc_output_file(state, output_path) < 0) failed = 1;

  tcc_delete(state);
  if (failed) return empty_result();

  return read_file_result(output_path);
}

EMSCRIPTEN_KEEPALIVE
unsigned char *link_assembly(const char *options_json, const char *assembly) {
  const char *input_path = "/tmp/scratch96-tcc-input.s";
  const char *output_path = "/tmp/scratch96-tcc-output.elf";
  TCCState *state;
  int failed = 0;

  error_log[0] = 0;
  mkdir("/tmp", 0777);
  remove(input_path);
  remove(output_path);

  if (write_text_file(input_path, assembly) < 0) return empty_result();

  state = tcc_new();
  if (!state) return empty_result();

  tcc_set_error_func(state, 0, append_error);
  tcc_set_lib_path(state, "/");
  set_options_from_json(state, options_json);
  if (tcc_set_output_type(state, TCC_OUTPUT_EXE) < 0) failed = 1;
  if (!failed && tcc_add_file(state, input_path) < 0) failed = 1;
  if (!failed && tcc_output_file(state, output_path) < 0) failed = 1;

  tcc_delete(state);
  if (failed) return empty_result();

  return read_file_result(output_path);
}
