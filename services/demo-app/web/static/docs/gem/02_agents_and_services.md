# Agents & Services

Gem relies on decoupled, specialized sub-agents that run continuously in the background, listening for tasks on the blackboard.

## Sub-Agents

1. **Vision Agent (`vision_agent.py`)**
   Manages the webcam using OpenCV. It exposes `capture_and_describe_image` to take a snapshot and pass it to Gemini for visual context.

2. **Voice Agent (`voice_agent.py`)**
   Uses `openWakeWord` to listen for a specific trigger phrase. Once triggered, it uses `faster-whisper` to transcribe audio and bypasses the blackboard to post directly to the user's outbox.

3. **System Agent (`system_agent.py`)**
   Handles OS-level operations, terminal command execution, and local file management.

4. **Web Agent (`web_agent.py`)**
   Conducts web searches, scrapes Wikipedia, and opens URLs.

5. **Knowledge Agent (`knowledge_agent.py`)**
   Interfaces with local storage (SQLite and CSVs) via `knowledge_base.py` and `csv_manager.py` to maintain the agent's long-term memory.

---

## Unfinished Code & Potential Issues

The following vulnerabilities and incomplete features exist within the agents and their underlying services:

> [!CAUTION]
> **Insecure CSV Querying (RCE Risk)**
> The `csv_manager.py` service exposes a `query_data(query: str)` method that executes `df.query(query)`. Because `query()` utilizes `eval()` under the hood, an LLM generating a malicious query string could execute arbitrary code on the host system.

> [!WARNING]
> **Fake Semantic Search in Knowledge Base**
> In `knowledge_base.py`, the `semantic_search()` and `index_memory()` functions are merely stubs left over from a previous LlamaIndex implementation. The "semantic search" currently falls back to a basic SQLite `LIKE '%term%'` keyword query, which completely fails at actual semantic retrieval.

> [!NOTE]
> **Vision Agent Race Conditions**
> `vision_agent.py` hardcodes the image output path to `current_view.jpg`. If multiple visual tasks are requested concurrently, they will overwrite the same file, causing race conditions.

> [!NOTE]
> **Voice Agent Blocking & Hardcoded Sleeps**
> The `record_until_silence()` function is entirely synchronous, freezing the voice agent thread until audio stops. Furthermore, if the listener crashes, the exception handler falls back to a hardcoded `time.sleep(10)`.

> [!TIP]
> **Incomplete Service Methods**
> `csv_manager.py` contains several commented-out helper methods (`get_column_info`, `preview_data`) that the Knowledge Agent cannot currently utilize to understand data schemas.
