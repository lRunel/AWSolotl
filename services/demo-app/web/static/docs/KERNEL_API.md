# RuneOS — Kernel API Reference

Complete reference for the RuneOS kernel's exported functions, syscall interface, and VFS operations.

---

## Exported WASM Functions

These functions are callable from JavaScript via Emscripten's `cwrap()`:

### `wasm_kernel_init()`

Initializes the kernel state. Must be called once before any other kernel function.

```javascript
const initFn = module.cwrap('wasm_kernel_init', null, []);
initFn();
```

| Parameter | Type | Description |
|---|---|---|
| _(none)_ | — | — |
| **Returns** | `void` | — |

**Side Effects:** Initializes process table, builds VFS tree, resets memory tracker.

---

### `wasm_run_command(input)`

Executes a shell command and returns the output as a string.

```javascript
const runCmd = module.cwrap('wasm_run_command', 'string', ['string']);
const output = runCmd('ls /home');
```

| Parameter | Type | Description |
|---|---|---|
| `input` | `const char *` | Shell command string (max 255 chars) |
| **Returns** | `const char *` | Command output (valid until next call) |

**Supported Commands:**

| Command | Syntax | Example |
|---|---|---|
| `ls` | `ls [path]` | `ls /home` |
| `cat` | `cat <path>` | `cat /home/resume.txt` |
| `echo` | `echo <text> > <path>` | `echo hello > /home/notes.txt` |
| `mkdir` | `mkdir <path>` | `mkdir /home/projects/new` |
| `touch` | `touch <path>` | `touch /home/test.txt` |
| `ps` | `ps` | Lists all active processes |
| `help` | `help` | Displays available commands |

**Error Handling:** Unknown commands return `bash: <cmd>: command not found`. Invalid paths return descriptive error messages.

---

### `wasm_get_resume_html()`

Returns the full HTML resume content embedded in `core/resume.c`.

```javascript
const getResume = module.cwrap('wasm_get_resume_html', 'string', []);
iframe.srcdoc = getResume();
```

| Parameter | Type | Description |
|---|---|---|
| _(none)_ | — | — |
| **Returns** | `const char *` | Complete HTML document string |

---

## Syscall Interface

### Request Structure

```c
typedef struct {
    int pid;                  // Requesting process ID
    int arg;                  // Generic argument
    syscall_number_t number;  // Syscall identifier
    char path[64];            // Filesystem path (null-terminated)
    char data[256];           // Payload data (null-terminated)
} syscall_t;
```

### Response Structure

```c
typedef struct {
    int status;       // 0 = success, negative = error
    char data[512];   // Output data or error message
} syscall_response_t;
```

### Syscall Reference

---

#### `SYS_PING` (0)

Health check — confirms the kernel is responsive.

| Field | Value |
|---|---|
| **Response status** | `0` |
| **Response data** | `"pong"` |
| **Required PID** | Any valid process |

---

#### `SYS_SPAWN` (1)

Creates a new process in the kernel's process table.

| Field | Value |
|---|---|
| **Response status** | New PID (positive) or `-1` on failure |
| **Failure conditions** | No free process slots, PID exhaustion (> 32767) |
| **Required PID** | Any valid process |

---

#### `SYS_EXIT` (2)

Terminates the specified process (transitions `RUNNING` → `DEAD`).

| Field | Value |
|---|---|
| **Request pid** | PID of process to terminate |
| **Response status** | `0` on success, `-1` on failure |
| **Restrictions** | PID 1 (init) cannot be terminated |

---

#### `SYS_REAP` (3)

Reclaims a dead process slot (transitions `DEAD` → `UNUSED`).

| Field | Value |
|---|---|
| **Request pid** | Must be `1` (only init can reap) |
| **Request arg** | PID of dead process to reap |
| **Response status** | `0` on success, `-1` if not found or not dead |

---

#### `SYS_READ` (4)

Reads content from a VFS file node.

| Field | Value |
|---|---|
| **Request path** | Absolute VFS path (e.g., `/home/resume.txt`) |
| **Response data** | File contents (up to 512 bytes) |
| **Response status** | `0` on success, `-1` if file not found |
| **Note** | Does not require a valid PID |

---

#### `SYS_WRITE` (5)

Writes data to a VFS file node.

| Field | Value |
|---|---|
| **Request pid** | Valid running process |
| **Request path** | Absolute VFS path |
| **Request data** | Content to write |
| **Response status** | `0` on success, `-1` on failure |
| **Restrictions** | Cannot write to system-owned files from non-init processes |

---

#### `SYS_MKDIR` (6)

Creates a new directory in the VFS.

| Field | Value |
|---|---|
| **Request path** | Absolute path for new directory |
| **Response status** | `0` on success, `-1` on failure |
| **Failure conditions** | Parent not found, parent is file, name collision, max children reached, pool exhausted |
| **Side effect** | Charges `strlen(name) + 1` bytes to memory tracker |

---

#### `SYS_LS` (7)

Lists the contents of a directory.

| Field | Value |
|---|---|
| **Request path** | Absolute directory path |
| **Response data** | Newline-separated list of child names |
| **Response status** | `0` on success |

---

#### `SYS_TOUCH` (8)

Creates an empty file in the VFS.

| Field | Value |
|---|---|
| **Request path** | Absolute path for new file |
| **Response status** | `0` on success, `-1` on failure |
| **Side effect** | Charges `strlen(name) + 2` bytes to memory tracker |

---

## VFS API

### Types

```c
typedef enum { VFS_DIR, VFS_FILE } vfs_node_type_t;
typedef enum { OWNER_SYSTEM, OWNER_USER } owner_t;
typedef int (*vfs_read_fn)(struct vfs_node *node, char *buffer, size_t size);
typedef int (*vfs_write_fn)(struct vfs_node *node, const char *data);
```

### Functions

| Function | Signature | Description |
|---|---|---|
| `vfs_init` | `vfs_node_t *vfs_init(void)` | Returns the root node of the initialized tree |
| `vfs_find` | `vfs_node_t *vfs_find(root, path)` | Resolves absolute path to node |
| `vfs_ls` | `int vfs_ls(root, path, buffer, size)` | Lists directory contents |
| `vfs_mkdir` | `int vfs_mkdir(root, path)` | Creates directory |
| `vfs_touch` | `int vfs_touch(root, path)` | Creates empty file |
| `vfs_parent_dir` | `vfs_node_t *vfs_parent_dir(root, path, &name)` | Splits path into parent + basename |

### Constraints

| Constraint | Value |
|---|---|
| Max VFS nodes | 64 |
| Max children per directory | 16 |
| Max path length | 63 characters |
| Max data payload | 255 characters |
| Max output buffer | 511 characters |
