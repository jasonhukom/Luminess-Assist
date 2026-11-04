---
name: floating-window-ui
description: Create independent draggable History and Settings/Storage (config.json) floating windows styled like the chatbox, with real-time collision avoidance so they move away when touching the chatbox and never overlap it.
---

# Floating Window UI Skill (`floating-window-ui`)

## Overview
Provides two independent, movable floating UI boxes styled to match the Luminess `ChatPanel`:
1. **Floating History Box (`FloatingHistoryBox.tsx`)**:
   - Searchable conversation sessions, saved user memories ("Who You Are"), and archived web searches.
2. **Floating Settings & Storage Box (`FloatingSettingsBox.tsx`)**:
   - Provider API keys (machine vault), Google account sync, Local AI runtime & hardware status, Storage Allocation options (1 GB / 5 GB Recommended / 10 GB / 25 GB / Unlimited), and live `config.json` viewer/editor.

## Collision Avoidance & Positioning Rules
- Both boxes can be dragged anywhere on the screen and persist their coordinates.
- **Chatbox Repulsion / Collision Avoidance**:
  - Whenever a floating box touches or comes within `16px` of the `ChatPanel` bounding box (either because the user dragged it near the chatbox or the chatbox opened/resized/flipped sides), a repulsion vector pushes the floating box away to the nearest non-overlapping screen region while keeping it clamped within monitor bounds.
  - All active floating boxes register their bounding rects with `set_interactive_regions` so click-through desktop transparency continues to work everywhere else on screen.
