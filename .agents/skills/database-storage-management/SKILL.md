---
name: database-storage-management
description: Implement storage limits, installation-time storage selection (Lightweight 1 GB, Recommended 5 GB, Extended 10 GB, Large 25 GB, Unlimited), database usage monitoring, cleanup, and configurable retention via config.json.
---

# Database Storage Management Skill (`database-storage-management`)

## Overview
Manages the local database (`%LOCALAPPDATA%\LuminessAssist\database.json`) and configuration file (`%LOCALAPPDATA%\LuminessAssist\config.json`), enforcing user-selected storage quotas while protecting actual disk space.

## Storage Allocation Tiers
| Option | Allocation | Notes |
| :--- | :--- | :--- |
| **Lightweight** | `1 GB` | Minimal footprint for basic chat history and user profile facts. |
| **Recommended (Default)** | `5 GB` | Ideal balance for multi-year conversation history, search cache, and local AI state without pressuring disk capacity. |
| **Extended** | `10 GB` | High-capacity archive for heavy daily research and long-term logs. |
| **Large** | `25 GB` | Maximum fixed tier for power users storing extensive search & workspace logs. |
| **Unlimited** | No app cap | Dynamically respects real available disk space with automatic warning and protection if free disk space drops below safety threshold (`1 GB`). |

## Responsibilities
1. Prompt user during installation (`install.ps1`) and first-launch setup to choose their storage allocation.
2. Monitor real-time database bytes used, configured quota bytes, and physical disk free bytes.
3. Enforce quota limits with automatic oldest-log pruning when approaching capacity and provide one-click cleanup and JSON export.
