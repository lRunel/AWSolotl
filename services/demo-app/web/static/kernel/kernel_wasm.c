#include <stdio.h>
#include <string.h>
#include <stdarg.h>
#include <emscripten.h>
#include "include/kernel.h"

/* ============================================================
 * RuneOS — WebAssembly Export Layer
 * Exposes the real C kernel to JavaScript via Emscripten.
 * ============================================================ */

static kernel_state_t g_kern;

/* Forward declaration — defined in core/resume.c */
extern const char *get_resume_html(void);

/* Output capture buffer — printf is redirected here via
   the custom __stdout_write sink registered at init. */
#define OUTPUT_BUF_SIZE 524288
static char output_buf[OUTPUT_BUF_SIZE];
static int  output_pos = 0;

/* Emscripten allows overriding print output via EM_ASM.
   We instead buffer printf calls manually using a tiny
   wrapper that replaces printf for our command runner. */

/* Reset the output capture buffer */
static void buf_reset(void) {
    output_pos = 0;
    output_buf[0] = '\0';
}

/* Write formatted text into the capture buffer */
static void buf_printf(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    int remaining = OUTPUT_BUF_SIZE - output_pos - 1;
    if (remaining > 0) {
        int written = vsnprintf(output_buf + output_pos, remaining, fmt, args);
        if (written > 0) output_pos += written;
    }
    va_end(args);
}

/* ---- Reimplementation using structured syscalls ---- */

EMSCRIPTEN_KEEPALIVE
int wasm_syscall(int number, int pid, const char *path, const char *data, int arg) {
    syscall_t req = {0};
    static syscall_response_t res;

    req.number = number;
    req.pid = pid;
    req.arg = arg;
    if (path) strncpy(req.path, path, sizeof(req.path) - 1);
    if (data) strncpy(req.data, data, sizeof(req.data) - 1);

    kernel_handle_syscall(&g_kern, &req, &res);

    buf_reset();
    output_pos = snprintf(output_buf, OUTPUT_BUF_SIZE, "%d|", res.status);
    size_t len = strlen(res.data);
    if (output_pos + len < OUTPUT_BUF_SIZE) {
        memcpy(output_buf + output_pos, res.data, len + 1);
        output_pos += len;
    } else {
        memcpy(output_buf + output_pos, res.data, OUTPUT_BUF_SIZE - output_pos - 1);
        output_buf[OUTPUT_BUF_SIZE - 1] = '\0';
        output_pos = OUTPUT_BUF_SIZE - 1;
    }
    return res.status;
}

EMSCRIPTEN_KEEPALIVE
const char *wasm_get_output(void) {
    return output_buf;
}

/* ============================================================
 * Exported Functions (called from JavaScript)
 * ============================================================ */

EMSCRIPTEN_KEEPALIVE
void wasm_kernel_init(void) {
    kernel_init(&g_kern);
}


