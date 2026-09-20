#include <stdio.h>
#include <string.h>
#include "kernel.h"

void do_read(kernel_state_t *kernel, const char *path) {
    syscall_t req = {0};
    syscall_response_t res;

    req.number = SYS_READ;
    strncpy(req.path, path, sizeof(req.path) - 1);
    req.path[sizeof(req.path) - 1] = '\0';

    kernel_handle_syscall(kernel, &req, &res);

    if (res.status == 0)
        printf("%s\n", res.data);
    else
        printf("error: %s\n", res.data);
}
void run_command(kernel_state_t *kernel, char *line) {
    char *cmd = strtok(line, " \n");

    if (!cmd) return;

    if (strcmp(cmd, "cat") == 0) {
        char *path = strtok(NULL, " \n");
        if (!path) {
            printf("usage: cat <path>\n");
            return;
        }
        do_read(kernel, path);
    }

    else if (strcmp(cmd, "echo") == 0) {
        char *text = strtok(NULL, ">");
        char *redir = strtok(NULL, "\n");

        if (!text || !redir) {
            printf("usage: echo <text> > <path>\n");
            return;
        }

        while (*redir == ' ') redir++;

        syscall_t req = {0};
        syscall_response_t res;

        req.number = SYS_WRITE;
        req.pid = 1;
        strncpy(req.path, redir, sizeof(req.path) - 1);
        req.path[sizeof(req.path) - 1] = '\0';
        strncpy(req.data, text, sizeof(req.data) - 1);
        req.data[sizeof(req.data) - 1] = '\0';

        kernel_handle_syscall(kernel, &req, &res);
    }
    else if (strcmp(cmd,"ps")==0){
        do_read(kernel,"/proc/ps");
    }
    else if (strcmp(cmd, "ls") == 0) {
    char *path = strtok(NULL, " \n");
    if (!path) path = "/";

    vfs_node_t *node = vfs_find(kernel->vfs_root, path);
    if (!node || node->type != VFS_DIR) {
        printf("not a directory\n");
        return;
    }

    for (int i = 0; i < node->child_count; i++) {
        printf("%s\n", node->children[i]->name);
    }
    printf("\n");
    }
    else if (strcmp(cmd, "mkdir") == 0) {
    char *path = strtok(NULL, " \n");
    if (!path) {
        printf("usage: mkdir <path>\n");
        return;
    }

    syscall_t req = {0};
    syscall_response_t res;

    req.number = SYS_MKDIR;
    req.pid = 1;
    strncpy(req.path, path, sizeof(req.path) - 1);
    req.path[sizeof(req.path) - 1] = '\0';

    kernel_handle_syscall(kernel, &req, &res);

    if (res.status < 0)
        printf("mkdir failed\n");
    }
    else if (strcmp(cmd,"touch")==0){
        char *path = strtok(NULL," \n");
        if(!path){
            printf("usage touch <path>\n");
            return;
        }
        syscall_t req ={0};
        syscall_response_t res;
        req.number=SYS_TOUCH;
        req.pid =1;
        strncpy(req.path, path, sizeof(req.path) - 1);
        req.path[sizeof(req.path) - 1] = '\0';
        kernel_handle_syscall(kernel,&req,&res);
    }
    else {
    syscall_t req = {0};
    syscall_response_t res;

    req.number = SYS_WRITE;
    req.pid = 1;
    strncpy(req.path, "/ai/input", sizeof(req.path) - 1);
    req.path[sizeof(req.path) - 1] = '\0';
    strncpy(req.data, cmd, sizeof(req.data) - 1);
    req.data[sizeof(req.data) - 1] = '\0';

    kernel_handle_syscall(kernel, &req, &res);

    }
}


int main() {
    kernel_state_t kernel;
    kernel_init(&kernel);

    char line[256];

    while (1) {
        printf("RuneOS> ");
        fflush(stdout);

        if (!fgets(line, sizeof(line), stdin))
            break;

        run_command(&kernel, line);
    }


return 0;

    
}
