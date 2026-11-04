---
name: testing-and-regression
description: Test Google OAuth, AI providers, local AI inference, persistent user memory, database storage quotas, web search, and floating window collision avoidance. Reproduce errors, fix them, and run regression suites.
---

# Testing and Regression Skill (`testing-and-regression`)

## Overview
Verifies that all subsystems of Luminess Assist compile cleanly and pass automated unit and integration tests before claiming completion or packaging binaries.

## Verification Checklist
1. **Unit & Integration Tests (`npm test`)**:
   - Error normalization & secret redaction (`aiErrors.test.ts`).
   - Chat history, persistent user memory extraction/retrieval, search logging, and storage quota enforcement (`chatHistory.test.ts`, `memoryAndStorage.test.ts`).
   - Local AI runtime discovery, hardware compatibility scoring, and offline conversational responses (`offlineAi.test.ts`).
   - Floating window collision avoidance physics (`floatingWindows.test.ts`).
2. **Static Analysis & Build Verification**:
   - `npm run lint` (Oxlint zero errors).
   - `npm run build` (TypeScript `tsc -b` + Vite production bundle).
   - `cargo check` inside `src-tauri/` (Rust compilation).
3. **Continuous Commit & Push Protocol**:
   - Commit and push each verified stage to `origin main`, and run `npm run build:binaries` only as the final step after all tests pass.
