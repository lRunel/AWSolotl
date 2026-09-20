#ifndef PROCESS_H
#define PROCESS_H

#define MAX_PROCESSES 32

typedef enum {
    PROC_UNUSED = 0,
    PROC_RUNNING,
    PROC_DEAD,
    PROC_INITIALIZING
} process_state_t;

typedef struct {
    int pid;
    process_state_t state;
    char name[32];
    char cwd[64];
} process_t;

#endif
