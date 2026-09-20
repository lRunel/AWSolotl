#ifndef VFS_H
#define VFS_H

#include <stddef.h>

typedef enum {
    VFS_DIR,
    VFS_FILE
} vfs_node_type_t;
typedef enum {
    OWNER_SYSTEM,
    OWNER_USER
} owner_t;

struct vfs_node;

typedef int (*vfs_read_fn)(struct vfs_node *node, char *buffer, size_t size);
typedef int (*vfs_write_fn)(struct vfs_node *node, const char *data);



typedef struct vfs_node {
    const char *name;
    vfs_node_type_t type;

    struct vfs_node **children;
    int child_count;
    vfs_read_fn read;
    vfs_write_fn write;
    void *data;
    owner_t owner;
} vfs_node_t;
vfs_node_t *vfs_parent_dir(vfs_node_t *root, const char *path, char *name);
int vfs_mkdir(vfs_node_t *root, const char *path);
int vfs_touch(vfs_node_t *root, const char *path);
int vfs_ls(vfs_node_t *root,const char *path,char *buffer,size_t size);
vfs_node_t *vfs_find(vfs_node_t *root, const char *path);
vfs_node_t *vfs_init(void);

#endif
