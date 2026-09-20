#include <stdio.h>
#include <stdlib.h>
#include "vfs.h"
#include "kernel.h"
#include "errno.h"
#include <string.h>
#define MAX_DIR_CHILDREN 16
#define MAX_VFS_NODES 64

static vfs_node_t vfs_nodes[MAX_VFS_NODES];
static int vfs_node_count = 0;
extern kernel_state_t *g_kernel;
vfs_node_t *vfs_parent_dir(vfs_node_t *root, const char *path, char *name) {
    char temp[64];
    strcpy(temp, path);

    char *last = strrchr(temp, '/');
    if (!last || last == temp) return NULL;

    strcpy(name, last + 1);
    *last = 0;

    return vfs_find(root, temp);
}


static vfs_node_t *vfs_alloc_node(void) {
    if (vfs_node_count >= MAX_VFS_NODES)
        return NULL;
    return &vfs_nodes[vfs_node_count++];
}

static vfs_node_t *vfs_lookup(vfs_node_t *dir, const char *name) {
    if (dir->type != VFS_DIR) return NULL;

    for (int i = 0; i < dir->child_count; i++) {
        if (strcmp(dir->children[i]->name, name) == 0) {
            return dir->children[i];
        }
    }
    return NULL;
}
static int ai_input_write(vfs_node_t *node, const char *data) {
    printf("[ai] received: %s\n", data);
    return 0;
}

vfs_node_t *vfs_find(vfs_node_t *root, const char *path) {
    if (!path || path[0] != '/') return NULL;

    if (strcmp(path, "/") == 0) return root;

    char temp[64];
    strcpy(temp, path);

    char *token = strtok(temp, "/");
    vfs_node_t *current = root;

    while (token) {
        current = vfs_lookup(current, token);
        if (!current) return NULL;
        token = strtok(NULL, "/");
    }

    return current;
}
int vfs_ls(vfs_node_t *root, const char *path,
           char *buffer, size_t size)
{
    vfs_node_t *node = vfs_find(root, path);

    if (!node || node->type != VFS_DIR) {
        return snprintf(buffer, size, "not a directory\n");
    }

    int offset = 0;

    for (int i = 0; i < node->child_count; i++) {
        offset += snprintf(
            buffer + offset,
            size - offset,
            "%s\n",
            node->children[i]->name
        );
    }

    return offset;
}

int vfs_mkdir(vfs_node_t *root, const char *path){
    char name[32];

    vfs_node_t *parent = vfs_parent_dir(root, path, name);
    if (!parent || parent->type != VFS_DIR)
        return E_NOTDIR;

    if (vfs_lookup(parent, name))
        return E_EXIST;

    if (parent->child_count >= MAX_DIR_CHILDREN)
        return E_NOSPC;

    int cost = strlen(name) + 1;
    if (g_kernel->memory.used_bytes + cost > g_kernel->memory.max_bytes)
        return E_NOMEM;

    vfs_node_t *node = vfs_alloc_node();
    if (!node)
        return E_NOSPC;

    static vfs_node_t *children_pool[MAX_VFS_NODES][MAX_DIR_CHILDREN];
    static int children_pool_idx = 0;

    if (children_pool_idx >= MAX_VFS_NODES) return E_NOSPC;

    node->name = strdup(name);
    node->type = VFS_DIR;
    node->children = children_pool[children_pool_idx++];
    node->child_count = 0;
    node->owner = OWNER_USER;
    
    g_kernel->memory.used_bytes += cost;
    parent->children[parent->child_count++] = node;
    return E_OK;
}


static const char *state_name(process_state_t s) {
    switch (s) {
        case PROC_RUNNING:      return "RUNNING";
        case PROC_DEAD:         return "DEAD";
        case PROC_INITIALIZING: return "INITIALIZING";
        default:                return "UNKNOWN";
    }
}

static int proc_ps_read(vfs_node_t *node, char *buffer, size_t size) {
    int offset = 0;

    offset += snprintf(buffer + offset, size - offset,
                       "PID\tNAME\t\tSTATE\n");

    for (int i = 0; i < MAX_PROCESSES; i++) {
        process_t *p = &g_kernel->process_table[i];
        if (p->state != PROC_UNUSED) {
            offset += snprintf(buffer + offset, size - offset,
                               "%d\t%-12s\t%s\n",
                               p->pid,
                               p->name,
                               state_name(p->state));
        }
    }

    return offset;
}
static int kernel_state_read(vfs_node_t *node, char *buffer, size_t size) {
    int free_mem =
        g_kernel->memory.max_bytes -
        g_kernel->memory.used_bytes;

    /* Count active processes */
    int proc_count = 0;
    const char *ai_state = "offline";
    for (int i = 0; i < MAX_PROCESSES; i++) {
        process_t *p = &g_kernel->process_table[i];
        if (p->state == PROC_RUNNING || p->state == PROC_INITIALIZING) {
            proc_count++;
            if (strcmp(p->name, "ai") == 0) {
                ai_state = state_name(p->state);
            }
        }
    }

    return snprintf(buffer, size,
        "running: %d\n"
        "processes: %d\n"
        "memory_used: %d\n"
        "memory_free: %d\n"
        "memory_limit: %d\n"
        "ai: %s\n",
        g_kernel->running,
        proc_count,
        g_kernel->memory.used_bytes,
        free_mem,
        g_kernel->memory.max_bytes,
        ai_state
    );
}
static int read_file(vfs_node_t *node,char *buffer,size_t size)
{   
    const char *text = (const char *)node->data;
    return snprintf(buffer,size,"%s",text);
}

