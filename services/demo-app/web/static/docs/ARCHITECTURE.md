# RuneOS — Architecture Deep Dive

This document provides a comprehensive technical overview of the RuneOS system architecture for developers, reviewers, and technical stakeholders.

---

## Table of Contents

- [System Overview](#system-overview)
- [Kernel Layer](#kernel-layer)
  - [Initialization](#initialization)
  - [Syscall Dispatch](#syscall-dispatch)
  - [Process Management](#process-management)
  - [Virtual Filesystem](#virtual-filesystem)
  - [Memory Model](#memory-model)
  - [WASM Export Layer](#wasm-export-layer)
- [JavaScript Application Layer](#javascript-application-layer)
  - [Boot Sequence](#boot-sequence)
  - [Module Architecture](#module-architecture)
  - [Window Management](#window-management)
  - [Application Rendering](#application-rendering)
- [Presentation Layer](#presentation-layer)
  - [Design System](#design-system)
  - [Responsive Strategy](#responsive-strategy)
  - [Animations](#animations)
- [Data Flow](#data-flow)
- [Build Pipeline](#build-pipeline)
- [Security Considerations](#security-considerations)

---

## System Overview

RuneOS is implemented as a three-layer stack:

```
┌─────────────────────────────────────┐
│       Presentation (HTML/CSS)       │  Static markup, design tokens, responsive rules
├─────────────────────────────────────┤
│       Application (JavaScript)      │  Boot, window management, app lifecycle
├─────────────────────────────────────┤
│       Kernel (C → WebAssembly)      │  Syscalls, VFS, processes, scheduling
└─────────────────────────────────────┘
```

All layers run entirely client-side. There is no server component, no API calls, and no external runtime dependencies.

---

## Kernel Layer

### Initialization

`kernel_init()` performs the following in order:

1. Sets `running = 1`
2. Initializes the 32-slot process table (all `PROC_UNUSED`)
3. Creates PID 1 (init) as the first `PROC_RUNNING` entry
4. Calls `vfs_init()` to build the root filesystem tree
5. Sets the global kernel pointer (`g_kernel`)
6. Initializes the memory tracker (0 / 65536 bytes)

### Syscall Dispatch

All kernel operations pass through `kernel_handle_syscall()`, which:

1. Validates the kernel is running
2. For non-`SYS_READ` calls, verifies the requesting PID exists and is `RUNNING`
3. Dispatches to the appropriate handler via `switch(request->number)`
4. Invokes `schedule_next()` after every syscall (round-robin tick)

**Syscall Request Format:**
```c
typedef struct {
    int pid;                  // Requesting process
    int arg;                  // Generic argument (e.g., target PID for reap)
    syscall_number_t number;  // Syscall identifier
    char path[64];            // Filesystem path
    char data[256];           // Payload data
} syscall_t;
```

**Syscall Response Format:**
```c
typedef struct {
    int status;       // 0 = success, negative = error
    char data[512];   // Output data or error message
} syscall_response_t;
```

### Process Management

| Function | Description |
|---|---|
| `allocate_pid()` | Sequential PID allocation starting from 2, max 32767 |
| `find_process()` | Linear scan of process table for matching PID + `RUNNING` state |
| `find_free_slot()` | Linear scan for first `UNUSED` slot |
| `spawn_process()` | Claims a free slot, assigns a new PID |
| `exit_process()` | Transitions process from `RUNNING` → `DEAD` (PID 1 protected) |
| `reap_process()` | Transitions process from `DEAD` → `UNUSED` (reclaims slot) |
| `schedule_next()` | Round-robin: scans from current index for next `RUNNING` process |

**State Machine:**
```
UNUSED ──spawn──→ RUNNING ──exit──→ DEAD ──reap──→ UNUSED
                     ↑                                │
                     └────────────────────────────────┘
```

### Virtual Filesystem

The VFS is a static tree of `vfs_node_t` structs, allocated from a fixed pool of 64 nodes.

**Node Structure:**
```c
typedef struct vfs_node {
    const char *name;
    vfs_node_type_t type;      // VFS_DIR or VFS_FILE
    struct vfs_node **children;
    int child_count;
    vfs_read_fn read;          // int (*)(node, buffer, size)
    vfs_write_fn write;        // int (*)(node, data)
    void *data;                // Opaque payload
    owner_t owner;             // OWNER_SYSTEM or OWNER_USER
} vfs_node_t;
```

**Key Design Patterns:**

1. **Polymorphic I/O** — Each file node can have custom `read`/`write` function pointers. The `/proc/ps` node dynamically generates process listings; `/kernel/state` computes live kernel metrics.

2. **Ownership Model** — Nodes are tagged as `OWNER_SYSTEM` or `OWNER_USER`. Write operations to system-owned nodes are rejected for non-init processes.

3. **Path Resolution** — `vfs_find()` tokenizes paths by `/` and walks the tree via `vfs_lookup()` at each level.

4. **Static + Dynamic Nodes** — The initial tree (`/`, `/proc`, `/kernel`, `/ai`, `/home`) is statically allocated. User operations (`mkdir`, `touch`) allocate from the dynamic `vfs_nodes[]` pool.

**Core VFS Operations:**

| Function | Description |
|---|---|
| `vfs_find(root, path)` | Resolve absolute path to node pointer |
| `vfs_lookup(dir, name)` | Find child by name within a directory |
| `vfs_ls(root, path, buf, size)` | List directory contents into buffer |
| `vfs_mkdir(root, path)` | Create directory (allocates node, links to parent) |
| `vfs_touch(root, path)` | Create empty file with read-only semantics |
| `vfs_parent_dir(root, path, &name)` | Split path into parent directory + basename |

### Memory Model

The kernel tracks a virtual memory budget:

- **Total:** 65,536 bytes (64 KB)
- **Tracking:** Every `mkdir` and `touch` operation charges `strlen(name) + 1` bytes
- **Reporting:** Exposed via `/kernel/state` read — consumed by the system status widget

This is a simulated memory model for demonstration — actual WASM memory uses Emscripten's `ALLOW_MEMORY_GROWTH`.

### WASM Export Layer

`kernel_wasm.c` serves as the Emscripten bridge:

1. **Global Kernel** — Single static `kernel_state_t` instance
2. **Output Capture** — Commands write to a 4 KB buffer via `buf_printf()` instead of stdout
3. **Exported Functions:**
   - `wasm_kernel_init()` → initialize kernel state
   - `wasm_run_command(input)` → parse + execute, return output string pointer
   - `wasm_get_resume_html()` → return embedded HTML resume from `resume.c`

**Output Lifecycle:**

```
JS: kernelRunCommand("ls /")
  → Emscripten cwrap → wasm_run_command("ls /")
    → buf_reset()
    → wasm_run_command_internal()
      → strtok parse → dispatch to handler
      → buf_printf() writes to output_buf[]
    → Trim trailing newline
    → Return output_buf pointer
  → Emscripten UTF8ToString → JS string
```

---

## JavaScript Application Layer

### Boot Sequence

```
1. DOM ContentLoaded
   └── Bind dock click handlers
   └── Bind mobile grid handlers
   └── Bind workspace event delegation (file icon clicks)
   └── Call System.boot()

2. System.boot()
   └── Show boot-screen with progress animation
   └── KernelModule().then(mod => ...)
       └── cwrap() exported functions
       └── Call wasm_kernel_init()
       └── Continue boot animation
       └── Fade out boot screen
       └── System.booted = true
       └── System.startLoops()
           └── Clock update interval (1 second)
           └── Kernel state polling (3 seconds)
           └── Mobile battery/network status (60 seconds)
       └── Auto-launch Terminal (500ms delay)
```

If WASM loading fails, the boot sequence logs a warning and continues without kernel functionality.

### Module Architecture

| Module | Singleton | Dependencies | Responsibilities |
|---|---|---|---|
| `System` | ✓ | None | Boot, timers, kernel polling |
| `WindowManager` | ✓ | `AppManager` | Mouse events, window positioning |
| `AppManager` | ✓ | `System`, `WindowManager`, `kernelRunCommand` | App lifecycle, rendering, focus |

**Communication Pattern:**
- `main.js` → `AppManager.launch()` (user interactions)
- `AppManager` → `WindowManager.startDrag()` / `toggleMaximize()` / `toggleMinimize()` (window operations)
- `AppManager` → `kernelRunCommand()` (kernel queries from Terminal, Settings)
- `System` → `kernelRunCommand()` (status polling)
- `System` → `AppManager.launch('terminal')` (auto-launch after boot)

### Window Management

**Dragging** (desktop only):
- Initiated on `mousedown` on `.win-header`
- Canceled if target is a button or back-button
- Constrained: `top >= 32px` (below top bar), `top <= viewport - 32px`
- Uses `mousemove`/`mouseup` listeners on `window` for smooth tracking

**Maximize/Restore:**
- Stores previous `left`, `top`, `width`, `height` on the element
- Toggles `.maximized` class (CSS handles `100% × 100%`, no border-radius)
- Updates window control icon: `check_box_outline_blank` ↔ `filter_none`

**Z-Index Management:**
- Global counter on `System.zIndex` (starts at 100)
- Every focus event increments and applies — most-recently-clicked window is always on top

### Application Rendering

Each app type has a dedicated render function in `AppManager`:

- **Terminal** — Injects pre-formatted welcome banner, command input with `onkeydown` handler, routes commands through `kernelRunCommand()`, special-cases `clear` and `reboot`
- **Files** — Static HTML icon grid (resume.pdf, resume.txt, projects folder). Click delegation in `main.js` handles sub-launches.
- **Profile** — Hardcoded personal information card with contact links, education, skills tags, and about section
- **Settings** — Queries live kernel state via `cat /kernel/version`, `ps`, and `ls /` — displays in monospace panels
- **Text Viewer** — Reads file content from kernel (`cat /home/{filename}`), renders as monospace pre-formatted
- **HTML Viewer** — Creates iframe. Special `__KERNEL__` source retrieves HTML via `wasm_get_resume_html()`

---

## Presentation Layer

### Design System

CSS custom properties define the visual language:

| Token | Value | Usage |
|---|---|---|
| `--bg-dark` | `#1e1e1e` | Primary background |
| `--bg-header` | `#303030` | Window headers |
| `--bg-window` | `#242424` | Window body |
| `--accent-blue` | `#3584e4` | Files icon, links |
| `--accent-green` | `#33d17a` | Terminal prompt, Profile avatar |
| `--accent-orange` | `#ff7800` | Warning states |
| `--accent-red` | `#e01b24` | Close button hover |
| `--radius-win` | `12px` | Window corners |
| `--radius-icon` | `16px` | App icon corners |

**Typography:**
- **UI Text:** Inter (400, 500, 600)
- **Monospace:** JetBrains Mono (400, 700)
- **Icons:** Material Symbols Rounded

### Responsive Strategy

The desktop and mobile environments are **separate DOM trees**, not responsive variations of the same layout:

- `#desktop-env` — visible at ≥ 769px, hidden at ≤ 768px
- `#mobile-env` — hidden at ≥ 769px, visible at ≤ 768px

This allows fundamentally different interaction paradigms:
- Desktop: floating windows, mouse dragging, dock tooltips
- Mobile: full-screen apps, touch gestures, swipe-back navigation

### Animations

| Animation | Trigger | Properties |
|---|---|---|
| `winOpen` | Window creation (desktop) | Scale 0.95 → 1, opacity 0 → 1, translateY 10px → 0 |
| `mobileWinOpen` | Window creation (mobile) | translateY 100% → 0, opacity 0.5 → 1 |
| `fadeLine` | Boot log lines | opacity 0 → 1 |
| Close animation | Window close | scale → 0.92, opacity → 0 (JS-driven, 200ms) |
| Dock hover | Mouse hover | translateY -8px, scale 1.1 |
| Dock press | Mouse down | translateY -8px, scale 0.95 |
| Boot progress | WASM loading | width 0% → 100% (stepped transitions) |

---

## Data Flow

### Command Execution (Terminal)

```
User types "ls /" + Enter
  │
  ├── JS: input.onkeydown captures Enter
  ├── JS: Echo "rune@os:~$ ls /" to .term-output
  ├── JS: kernelRunCommand("ls /")
  │     └── WASM: wasm_run_command("ls /")
  │           └── C: strtok → "ls" → SYS_LS
  │                 └── vfs_find(root, "/")
  │                 └── Iterate children, buf_printf each name
  │                 └── Return output_buf
  ├── JS: Append result to .term-output
  └── JS: Scroll terminal to bottom
```

### System Status Widget

```
Every 3 seconds:
  System.startLoops() → updateWidget()
    └── kernelRunCommand("cat /kernel/state")
          └── WASM → kernel_state_read()
                └── snprintf: running, processes, current PID,
                    memory_used, memory_free, memory_limit
    └── Display in #sys-widget
```

---

## Build Pipeline

```
kernel/core/*.c + kernel/kernel_wasm.c
        │
        ▼
   Emscripten (emcc)
   Flags: -sMODULARIZE=1, -sEXPORT_NAME=KernelModule,
          -sALLOW_MEMORY_GROWTH=1, --no-entry, -O2
        │
        ├── wasm/kernel.js    (Emscripten glue code, ~12 KB)
        └── wasm/kernel.wasm  (Compiled binary, ~31 KB)
```

**Build Artifacts:**
- `kernel.js` — Emscripten-generated module loader. Exports `KernelModule()` factory function that returns a Promise resolving to the WASM module instance.
- `kernel.wasm` — Compiled WebAssembly binary containing all kernel logic.

**No frontend build step** — HTML, CSS, and JS are served as-is.

---

## Security Considerations

| Area | Approach |
|---|---|
| WASM Sandboxing | All kernel code runs within the WASM sandbox — no access to host filesystem or OS |
| Input Sanitization | `strncpy` used for all path/data copies in WASM layer to prevent buffer overflows |
| Process Isolation | PID validation on every non-read syscall; only PID 1 can reap processes |
| Ownership Model | System-owned VFS nodes reject writes from non-init processes |
| Graceful Fallback | WASM load failure caught and handled — site remains functional |
| No External Requests | Zero network calls post-load — all data is embedded or computed locally |
