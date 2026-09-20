# Communications & IPC

Gem AI uses a unique "JSON-over-Markdown" protocol for Inter-Process Communication (IPC). This removes the need for complex message brokers like Redis or RabbitMQ, relying entirely on local file I/O.

## 1. User ↔ Supervisor

Communication between the user terminal and the Supervisor occurs via simple markdown appending:
- `user_to_supervisor.md`
- `supervisor_to_user.md`

Messages are separated by a standard delimiter (`---`).

## 2. Supervisor ↔ Sub-Agents (The Blackboard)

The system utilizes a shared `blackboard.md` file. 
- The Supervisor posts tasks formatted as JSON blocks.
- Background agents constantly poll this file, looking for `Task` JSON objects where `assignee` matches their name.
- Upon completion, agents append a `TaskResult` JSON object back to the blackboard.

---

## Unfinished Code & Potential Issues

> [!CAUTION]
> **Lack of File Locking**
> The `post_to_blackboard` method in `agents/utils.py` opens and appends to files without utilizing OS-level file locking mechanisms (e.g., `fcntl` or `flock`). Since multiple agents run in parallel, concurrent attempts to post tasks or results *will* eventually cause race conditions, corrupting the JSON blocks and breaking the system.

> [!WARNING]
> **Fragile File Pointers (`f.tell()`)**
> The `read_new_messages` utility tracks read position using `f.tell()` and `f.seek(last_pos)` on text-mode file objects. On certain operating systems, or when encountering multibyte unicode characters, this can lead to pointer misalignment and read errors. It is highly recommended to refactor file reading to open in binary mode (`"rb"`) when relying on byte-offset seeking.