static int write_file(vfs_node_t *node, const char *data) {
    if (node->data) free((void*)node->data);
    node->data = strdup(data);
    return 0;
}
int vfs_touch(vfs_node_t *root, const char *path)
{
    char name[32];

    vfs_node_t *parent = vfs_parent_dir(root, path, name);
    if (!parent || parent->type != VFS_DIR)
        return E_NOTDIR;

    if (vfs_lookup(parent, name))
        return E_EXIST;

    if (parent->child_count >= MAX_DIR_CHILDREN)
        return E_NOSPC;

    int cost = strlen(name) + 2;
    if (g_kernel->memory.used_bytes + cost > g_kernel->memory.max_bytes)
        return E_NOMEM;

    vfs_node_t *node = vfs_alloc_node();
    if (!node) return E_NOSPC;

    node->type = VFS_FILE;
    node->name = strdup(name);
    node->read = read_file;
    node->write = write_file;   
    node->data = strdup("");
    node->owner = OWNER_USER;

    g_kernel->memory.used_bytes += cost;

    parent->children[parent->child_count++] = node;

    return E_OK;
}
// Removed legacy resume.txt. Resume is now dynamically served via resume.html

/* Forward declarations for project HTML getters */
extern const char *get_project_arecanut_html(void);
extern const char *get_project_gem_html(void);
extern const char *get_project_dlframework_html(void);
extern const char *get_project_arshirt_html(void);
extern const char *get_project_runeos_html(void);

/* Read functions for project files */
static int project_arecanut_read(vfs_node_t *node, char *buffer, size_t size) {
    const char *html = get_project_arecanut_html();
    return snprintf(buffer, size, "%s", html);
}
static int project_gem_read(vfs_node_t *node, char *buffer, size_t size) {
    const char *html = get_project_gem_html();
    return snprintf(buffer, size, "%s", html);
}
static int project_dlframework_read(vfs_node_t *node, char *buffer, size_t size) {
    const char *html = get_project_dlframework_html();
    return snprintf(buffer, size, "%s", html);
}
static int project_arshirt_read(vfs_node_t *node, char *buffer, size_t size) {
    const char *html = get_project_arshirt_html();
    return snprintf(buffer, size, "%s", html);
}
static int project_runeos_read(vfs_node_t *node, char *buffer, size_t size) {
    const char *html = get_project_runeos_html();
    return snprintf(buffer, size, "%s", html);
}

/* VFS file nodes for each project */
static vfs_node_t project_arecanut_file = {
    .name = "arecanut.html",
    .type = VFS_FILE,
    .child_count = 0,
    .children = NULL,
    .read = project_arecanut_read,
    .write = NULL,
    .owner = OWNER_SYSTEM
};
static vfs_node_t project_gem_file = {
    .name = "gem.html",
    .type = VFS_FILE,
    .child_count = 0,
    .children = NULL,
    .read = project_gem_read,
    .write = NULL,
    .owner = OWNER_SYSTEM
};
static vfs_node_t project_dlframework_file = {
    .name = "dlframework.html",
    .type = VFS_FILE,
    .child_count = 0,
    .children = NULL,
    .read = project_dlframework_read,
    .write = NULL,
    .owner = OWNER_SYSTEM
};
static vfs_node_t project_arshirt_file = {
    .name = "arshirt.html",
    .type = VFS_FILE,
    .child_count = 0,
    .children = NULL,
    .read = project_arshirt_read,
    .write = NULL,
    .owner = OWNER_SYSTEM
};
static vfs_node_t project_runeos_file = {
    .name = "runeos.html",
    .type = VFS_FILE,
    .child_count = 0,
    .children = NULL,
    .read = project_runeos_read,
    .write = NULL,
    .owner = OWNER_SYSTEM
};

static vfs_node_t *projects_children[MAX_DIR_CHILDREN] = {
    &project_arecanut_file,
    &project_gem_file,
    &project_dlframework_file,
    &project_arshirt_file,
    &project_runeos_file
};

