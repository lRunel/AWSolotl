#include <stdio.h>
#include <string.h>
#include "kernel.h"
#include "vfs.h"
#include "errno.h"

kernel_state_t *g_kernel;

static int is_system_pid(int pid)
{

    return pid == 1;

}

static void normalize_path(const char *cwd, const char *input, char *out) 
{

    if (!input || input[0] == '\0') 
    {
    
        strcpy(out, cwd ? cwd : "/");
        return;
    
    }

    char temp[256];
    if (input[0] == '/')
    {
        strncpy(temp, input, 255);
    } else 
    {
        if (!cwd || strcmp(cwd, "/") == 0)
            snprintf(temp, 255, "/%s", input);
        else
            snprintf(temp, 255, "%s/%s", cwd, input);
    }
    temp[255] = '\0';
    
    char *stack[32];
    int top = 0;
    
    char *token = strtok(temp, "/");
    while (token) {
        if (strcmp(token, ".") == 0) {
            // ignore
        } else if (strcmp(token, "..") == 0) {
            if (top > 0) top--;
        } else if (strlen(token) > 0) {
            stack[top++] = token;
        }
        token = strtok(NULL, "/");
    }
    
    out[0] = '/';
    out[1] = '\0';
    for (int i = 0; i < top; i++) {
        strcat(out, stack[i]);
        if (i < top - 1) strcat(out, "/");
    }
}

static int check_write_permission(vfs_node_t *node, int pid)
{
    if (node->owner == OWNER_SYSTEM && !is_system_pid(pid))
        return -1;
    return 0;
}

static void init_process_table(kernel_state_t *kernel) {
    for (int i = 0; i < MAX_PROCESSES; i++) {
        kernel->process_table[i].pid = -1;
        kernel->process_table[i].state = PROC_UNUSED;
    }

    kernel->process_table[0].pid = 1;
    kernel->process_table[0].state = PROC_RUNNING;
    strcpy(kernel->process_table[0].name, "system");
    strcpy(kernel->process_table[0].cwd, "/");
    kernel->current_index = 0;
}


void kernel_init(kernel_state_t *kernel) {
    kernel->running = 1;
    init_process_table(kernel);
    kernel->vfs_root = vfs_init();
    g_kernel = kernel;
    kernel->memory.used_bytes = 0;
    kernel->memory.max_bytes = 65536;   

    printf("[kernel] boot complete\n");
}


static int allocate_pid(void) {
    static int next_pid = 2;
    if (next_pid >= 32768) return -1;
    return next_pid++;
}

static process_t *find_process(kernel_state_t *kernel, int pid) {
    for (int i = 0; i < MAX_PROCESSES; i++) {
        process_t *p = &kernel->process_table[i];
        if (p->pid == pid && (p->state == PROC_RUNNING || p->state == PROC_INITIALIZING)) return p;
    }
    return NULL;
}

static process_t *find_free_slot(kernel_state_t *kernel) {
    for (int i = 0; i < MAX_PROCESSES; i++) {
        if (kernel->process_table[i].state == PROC_UNUSED)
            return &kernel->process_table[i];
    }
    return NULL;
}



static int spawn_process(kernel_state_t *kernel) {
    process_t *slot = find_free_slot(kernel);
    if (!slot) return -1;

    int pid = allocate_pid();
    if (pid < 0) return -1;

    slot->pid = pid;
    slot->state = PROC_RUNNING;
    return pid;
}

static int exit_process(kernel_state_t *kernel, int pid) {
    if (pid == 1) return -1;

    for (int i = 0; i < MAX_PROCESSES; i++) {
        process_t *p = &kernel->process_table[i];
        if (p->pid == pid && p->state == PROC_RUNNING) {
            p->state = PROC_DEAD;
            return 0;
        }
    }
    return -1;
}

static int reap_process(kernel_state_t *kernel, int pid) {
    for (int i = 0; i < MAX_PROCESSES; i++) {
        process_t *p = &kernel->process_table[i];
        if (p->pid == pid && p->state == PROC_DEAD) {
            p->pid = -1;
            p->state = PROC_UNUSED;
            return 0;
        }
    }
    return -1;
}

static void schedule_next(kernel_state_t *kernel) {
    int start = kernel->current_index;

    for (int i = 1; i <= MAX_PROCESSES; i++) {
        int idx = (start + i) % MAX_PROCESSES;
        if (kernel->process_table[idx].state == PROC_RUNNING) {
            kernel->current_index = idx;
            return;
        }
    }
}



