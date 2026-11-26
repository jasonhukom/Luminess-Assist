import { invoke } from '@tauri-apps/api/core';
import type { ChatSession } from './chatHistory.ts';
import {
  createDefaultBotCustomization,
  mergeBotCustomization,
  type BotCustomizationManifest,
  type CustomApiFormat,
} from './botCustomization.ts';
import {
  createDefaultDrinkReminder,
  normalizeDrinkReminderConfig,
  type DrinkReminderConfig,
} from './drinkReminder.ts';

export type MusicLoopMode = 'off' | 'all' | 'one';

export interface MusicPlayerTrack {
  id: string;
  title: string;
  artist: string;
  source: 'ambient' | 'local' | 'url';
  uri: string;
  ambientPreset?: 'lofi' | 'space' | 'chimes' | 'brown';
  durationSec?: number;
}

export interface MusicPlayerConfig {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  loop_mode: MusicLoopMode;
  active_track_id: string | null;
  music_folder: string;
  custom_tracks: MusicPlayerTrack[];
}

export function createDefaultMusicPlayerConfig(): MusicPlayerConfig {
  return {
    volume: 0.55,
    muted: false,
    shuffle: false,
    loop_mode: 'all',
    active_track_id: 'ambient:lofi',
    music_folder: '',
    custom_tracks: [],
  };
}

export function normalizeMusicPlayerConfig(
  raw?: Partial<MusicPlayerConfig> | null
): MusicPlayerConfig {
  const defaults = createDefaultMusicPlayerConfig();
  if (!raw) return defaults;
  const loopMode: MusicLoopMode =
    raw.loop_mode === 'off' || raw.loop_mode === 'all' || raw.loop_mode === 'one'
      ? raw.loop_mode
      : defaults.loop_mode;
  const vol =
    typeof raw.volume === 'number' && Number.isFinite(raw.volume)
      ? Math.min(1, Math.max(0, raw.volume))
      : defaults.volume;

  const customTracks = Array.isArray(raw.custom_tracks)
    ? raw.custom_tracks.filter(
        (t): t is MusicPlayerTrack =>
          Boolean(t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.uri === 'string')
      )
    : [];

  return {
    volume: vol,
    muted: typeof raw.muted === 'boolean' ? raw.muted : defaults.muted,
    shuffle: typeof raw.shuffle === 'boolean' ? raw.shuffle : defaults.shuffle,
    loop_mode: loopMode,
    active_track_id:
      typeof raw.active_track_id === 'string' || raw.active_track_id === null
        ? raw.active_track_id
        : defaults.active_track_id,
    music_folder: typeof raw.music_folder === 'string' ? raw.music_folder.trim() : '',
    custom_tracks: customTracks,
  };
}

export type StorageTierId = 'lightweight' | 'recommended' | 'extended' | 'large' | 'unlimited';

export interface StorageTierOption {
  id: StorageTierId;
  label: string;
  allocationLabel: string;
  bytes: number; // 0 means unlimited (bounded by physical disk)
  limitBytes: number;
  recommended?: boolean;
  description: string;
}

export const STORAGE_RECOMMENDATION_EXPLANATION =
  'We recommend 5 GB (Default) because it stores years of conversations, your Google-synced user profile memories, and thousands of cached web search citations without risking disk exhaustion. Unlimited / Infinity removes the app cap while still respecting your physical free disk space with an automatic 512 MB safety reserve.';

export const STORAGE_TIER_OPTIONS: StorageTierOption[] = [
  {
    id: 'lightweight',
    label: 'Lightweight',
    allocationLabel: '1 GB',
    bytes: 1 * 1024 * 1024 * 1024,
    limitBytes: 1 * 1024 * 1024 * 1024,
    description: 'Compact footprint for essential conversations, user profile memory, and recent search queries.',
  },
  {
    id: 'recommended',
    label: 'Recommended',
    allocationLabel: '5 GB',
    bytes: 5 * 1024 * 1024 * 1024,
    limitBytes: 5 * 1024 * 1024 * 1024,
    recommended: true,
    description:
      'Recommended Default: Provides ample room for years of searchable chat history, user memory, and web search cache while keeping disk usage modest.',
  },
  {
    id: 'extended',
    label: 'Extended',
    allocationLabel: '10 GB',
    bytes: 10 * 1024 * 1024 * 1024,
    limitBytes: 10 * 1024 * 1024 * 1024,
    description: 'High-capacity local database for heavy daily research, code snippets, and deep search archives.',
  },
  {
    id: 'large',
    label: 'Large',
    allocationLabel: '25 GB',
    bytes: 25 * 1024 * 1024 * 1024,
    limitBytes: 25 * 1024 * 1024 * 1024,
    description: 'Workstation-scale allocation for extensive long-term conversational and search storage.',
  },
  {
    id: 'unlimited',
    label: 'Unlimited (Infinity)',
    allocationLabel: 'No App Cap',
    bytes: 0,
    limitBytes: 0,
    description:
      'No application-imposed cap. Dynamically respects your actual available disk capacity with automatic low-disk warnings and safety protection.',
  },
];