static vfs_node_t projects_dir={
    .name="projects",
    .type=VFS_DIR,
    .child_count=5,
    .children=projects_children,
    .read=NULL,
    .write=NULL,
    .data=NULL,
    .owner=OWNER_USER
};
extern const char *get_resume_html(void);

static int resume_html_read(vfs_node_t *node, char *buffer, size_t size) {
    const char *html = get_resume_html();
    return snprintf(buffer, size, "%s", html);
}

static vfs_node_t resume_html_file = {
    .name = "resume.html",
    .type = VFS_FILE,
    .child_count = 0,
    .children = NULL,
    .read = resume_html_read,
    .write = NULL,
    .owner = OWNER_SYSTEM
};

static vfs_node_t *home_children[MAX_DIR_CHILDREN]={
    &projects_dir,
    &resume_html_file
};
static vfs_node_t kernel_state_file = {
    .name = "state",
    .type = VFS_FILE,
    .children = NULL,
    .child_count = 0,
    .read = kernel_state_read,
    .data = NULL,
    .owner=OWNER_SYSTEM
};
static vfs_node_t ai_input_file = {
    .name = "input",
    .type = VFS_FILE,
    .children = NULL,
    .child_count = 0,
    .read = NULL,
    .write = ai_input_write,
    .data = NULL,
    .owner = OWNER_SYSTEM
};
static vfs_node_t ai_status_file = {
    .name = "status",
    .type = VFS_FILE,
    .children = NULL,
    .child_count = 0,
    .read = read_file,
    .write = write_file,
    .data = NULL,
    .owner = OWNER_USER
};
static vfs_node_t ai_output_file = {
    .name = "output",
    .type = VFS_FILE,
    .children = NULL,
    .child_count = 0,
    .read = read_file,
    .write = write_file,
    .data = NULL,
    .owner = OWNER_USER
};

extern const char *get_vectors_json(void);

static int ai_vectors_read(vfs_node_t *node, char *buffer, size_t size) {
    const char *json = get_vectors_json();
    size_t len = strlen(json);
    if (len >= size) {
        strncpy(buffer, json, size - 1);
        buffer[size - 1] = '\0';
        return size - 1;
    }
    strcpy(buffer, json);
    return len;
}

static vfs_node_t ai_vectors_file = {
    .name = "vectors.json",
    .type = VFS_FILE,
    .children = NULL,
    .child_count = 0,
    .read = ai_vectors_read,
    .write = NULL,
    .data = NULL,
    .owner = OWNER_SYSTEM
};
static vfs_node_t *ai_children[MAX_DIR_CHILDREN] = {
    &ai_input_file,
    &ai_status_file,
    &ai_output_file,
    &ai_vectors_file
};
static vfs_node_t *kernel_children[MAX_DIR_CHILDREN] = {
    &kernel_state_file
};


static vfs_node_t proc_ps;

static vfs_node_t *proc_children[MAX_DIR_CHILDREN] = {
    &proc_ps
};

static vfs_node_t proc_dir = {
    .name = "proc",
    .type = VFS_DIR,
    .children = proc_children,
    .child_count = 1,
    .read = NULL,
    .data = NULL,
    .owner=OWNER_SYSTEM
};

static vfs_node_t kernel_dir = {
    .name = "kernel",
    .type = VFS_DIR,
    .children = kernel_children,
    .child_count = 1,
    .read = NULL,
    .data = NULL,
    .owner=OWNER_SYSTEM
};

static vfs_node_t ai_dir = {
    .name = "ai",
    .type = VFS_DIR,
    .children = ai_children,
    .child_count = 4,
    .read = NULL,
    .data = NULL,
    .owner = OWNER_SYSTEM
};
static vfs_node_t home_dir={
    .name="home",
    .type=VFS_DIR,
    .children=home_children,
    .child_count=2,
    .read=NULL,
    .write=NULL,
    .data=NULL,
    .owner=OWNER_USER
};
static vfs_node_t *root_children[MAX_DIR_CHILDREN] = {
    &proc_dir,
    &kernel_dir,
    &ai_dir,
    &home_dir
};

static vfs_node_t root = {
    .name = "/",
    .type = VFS_DIR,
    .children = root_children,
    .child_count = 4,
    .read = NULL,
    .data = NULL,
    .owner=OWNER_SYSTEM
};

static vfs_node_t proc_ps = {
    .name = "ps",
    .type = VFS_FILE,
    .children = NULL,
    .child_count = 0,
    .read = proc_ps_read,
    .data = NULL,
    .owner=OWNER_SYSTEM
};



vfs_node_t *vfs_init(void) {
    return &root;
}
