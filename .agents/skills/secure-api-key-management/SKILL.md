---
name: secure-api-key-management
description: Securely save all three AI providers' API keys (Gemini, Claude, OpenAI Codex) to the machine using OS-level Windows DPAPI / Credential Vault encryption so keys persist across restarts and are never stored in plaintext browser storage.
---

# Secure API Key Management Skill (`secure-api-key-management`)

## Overview
Manages machine-level persistence for all three cloud AI providers (`gemini`, `claude`, `codex`) separately from Google-account conversational memory.

## Security Architecture
1. **OS-Level Encryption (Windows DPAPI)**:
   - Uses Windows `CryptProtectData` and `CryptUnprotectData` (`crypt32.dll`) bound to the current Windows user context on the machine.
   - Persists encrypted key payloads to `%LOCALAPPDATA%\LuminessAssist\vault\credentials.vault`.
2. **All Three Providers Saved Together**:
   - Whenever an API key is entered or updated for Gemini, Claude, or OpenAI (Codex), all configured keys are persisted immediately to the machine vault via `save_machine_api_keys` and loaded on application startup via `load_machine_api_keys`.
3. **Zero Plaintext Browser Storage**:
   - Plaintext API keys (`GEMINI_API_KEY`, `LUMINESS_CLAUDE_API_KEY`, `LUMINESS_CODEX_API_KEY`) are migrated out of `localStorage` into the machine vault and scrubbed from `localStorage`.
   - Error logs and UI previews sanitize all keys via `sanitizeErrorMessage`.