export interface UserMemoryItem {
  id: string;
  category: 'identity' | 'preference' | 'project' | 'fact';
  key: string;
  value: string;
  sourceText?: string;
  accountEmail: string;
  createdAt: number;
  updatedAt: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  results: WebSearchResult[];
  accountEmail: string;
  timestamp: number;
}

export interface FloatingBoxPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
}

export interface AppConfigJson {
  version: string;
  selected_provider: string;
  gemini_model: string;
  claude_model: string;
  codex_model: string;
  custom_api_format: CustomApiFormat;
  custom_api_endpoint: string;
  custom_api_model: string;
  custom_api_headers: string;
  active_agent_preset: string;
  agent_cli_command: string;
  local_ai_runtime: 'auto' | 'ollama' | 'openai_compatible' | 'opencode' | 'kilocode' | 'builtin';
  local_ai_endpoint: string;
  local_ai_model: string;
  storage_tier: StorageTierId;
  storage_limit_bytes: number;
  installation_storage_prompted: boolean;
  auto_approve_tools: boolean;
  search_engine_enabled: boolean;
  memory_sync_enabled: boolean;
  google_account_email: string | null;
  floating_positions: {
    history: FloatingBoxPosition;
    settings: FloatingBoxPosition;
    music: FloatingBoxPosition;
  };
  bot_customization: BotCustomizationManifest;
  drink_reminder: DrinkReminderConfig;
  music_player: MusicPlayerConfig;
  updated_at: number;
}

export interface StorageStatus {
  storage_tier: string;
  configured_limit_bytes: number;
  effective_limit_bytes: number;
  used_bytes: number;
  disk_free_bytes: number;
  disk_total_bytes: number;
  usage_percent: number;
  disk_warning: boolean;
  disk_critical: boolean;
  warning_message?: string | null;
  config_path: string;
  database_path: string;
}

export interface LuminessDatabaseSchema {
  version: number;
  updatedAt: number;
  accountEmail: string | null;
  memories: UserMemoryItem[];
  searchHistory: SearchHistoryEntry[];
  sessions: ChatSession[];
}

const LOCAL_CONFIG_FALLBACK_KEY = 'LUMINESS_APP_CONFIG_JSON_V1';
const LOCAL_DB_FALLBACK_KEY = 'LUMINESS_DATABASE_JSON_V1';

const inMemoryStore = new Map<string, string>();

function readFallbackStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return inMemoryStore.get(key) || null;
}

function writeFallbackStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
  inMemoryStore.set(key, value);
}

export function createDefaultAppConfig(): AppConfigJson {
  return {
    version: '1.2.0',
    selected_provider: 'gemini',
    gemini_model: 'gemini-2.5-flash',
    claude_model: 'claude-sonnet-4-20250514',
    codex_model: 'gpt-4o',
    custom_api_format: 'openai-chat',
    custom_api_endpoint: '',
    custom_api_model: '',
    custom_api_headers: '',
    active_agent_preset: 'direct-custom',
    agent_cli_command: 'opencode',
    local_ai_runtime: 'auto',
    local_ai_endpoint: 'http://127.0.0.1:11434',
    local_ai_model: 'qwen2.5-coder:latest',
    storage_tier: 'recommended',
    storage_limit_bytes: 5 * 1024 * 1024 * 1024,
    installation_storage_prompted: false,
    auto_approve_tools: false,
    search_engine_enabled: true,
    memory_sync_enabled: true,
    google_account_email: null,
    floating_positions: {
      history: { x: 48, y: 72, width: 350, height: 460 },
      settings: { x: 420, y: 72, width: 430, height: 560 },
      music: { x: 88, y: 116, width: 392, height: 496 },
    },
    bot_customization: createDefaultBotCustomization(),
    drink_reminder: createDefaultDrinkReminder(),
    music_player: createDefaultMusicPlayerConfig(),
    updated_at: Date.now(),
  };
}

