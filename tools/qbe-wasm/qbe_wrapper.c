#include <emscripten/emscripten.h>
#include <setjmp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

int qbe_main(int argc, char **argv);

static char error_log[8192];
static jmp_buf exit_jmp;
static int exit_status;

void qbe_exit(int status) {
  fflush(NULL);
  exit_status = status;
  longjmp(exit_jmp, 1);
}

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

static void read_error_file(const char *path) {
  FILE *file = fopen(path, "rb");
  size_t length;

  error_log[0] = 0;
  if (!file) return;

  length = fread(error_log, 1, sizeof(error_log) - 1, file);
  error_log[length] = 0;
  fclose(file);
}

EMSCRIPTEN_KEEPALIVE
unsigned char *compile_qbe_to_assembly(const char *ir) {
  const char *input_path = "/tmp/scratch96-qbe-input.ssa";
  const char *output_path = "/tmp/scratch96-qbe-output.s";
  const char *error_path = "/tmp/scratch96-qbe-error.log";
  char *argv[] = {
    "qbe",
    "-t",
    "rv64",
    "-o",
    (char *)output_path,
    (char *)input_path,
  };
  int status = 0;

  error_log[0] = 0;
  mkdir("/tmp", 0777);
  remove(input_path);
  remove(output_path);
  remove(error_path);

  if (write_text_file(input_path, ir) < 0) {
    strcpy(error_log, "Failed to write QBE input.");
    return empty_result();
  }

  freopen(error_path, "wb", stderr);
  exit_status = 0;
  if (setjmp(exit_jmp) == 0) {
    status = qbe_main((int)(sizeof(argv) / sizeof(argv[0])), argv);
  } else {
    status = exit_status;
  }
  fflush(stderr);

  if (status != 0) {
    read_error_file(error_path);
    if (error_log[0] == 0) strcpy(error_log, "QBE failed.");
    return empty_result();
  }

  return read_file_result(output_path);
}
