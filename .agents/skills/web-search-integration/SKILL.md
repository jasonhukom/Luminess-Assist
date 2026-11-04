---
name: web-search-integration
description: Connect an external search engine provider, allow the AI to retrieve current web information, return useful source links and citations, and store search queries and results in the database.
---

# Web Search Integration Skill (`web-search-integration`)

## Overview
Equips Luminess Assist (across all cloud providers and Local AI) with a native web search engine (`web_search`) that retrieves live information, cites sources with clickable URLs, and archives every search query and result in the user's database.

## Architecture
1. **Native Rust Search Engine (`perform_web_search`)**:
   - Executes server-side HTTP requests from Rust (`src-tauri/src/lib.rs`) to avoid WebView CORS blocks.
   - Queries DuckDuckGo Lite/HTML search, DuckDuckGo Instant Answer API, and Wikipedia OpenSearch fallback to return structured results (`title`, `url`, `snippet`, `source`).
2. **AI Tool Integration (`web_search`)**:
   - Exposed as a standard function/tool declaration to Gemini, Claude, OpenAI, and Local AI.
   - Automatically triggered when the user asks about current events, factual lookups, documentation, or explicitly requests a search.
3. **Database Archival**:
   - Every search query, timestamp, and top cited results are stored in the persistent database and viewable/searchable in the floating History panel.