let cachedConfig: AppConfigJson = (() => {
  const defaults = createDefaultAppConfig();
  const raw = readFallbackStorage(LOCAL_CONFIG_FALLBACK_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AppConfigJson>;
      return {
        ...defaults,
        ...parsed,
        floating_positions: {
          ...defaults.floating_positions,
          ...(parsed.floating_positions || {}),
        },
        bot_customization: mergeBotCustomization(
          defaults.bot_customization,
          parsed.bot_customization
        ),
        drink_reminder: normalizeDrinkReminderConfig(parsed.drink_reminder),
        music_player: normalizeMusicPlayerConfig(parsed.music_player),
      };
    } catch {
      // ignore
    }
  }
  return defaults;
})();

let cachedDb: LuminessDatabaseSchema = (() => {
  const raw = readFallbackStorage(LOCAL_DB_FALLBACK_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          version: 1,
          updatedAt: parsed.updatedAt || Date.now(),
          accountEmail: parsed.accountEmail || null,
          memories: Array.isArray(parsed.memories) ? parsed.memories : [],
          searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        };
      }
    } catch {
      // ignore
    }
  }
  return {
    version: 1,
    updatedAt: Date.now(),
    accountEmail: null,
    memories: [],
    searchHistory: [],
    sessions: [],
  };
})();

