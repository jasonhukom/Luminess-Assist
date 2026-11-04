---
name: local-ai-runtime
description: Investigate and operate local AI model servers (Ollama, llama.cpp, LM Studio, OpenAI-compatible local endpoints, OpenCode CLI), perform hardware compatibility checks, model discovery, connection testing, and local conversational inference.
---

# Local AI Runtime Skill (`local-ai-runtime`)

## Overview
Provides end-to-end local AI inference for Luminess Assist without requiring paid cloud API keys.

## Supported Runtimes & Discovery Order
1. **Ollama (`http://127.0.0.1:11434`)**:
   - Probes `/api/tags` and `/v1/models` to discover installed local models (e.g. `qwen2.5-coder`, `llama3.2`, `mistral`, `gemma2`, `phi3`).
   - Uses `/v1/chat/completions` (OpenAI-compatible API) or `/api/chat` for conversational inference and tool calling.
2. **OpenAI-Compatible Local Servers (`llama.cpp` at `:8080`, LM Studio at `:1234`, LocalAI)**:
   - Probes `/v1/models` and executes chat completions via `/v1/chat/completions`.
3. **OpenCode CLI (`opencode run --auto`)**:
   - Invokes OpenCode v2 CLI without deprecated flags (`--pure` must never be used) and with safe working directory isolation.
4. **Built-in Local Conversational Engine**:
   - Ensures local AI always responds intelligently even when no external model server daemon is currently running, with full access to PC tools, persistent user memory, and web search.

## Hardware Compatibility Checks
- Inspects system RAM, CPU logical cores, GPU adapter, and free disk space via Rust `check_local_ai_hardware` to recommend optimal model sizes (e.g., 1.5B–3B for <8 GB RAM, 7B–8B for 16 GB RAM, 14B–32B for 32+ GB RAM).
