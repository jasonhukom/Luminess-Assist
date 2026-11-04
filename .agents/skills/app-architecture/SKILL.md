---
name: app-architecture
description: Inspect the whole Luminess Assist application, understand the React 19 + Tauri 2 + Rust architecture, identify broken integrations, and plan implementation without unnecessarily rewriting working code.
---

# App Architecture Skill (`app-architecture`)

## Overview
Luminess Assist is a floating Windows desktop AI companion built with:
- **Frontend (`src/`)**: React 19, TypeScript, Vite, Lucide React icons.
  - `src/App.tsx`: Main desktop window orchestrator, robot positioning, provider setup, and floating panels.
  - `src/components/Robot.tsx`: Expressive animated desktop mascot with 11 emotions and physics.
  - `src/components/ChatPanel.tsx`: Conversational chat interface with PC tool permission prompts.
  - `src/components/FloatingHistoryBox.tsx`: Independent draggable conversation history, user memory, and search log box with collision avoidance.
  - `src/components/FloatingSettingsBox.tsx`: Independent draggable settings, provider key vault, local AI runtime, storage quota, and `config.json` editor box with collision avoidance.
- **Native Desktop Runtime (`src-tauri/src/lib.rs`)**: Tauri 2 + Rust with Win32 FFI (`user32`, `dwmapi`, `crypt32`).
  - Handles click-through transparency via `set_interactive_regions`, active window docking, DPAPI machine credential vault, local database & `config.json` quota enforcement, local AI runtime probing, Google OAuth loopback callback server, and native web search.

## Guidelines
1. Always inspect existing code before modifying.
2. Preserve existing working features (Robot physics, 11 emotions, permission prompts, AURA boot screen, keyboard shortcuts).
3. Keep Luminess as a conversational AI companion with tool support and persistent memory—never turn it into a complex multi-agent orchestrator.
4. Follow the repository's Continuous Commit & Push Protocol (`AGENTS.md`).
