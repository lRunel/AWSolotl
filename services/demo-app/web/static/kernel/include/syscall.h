#ifndef SYSCALL_H
#define SYSCALL_H


typedef enum {
    SYS_PING = 0,
    SYS_SPAWN,
    SYS_EXIT,
    SYS_REAP,
    SYS_READ,
    SYS_WRITE,
    SYS_MKDIR,
    SYS_LS,
    SYS_TOUCH,
    SYS_CHDIR,
    SYS_GETCWD,
    SYS_SETSTATE
} syscall_number_t;

typedef struct {
    int pid;
    int arg;
    syscall_number_t number;
    char path[256];
    char data[4096];
} syscall_t;

typedef struct {
    int status;
    char data[524288];
} syscall_response_t;

#endif
