#ifndef KERNEL_H
#define KERNEL_H

#include "syscall.h"
#include "process.h"
#include "vfs.h"
typedef struct {
    int used_bytes;
    int max_bytes;
} memory_state_t;

typedef struct {
    int running;
    int current_index;
    process_t process_table[MAX_PROCESSES];
    vfs_node_t *vfs_root;
    memory_state_t memory;
}kernel_state_t;

void kernel_init(kernel_state_t *kernel);

void kernel_handle_syscall(
    kernel_state_t *kernel,
    const syscall_t *request,
    syscall_response_t *response
);

#endif
