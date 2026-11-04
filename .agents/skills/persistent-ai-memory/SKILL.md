---
name: persistent-ai-memory
description: Save conversations, extracted user profile facts, and preferences in the database, associate them with authenticated Google accounts, retrieve relevant memories during future conversations, and provide memory management.
---

# Persistent AI Memory Skill (`persistent-ai-memory`)

## Overview
Maintains conversational memory so Luminess remembers who the user is, their preferences, facts they share, and past discussions—without turning the companion into an orchestrator.

## Memory Architecture
1. **Automatic User Fact Extraction & `remember_user_fact` Tool**:
   - Extracts facts when the user introduces themselves, states preferences, or shares personal/project context (e.g., "My name is...", "I prefer...", "I am working on..."), and allows the AI to explicitly save facts via the `remember_user_fact` tool.
2. **Google Account Association & Synchronization**:
   - Memories and conversations are tagged with the active Google account email (or `'local_user'` when unsigned) and synchronized with both the local machine database (`%LOCALAPPDATA%\LuminessAssist\database.json`) and cloud account storage when authenticated.
3. **Contextual Retrieval**:
   - Before each AI turn (across Gemini, Claude, OpenAI, and Local AI), relevant user facts and recent conversation summaries are injected into the system prompt so the assistant naturally remembers who the user is.
4. **Privacy Controls**:
   - Users can inspect, search, export, or delete individual memories or wipe all stored history from the floating History and Settings panels.
