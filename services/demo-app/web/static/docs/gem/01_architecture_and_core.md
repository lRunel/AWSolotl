# Architecture & Core

The core of Gem AI consists of two primary components: the terminal entrypoint (`main.py`) and the orchestration engine (`supervisor.py`).

## 1. The Entrypoint (`main.py`)

`main.py` is the user-facing command-line interface. When launched, it:
1. Empties the user inbox/outbox markdown files to start fresh.
2. Uses `subprocess.Popen` to asynchronously spawn all background agents.
3. Starts a daemon thread (`listen_to_supervisor`) to print incoming Supervisor messages to the terminal.
4. Enters a synchronous `while True` loop to capture user text input.

## 2. The Supervisor Agent (`supervisor.py`)

The Supervisor (currently powered by Gemini 2.5 Flash) acts as the brain. 
- It constantly polls `user_to_supervisor.md` for new user input.
- Rather than executing tasks directly, it creates "proxy tools" using `create_blackboard_proxy`. 
- When the LLM decides to use a tool, the proxy function posts a JSON task request to `blackboard.md` and waits for a sub-agent to fulfill it.

---

## Unfinished Code & Potential Issues

The following are known architectural limitations and bugs that require refactoring:

> [!WARNING]
> **Infinite Blocking Loops in Supervisor**
> The `create_blackboard_proxy` function uses `time.sleep(0.5)` in a `while True` loop to wait for a `TaskResult`. If an assigned sub-agent crashes, or if the LLM hallucinates an assignee, the Supervisor will block indefinitely and stop responding to the user.

> [!WARNING]
> **State Bleed on Restart**
> While `main.py` empties `user_to_supervisor.md` and `supervisor_to_user.md` upon startup, it **fails to clear `blackboard.md`**. This causes sub-agents to re-process old, stale tasks immediately upon restarting the application.

> [!CAUTION]
> **Zombie Sub-Processes**
> `main.py` terminates agents in its `finally` block using `.terminate()`. If an agent (like the System Agent) has spawned its own child processes (e.g., executing a bash script), those children will become orphaned zombie processes.

> [!NOTE]
> **Terminal UI Thread-Safety**
> The daemon thread `listen_to_supervisor` in `main.py` prints directly to `stdout`. If the user is in the middle of typing a prompt (`> `) when an asynchronous message arrives, the terminal input line will become visually mangled.
