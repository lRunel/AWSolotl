# Gem AI: Documentation Preamble

Welcome to the documentation for **Gem AI**, a powerful, locally-run, multi-agent AI assistant designed for the terminal.

## Philosophy

Gem AI abandons traditional monolithic LLM frameworks (like LlamaIndex) in favor of a resilient **Blackboard Architecture**. It operates as a highly decoupled, multi-process system where specialized agents communicate via lightweight Markdown files.

Currently, the primary Supervisor adopts the persona of **"Brog"**, a caveman who views modern technology as magic. Brog provides a unique, engaging conversational experience while orchestrating complex, system-level tasks in the background.

## How to Read These Docs

This documentation has been modularized to help you understand specific segments of the project, while critically highlighting areas that need future development.

1. **[Architecture & Core](01_architecture_and_core.md):** Learn about `main.py` and the Supervisor Agent.
2. **[Agents & Services](02_agents_and_services.md):** Deep dive into the specialized background agents (Vision, Voice, Web, System, Knowledge).
3. **[Communications & IPC](03_communications_and_ipc.md):** Understand the JSON-over-Markdown Inter-Process Communication logic.
4. **[Hardware Setup & Customization](04_hardware_and_setup.md):** Learn how to configure your microphone, webcam, and load custom openWakeWord models.

> [!NOTE]
> Every document contains an **Unfinished Code & Potential Issues** section. These sections are intended for developers to understand the current limitations, technical debt, and potential security vulnerabilities within the Gem AI codebase.