export function getTierBytes(tier: StorageTierId): number {
  const found = STORAGE_TIER_OPTIONS.find((t) => t.id === tier);
  return found ? found.bytes : 5 * 1024 * 1024 * 1024;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : idx >= 3 ? 2 : 1)} ${units[idx]}`;
}

export async function loadAppConfigFromMachine(): Promise<AppConfigJson> {
  try {
    const cfg = await invoke<AppConfigJson>('get_app_config');
    if (cfg && typeof cfg === 'object') {
      const defaults = createDefaultAppConfig();
      cachedConfig = {
        ...defaults,
        ...cfg,
        floating_positions: {
          ...defaults.floating_positions,
          ...(cfg.floating_positions || {}),
        },
        bot_customization: mergeBotCustomization(
          defaults.bot_customization,
          cfg.bot_customization
        ),
        drink_reminder: normalizeDrinkReminderConfig(cfg.drink_reminder),
        music_player: normalizeMusicPlayerConfig(cfg.music_player),
      };
      writeFallbackStorage(LOCAL_CONFIG_FALLBACK_KEY, JSON.stringify(cachedConfig));
      return cachedConfig;
    }
  } catch {
    // Fallback outside Tauri runtime
  }
  return cachedConfig;
}

export function getCachedAppConfig(): AppConfigJson {
  return cachedConfig;
}

export async function saveAppConfigToMachine(partial: Partial<AppConfigJson>): Promise<AppConfigJson> {
  const defaults = createDefaultAppConfig();
  const nextBotCustomization = partial.bot_customization
    ? mergeBotCustomization(
        cachedConfig.bot_customization || defaults.bot_customization,
        partial.bot_customization
      )
    : cachedConfig.bot_customization || defaults.bot_customization;

  const nextDrinkReminder = partial.drink_reminder
    ? normalizeDrinkReminderConfig({
        ...(cachedConfig.drink_reminder || defaults.drink_reminder),
        ...partial.drink_reminder,
      })
    : normalizeDrinkReminderConfig(cachedConfig.drink_reminder);

  const nextMusicPlayer = partial.music_player
    ? normalizeMusicPlayerConfig({
        ...(cachedConfig.music_player || defaults.music_player),
        ...partial.music_player,
      })
    : normalizeMusicPlayerConfig(cachedConfig.music_player);

  const next: AppConfigJson = {
    ...cachedConfig,
    ...partial,
    bot_customization: nextBotCustomization,
    drink_reminder: nextDrinkReminder,
    music_player: nextMusicPlayer,
    updated_at: Date.now(),
  };
  if (partial.storage_tier) {
    next.storage_limit_bytes = getTierBytes(partial.storage_tier);
  }
  cachedConfig = next;
  writeFallbackStorage(LOCAL_CONFIG_FALLBACK_KEY, JSON.stringify(next));
  try {
    const saved = await invoke<AppConfigJson>('save_app_config', { config: next });
    if (saved) {
      cachedConfig = {
        ...next,
        ...saved,
        bot_customization: mergeBotCustomization(nextBotCustomization, saved.bot_customization),
        drink_reminder: normalizeDrinkReminderConfig({
          ...nextDrinkReminder,
          ...(saved.drink_reminder || {}),
        }),
        music_player: normalizeMusicPlayerConfig({
          ...nextMusicPlayer,
          ...(saved.music_player || {}),
        }),
      };
      writeFallbackStorage(LOCAL_CONFIG_FALLBACK_KEY, JSON.stringify(cachedConfig));
    }
  } catch {
    // Fallback outside Tauri runtime
  }
  return cachedConfig;
}

export async function getMachineStorageStatus(): Promise<StorageStatus> {
  try {
    const status = await invoke<StorageStatus>('get_storage_status');
    if (status) return status;
  } catch {
    // Fallback calculation
  }
  const serialized = JSON.stringify(cachedDb);
  const used = new TextEncoder().encode(serialized).length;
  const configured = cachedConfig.storage_tier === 'unlimited' ? 0 : cachedConfig.storage_limit_bytes;
  const diskFree = 5 * 1024 * 1024 * 1024;
  const effective = configured === 0 ? diskFree : Math.min(configured, diskFree);
  return {
    storage_tier: cachedConfig.storage_tier,
    configured_limit_bytes: configured,
    effective_limit_bytes: effective,
    used_bytes: used,
    disk_free_bytes: diskFree,
    disk_total_bytes: 250 * 1024 * 1024 * 1024,
    usage_percent: effective > 0 ? Math.min(100, (used / effective) * 100) : 0,
    disk_warning: false,
    disk_critical: false,
    warning_message: null,
    config_path: '%LOCALAPPDATA%\\LuminessAssist\\config.json',
    database_path: '%LOCALAPPDATA%\\LuminessAssist\\database.json',
  };
}

function enforceDatabaseQuotaInMemory(db: LuminessDatabaseSchema, maxBytes: number): LuminessDatabaseSchema {
  if (maxBytes <= 0) return db;
  let serialized = JSON.stringify(db);
  if (serialized.length <= maxBytes) return db;

  const copy: LuminessDatabaseSchema = {
    ...db,
    memories: [...db.memories],
    searchHistory: [...db.searchHistory],
    sessions: [...db.sessions],
  };

  // 1. Prune oldest search history first
  while (copy.searchHistory.length > 5 && JSON.stringify(copy).length > maxBytes) {
    copy.searchHistory.pop();
  }

  // 2. Prune oldest chat sessions (keep at least the most recent session)
  while (copy.sessions.length > 1 && JSON.stringify(copy).length > maxBytes) {
    copy.sessions.pop();
  }

  serialized = JSON.stringify(copy);
  if (serialized.length > maxBytes && copy.searchHistory.length > 0) {
    copy.searchHistory = [];
  }
  return copy;
}

export async function loadDatabaseFromMachine(): Promise<LuminessDatabaseSchema> {
  try {
    const raw = await invoke<string>('db_load_state');
    if (raw && raw.trim().length > 0) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        cachedDb = {
          version: 1,
          updatedAt: parsed.updatedAt || Date.now(),
          accountEmail: parsed.accountEmail || cachedConfig.google_account_email || null,
          memories: Array.isArray(parsed.memories) ? parsed.memories : [],
          searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        };
        writeFallbackStorage(LOCAL_DB_FALLBACK_KEY, JSON.stringify(cachedDb));
      }
    }
  } catch {
    // Fallback outside Tauri
  }
  return cachedDb;
}

export function getCachedDatabase(): LuminessDatabaseSchema {
  return cachedDb;
}

export async function saveDatabaseToMachine(partial?: Partial<LuminessDatabaseSchema>): Promise<LuminessDatabaseSchema> {
  const merged: LuminessDatabaseSchema = {
    ...cachedDb,
    ...(partial || {}),
    updatedAt: Date.now(),
  };
  const limitBytes =
    cachedConfig.storage_tier === 'unlimited'
      ? 0
      : cachedConfig.storage_limit_bytes || getTierBytes(cachedConfig.storage_tier);

  cachedDb = enforceDatabaseQuotaInMemory(merged, limitBytes);
  const payload = JSON.stringify(cachedDb);
  writeFallbackStorage(LOCAL_DB_FALLBACK_KEY, payload);

  try {
    await invoke('db_save_state', { jsonPayload: payload });
  } catch {
    // Fallback outside Tauri
  }
  return cachedDb;
}

/**
 * Automatically extracts persistent user facts (name, role, preferences, projects, interests)
 * from natural conversational messages and associates them with the active Google account.
 */
export function extractAndSaveUserMemoriesFromText(
  userText: string,
  accountEmail?: string | null
): UserMemoryItem[] {
  const clean = userText.trim();
  if (!clean) return [];

  const email = (accountEmail || cachedConfig.google_account_email || 'local_user').toLowerCase();
  const extracted: Array<{ category: UserMemoryItem['category']; key: string; value: string }> = [];

  // 1. Name / Identity ("my name is Alex", "call me Alex", "I'm Alex")
  const nameMatch = clean.match(
    /\b(?:my name is|call me|i am called|you can call me)\s+([A-Z][a-zA-Z0-9_-]{1,28}(?:\s+[A-Z][a-zA-Z0-9_-]{1,28})?)/i
  );
  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].trim();
    if (!/^(?:hungry|tired|sad|happy|here|ready|asking|looking|working|trying|testing)$/i.test(candidate)) {
      extracted.push({ category: 'identity', key: 'user_name', value: candidate });
    }
  }

  // 2. Role / Profession ("I am a software engineer", "I work as a designer")
  const roleMatch = clean.match(
    /\b(?:i am a|i'm a|i work as a|my job is|my role is)\s+([a-zA-Z0-9\s/-]{3,45}?)(?:[.,;!?]|$|\s+and\s+|\s+who\s+)/i
  );
  if (roleMatch && roleMatch[1]) {
    extracted.push({ category: 'identity', key: 'profession_or_role', value: roleMatch[1].trim() });
  }

  // 3. Location / Timezone ("I live in ...", "I am from ...")
  const locMatch = clean.match(/\b(?:i live in|i'm from|i am based in)\s+([a-zA-Z0-9\s,]{2,40}?)(?:[.,;!?]|$)/i);
  if (locMatch && locMatch[1]) {
    extracted.push({ category: 'identity', key: 'location', value: locMatch[1].trim() });
  }

  // 4. Preferences ("I prefer ...", "my favorite ... is ...", "I love using ...")
  const prefMatch = clean.match(
    /\b(?:i prefer|i always use|i really like|my favorite\s+[a-zA-Z]+\s+is)\s+([^.!?\n]{3,80})/i
  );
  if (prefMatch && prefMatch[1]) {
    extracted.push({
      category: 'preference',
      key: `pref_${prefMatch[1].trim().toLowerCase().slice(0, 24).replace(/\W+/g, '_')}`,
      value: prefMatch[0].trim(),
    });
  }

  // 5. Projects / Current work ("I am working on ...", "I'm building ...")
  const projMatch = clean.match(
    /\b(?:i am working on|i'm working on|i am building|i'm building|my project is)\s+([^.!?\n]{3,80})/i
  );
  if (projMatch && projMatch[1]) {
    extracted.push({
      category: 'project',
      key: 'active_project',
      value: projMatch[1].trim(),
    });
  }

  // 6. Explicit "remember that ..." or "don't forget that ..."
  const remMatch = clean.match(/\b(?:remember that|please remember|don'?t forget that)\s+([^.!?\n]{3,120})/i);
  if (remMatch && remMatch[1]) {
    extracted.push({
      category: 'fact',
      key: `note_${Date.now().toString(36)}`,
      value: remMatch[1].trim(),
    });
  }

  if (extracted.length === 0) return [];

  const now = Date.now();
  const updatedMemories = [...cachedDb.memories];
  const addedOrUpdated: UserMemoryItem[] = [];

  for (const item of extracted) {
    const existingIdx = updatedMemories.findIndex(
      (m) => m.key === item.key && (m.accountEmail === email || m.accountEmail === 'local_user')
    );
    if (existingIdx >= 0) {
      updatedMemories[existingIdx] = {
        ...updatedMemories[existingIdx],
        value: item.value,
        sourceText: clean,
        accountEmail: email,
        updatedAt: now,
      };
      addedOrUpdated.push(updatedMemories[existingIdx]);
    } else {
      const created: UserMemoryItem = {
        id: `mem_${now}_${Math.random().toString(36).slice(2, 7)}`,
        category: item.category,
        key: item.key,
        value: item.value,
        sourceText: clean,
        accountEmail: email,
        createdAt: now,
        updatedAt: now,
      };
      updatedMemories.unshift(created);
      addedOrUpdated.push(created);
    }
  }

  cachedDb = {
    ...cachedDb,
    accountEmail: email,
    memories: updatedMemories.slice(0, 500),
    updatedAt: now,
  };
  void saveDatabaseToMachine();
  return addedOrUpdated;
}

export function saveExplicitUserMemory(
  category: UserMemoryItem['category'],
  key: string,
  value: string,
  accountEmail?: string | null
): UserMemoryItem {
  const now = Date.now();
  const email = (accountEmail || cachedConfig.google_account_email || 'local_user').toLowerCase();
  const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_') || `fact_${now}`;
  const cleanVal = value.trim();

  const list = [...cachedDb.memories];
  const idx = list.findIndex((m) => m.key === cleanKey && (m.accountEmail === email || m.accountEmail === 'local_user'));

  let saved: UserMemoryItem;
  if (idx >= 0) {
    saved = {
      ...list[idx],
      category,
      value: cleanVal,
      accountEmail: email,
      updatedAt: now,
    };
    list[idx] = saved;
  } else {
    saved = {
      id: `mem_${now}_${Math.random().toString(36).slice(2, 7)}`,
      category,
      key: cleanKey,
      value: cleanVal,
      accountEmail: email,
      createdAt: now,
      updatedAt: now,
    };
    list.unshift(saved);
  }

  cachedDb = {
    ...cachedDb,
    accountEmail: email,
    memories: list,
    updatedAt: now,
  };
  void saveDatabaseToMachine();
  return saved;
}

export function getUserMemories(accountEmail?: string | null): UserMemoryItem[] {
  const email = accountEmail ? accountEmail.toLowerCase() : cachedConfig.google_account_email?.toLowerCase();
  if (!email) return cachedDb.memories;
  return cachedDb.memories.filter(
    (m) => m.accountEmail === email || m.accountEmail === 'local_user'
  );
}

export function deleteUserMemory(memoryId: string): UserMemoryItem[] {
  cachedDb = {
    ...cachedDb,
    memories: cachedDb.memories.filter((m) => m.id !== memoryId),
    updatedAt: Date.now(),
  };
  void saveDatabaseToMachine();
  return cachedDb.memories;
}

export function clearAllUserMemories(_accountEmail?: string | null): void {
  cachedDb = {
    ...cachedDb,
    memories: [],
    updatedAt: Date.now(),
  };
  void saveDatabaseToMachine();
}

export const addExplicitUserMemory = saveExplicitUserMemory;
export const buildUserMemorySystemContext = getPersistentMemoryPromptContext;

export function isWebSearchIntent(text: string): { shouldSearch: boolean; query: string } {
  const clean = text.trim();
  if (!clean) return { shouldSearch: false, query: '' };
  const explicitMatch = clean.match(
    /^(?:search\s+(?:for|the\s+web\s+for|about|up)?|look\s+up|google|find\s+info\s+on|search)\s+(.+)$/i
  );
  if (explicitMatch && explicitMatch[1]) {
    return { shouldSearch: true, query: explicitMatch[1].trim() };
  }
  if (
    /^(?:what\s+is|what\s+are|who\s+is|who\s+was|where\s+is|when\s+did|how\s+does|how\s+to|tell\s+me\s+about|explain|why\s+is|latest\s+news\s+on)\s+(.+)$/i.test(
      clean
    )
  ) {
    return { shouldSearch: true, query: clean };
  }
  return { shouldSearch: false, query: '' };
}

/**
 * Associates all local_user memories and sessions with the newly signed-in Google account email
 * so user identity and conversation history stay synchronized with their Google account.
 */
export async function syncMemoriesWithGoogleAccount(
  email: string,
  displayName?: string
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;

  const updatedMemories = cachedDb.memories.map((m) =>
    m.accountEmail === 'local_user' ? { ...m, accountEmail: cleanEmail } : m
  );

  // If the Google account provides a name and we don't have a user_name memory yet, save it!
  if (displayName && displayName.trim()) {
    const hasName = updatedMemories.some(
      (m) => m.key === 'user_name' && m.accountEmail === cleanEmail
    );
    if (!hasName) {
      updatedMemories.unshift({
        id: `mem_${Date.now()}_gname`,
        category: 'identity',
        key: 'user_name',
        value: displayName.trim(),
        sourceText: 'Google Account Profile',
        accountEmail: cleanEmail,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  cachedDb = {
    ...cachedDb,
    accountEmail: cleanEmail,
    memories: updatedMemories,
    updatedAt: Date.now(),
  };
  await saveAppConfigToMachine({ google_account_email: cleanEmail });
  await saveDatabaseToMachine();
}

/**
 * Formats relevant persistent memories and recent searches for injection into the AI system prompt.
 */
export function getPersistentMemoryPromptContext(accountEmail?: string | null): string {
  const memories = getUserMemories(accountEmail);
  const lines: string[] = [
    'PERSISTENT USER MEMORY & ACCOUNT PROFILE (Saved across conversations; associated with the user account):',
  ];

  if (accountEmail) {
    lines.push(`- Authenticated Google Account: ${accountEmail}`);
  }

  if (memories.length === 0) {
    lines.push(
      '- No saved facts about the user yet. Pay attention to when the user introduces themselves or shares preferences, and use `remember_user_fact` to remember who they are.'
    );
  } else {
    for (const mem of memories.slice(0, 25)) {
      lines.push(`- [${mem.category.toUpperCase()}] ${mem.key}: ${mem.value}`);
    }
  }

  if (cachedDb.searchHistory.length > 0) {
    const recentSearches = cachedDb.searchHistory.slice(0, 3);
    lines.push('- Recent Search Engine Queries in Database:');
    for (const s of recentSearches) {
      lines.push(`  • "${s.query}" (${s.results.length} cited sources stored)`);
    }
  }

  return lines.join('\n');
}

/**
 * Performs a web search via the native Rust search engine (with browser API fallback)
 * and automatically stores the query and results in the persistent database.
 */
export async function performWebSearchAndStore(
  query: string,
  accountEmail?: string | null,
  maxResults = 5
): Promise<WebSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  let results: WebSearchResult[] = [];

  try {
    const nativeRes = await invoke<WebSearchResult[]>('perform_web_search', {
      query: cleanQuery,
      maxResults,
    });
    if (Array.isArray(nativeRes) && nativeRes.length > 0) {
      results = nativeRes;
    }
  } catch {
    // Browser / test environment fallback using Wikipedia OpenSearch + DuckDuckGo JSON API
    try {
      const encoded = encodeURIComponent(cleanQuery);
      const wikiResp = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json&origin=*&srlimit=${maxResults}`
      );
      if (wikiResp.ok) {
        const data: any = await wikiResp.json();
        const items: any[] = data?.query?.search || [];
        results = items.map((item) => ({
          title: `${item.title} — Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(item.title).replace(/\s+/g, '_'))}`,
          snippet: String(item.snippet || '').replace(/<[^>]+>/g, ''),
          source: 'Wikipedia',
        }));
      }
    } catch {
      // Offline fallback
    }
  }

  const email = (accountEmail || cachedConfig.google_account_email || 'local_user').toLowerCase();
  const entry: SearchHistoryEntry = {
    id: `srch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    query: cleanQuery,
    results,
    accountEmail: email,
    timestamp: Date.now(),
  };

  cachedDb = {
    ...cachedDb,
    searchHistory: [entry, ...cachedDb.searchHistory.filter((s) => s.query !== cleanQuery)].slice(0, 200),
    updatedAt: Date.now(),
  };
  void saveDatabaseToMachine();

  return results;
}

export function getSearchHistory(): SearchHistoryEntry[] {
  return cachedDb.searchHistory;
}

export function clearSearchHistory(): void {
  cachedDb = {
    ...cachedDb,
    searchHistory: [],
    updatedAt: Date.now(),
  };
  void saveDatabaseToMachine();
}

export function clearMemoryAndStorageForTesting(): void {
  inMemoryStore.clear();
  cachedConfig = createDefaultAppConfig();
  cachedDb = {
    version: 1,
    updatedAt: Date.now(),
    accountEmail: null,
    memories: [],
    searchHistory: [],
    sessions: [],
  };
}