void kernel_handle_syscall(
    kernel_state_t *kernel,
    const syscall_t *request,
    syscall_response_t *response
) {
    memset(response->data, 0, sizeof(response->data));

    if (!kernel->running) {
        response->status = E_INVAL;
        strcpy(response->data, "kernel not running");
        return;
    }

    process_t *caller = find_process(kernel, request->pid);

    if (request->number != SYS_READ) {
        if (!caller) {
            response->status = E_NOPROC;
            strcpy(response->data, "invalid or dead process");
            return;
        }
    }

    char absolute_path[256];
    if (caller) {
        normalize_path(caller->cwd, request->path, absolute_path);
    } else {
        normalize_path("/", request->path, absolute_path);
    }

    switch (request->number) {

        case SYS_PING:
            response->status = 0;
            strcpy(response->data, "pong");
            break;

        case SYS_SPAWN: {
            int pid = spawn_process(kernel);
            if (pid < 0) {
                response->status = E_NOSPC;
                strcpy(response->data, "spawn failed");
            } else {
                response->status = pid;
                process_t *p = find_process(kernel, pid);
                if (p) {
                    strncpy(p->name, request->data, 31);
                    p->name[31] = '\0';
                    strcpy(p->cwd, "/home");
                }
            }
            break;
        }

        case SYS_EXIT:
            response->status = exit_process(kernel, request->pid);
            break;

        case SYS_REAP:
            if (request->pid != 1) {
                response->status = E_PERM;
                strcpy(response->data, "permission denied");
            } else {
                response->status = reap_process(kernel, request->arg);
            }
            break;

        case SYS_READ: {
            vfs_node_t *node = vfs_find(kernel->vfs_root, absolute_path);
            if (!node || node->type != VFS_FILE || !node->read) {
                response->status = E_NOENT;
                strcpy(response->data, "file not found");
            } else {
                int n = node->read(node, response->data, sizeof(response->data));
                response->data[n]=0;
                response->status = 0;
            }
            break;
        }
        case SYS_WRITE: {
            vfs_node_t *node = vfs_find(kernel->vfs_root, absolute_path);

            if (!node || node->type != VFS_FILE || !node->write) {
                response->status = E_PERM;
                strcpy(response->data, "file not writable");
                break;
            }

            if (check_write_permission(node, request->pid) < 0) {
                response->status = E_PERM;
                strcpy(response->data, "permission denied");
                break;
            }

            node->write(node, request->data);
            response->status = 0;
            break;
            }

        case SYS_MKDIR:
            char name[32];
            vfs_node_t *parent = vfs_parent_dir(kernel->vfs_root, absolute_path, name);
            if (!parent || parent->type != VFS_DIR) {
                response->status = E_NOTDIR;
                break;
            }

            if (check_write_permission(parent, request->pid) < 0) {
                response->status = E_PERM;
                strcpy(response->data, "permission denied");
                break;
            }

            response->status = vfs_mkdir(kernel->vfs_root, absolute_path);
            if (response->status < 0)
                strcpy(response->data, "mkdir failed");
            break;
        case SYS_LS:
            response->status = 0;
            vfs_ls(kernel->vfs_root,
                absolute_path,
                response->data,
                sizeof(response->data));
             break;
        case SYS_TOUCH: {
            char name2[32];
            vfs_node_t *parent2 = vfs_parent_dir(kernel->vfs_root, absolute_path, name2);

            if (!parent2 || parent2->type != VFS_DIR) {
                response->status = E_NOTDIR;
                break;
            }

            if (check_write_permission(parent2, request->pid) < 0) {
                response->status = E_PERM;
                strcpy(response->data, "permission denied");
                break;
            }

            int rc = vfs_touch(kernel->vfs_root, absolute_path);

            if (rc < 0) {
                response->status = -1;
                strcpy(response->data, "touch failed");
            } else {
                response->status = 0;
                strcpy(response->data, "file created");
            }
            break;
        }
        case SYS_CHDIR: {
            vfs_node_t *node = vfs_find(kernel->vfs_root, absolute_path);
            if (!node || node->type != VFS_DIR) {
                response->status = E_NOTDIR;
                strcpy(response->data, "not a directory");
            } else {
                if (caller) {
                    strncpy(caller->cwd, absolute_path, 63);
                    caller->cwd[63] = '\0';
                    response->status = E_OK;
                } else {
                    response->status = E_NOPROC;
                }
            }
            break;
        }
        case SYS_GETCWD: {
            if (caller) {
                strcpy(response->data, caller->cwd);
                response->status = 0;
            } else {
                response->status = E_NOPROC;
            }
            break;
        }


        case SYS_SETSTATE: {
            int target_pid = request->arg;
            int new_state = 0;
            if (strcmp(request->data, "running") == 0) new_state = PROC_RUNNING;
            else if (strcmp(request->data, "initializing") == 0) new_state = PROC_INITIALIZING;
            else {
                response->status = E_INVAL;
                strcpy(response->data, "invalid state");
                break;
            }

            /* Find target process (any active state) */
            process_t *target = NULL;
            for (int i = 0; i < MAX_PROCESSES; i++) {
                process_t *p = &kernel->process_table[i];
                if (p->pid == target_pid && p->state != PROC_UNUSED && p->state != PROC_DEAD) {
                    target = p;
                    break;
                }
            }

            if (!target) {
                response->status = E_NOPROC;
                strcpy(response->data, "no such process");
            } else {
                target->state = new_state;
                response->status = 0;
                snprintf(response->data, sizeof(response->data), "pid %d state changed", target_pid);
            }
            break;
        }

        default:
            response->status = E_INVAL;
            strcpy(response->data, "invalid syscall");
            break;
    }

    schedule_next(kernel);
}
