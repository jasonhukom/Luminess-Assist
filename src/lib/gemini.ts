import { GoogleGenAI, Type } from '@google/genai';
import { invoke } from '@tauri-apps/api/core';
import type { Emotion } from '../components/Robot.tsx';
import type { CustomApiFormat } from './botCustomization.ts';
import { getPersonalityPromptContext } from './personality.ts';
import { runOfflineAgent } from './offlineAi.ts';
import {
  normalizeAIError,
  type NormalizedAIError,
  type AIErrorKind,
  type AIConnectionState,
} from './aiErrors.ts';
import {
  extractAndSaveUserMemoriesFromText,
  getCachedAppConfig,
  getPersistentMemoryPromptContext,
  performWebSearchAndStore,
  saveAppConfigToMachine,
  saveExplicitUserMemory,
  syncMemoriesWithGoogleAccount,
} from './memoryAndStorage.ts';

export type { NormalizedAIError, AIErrorKind, AIConnectionState };

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  emotion?: Emotion;
  toolActions?: string[];
}

export interface ToolPermissionRequest {
  id: string;
  toolName: string;
  description: string;
  args: Record<string, any>;
}

export type PermissionDecision = 'allow' | 'always_allow' | 'deny';

export interface GoogleUserSession {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
  email?: string;
  name?: string;
  picture?: string;
  projectId?: string;
  gcpProjectId?: string;
}

export interface AntigravityCliStatus {
  installed: boolean;
  path?: string;
  version?: string;
  supported_for_ipc: boolean;
  notes: string;
}

export interface MachineCredentialsVault {
  gemini_api_key: string;
  claude_api_key: string;
  codex_api_key: string;
  custom_api_key?: string;
  search_api_key: string;
  google_oauth_session_json: string;
  updated_at: number;
}

const LEGACY_GEMINI_STORAGE_KEY = 'GEMINI_API_KEY';
const LEGACY_GOOGLE_AUTH_STORAGE_KEY = 'LUMINESS_GOOGLE_AUTH';
const OAUTH_CLIENT_CACHE_KEY = 'LUMINESS_GOOGLE_OAUTH_CLIENT';
const PUBLIC_GEMINI_CLI_OAUTH_URL =
  'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/packages/core/src/code_assist/oauth2.ts';
const CODE_ASSIST_BASE_URL = 'https://cloudcode-pa.googleapis.com/v1internal';

interface OAuthClientConfig {
  clientId: string;
  clientSecret?: string;
}

const DEFAULT_GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';
const DEFAULT_GOOGLE_CLIENT_SECRET =
  (import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined)?.trim() || undefined;

async function getOAuthClientConfig(): Promise<OAuthClientConfig> {
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const envClientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  if (envClientId && String(envClientId).trim()) {
    return {
      clientId: String(envClientId).trim(),
      clientSecret: envClientSecret ? String(envClientSecret).trim() : undefined,
    };
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(OAUTH_CLIENT_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.clientId) {
          return parsed as OAuthClientConfig;
        }
      }
    }
  } catch {
    // ignore cache error
  }

  try {
    const resp = await fetch(PUBLIC_GEMINI_CLI_OAUTH_URL);
    if (resp.ok) {
      const source = await resp.text();
      const idMatch = source.match(/OAUTH_CLIENT_ID\s*=\s*['"]([^'"]+)['"]/);
      const secretMatch = source.match(/OAUTH_CLIENT_SECRET\s*=\s*['"]([^'"]+)['"]/);
      if (idMatch?.[1]) {
        const config: OAuthClientConfig = {
          clientId: idMatch[1],
          clientSecret: secretMatch?.[1],
        };
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(OAUTH_CLIENT_CACHE_KEY, JSON.stringify(config));
          }
        } catch {
          // ignore
        }
        return config;
      }
    }
  } catch {
    // ignore fetch error
  }

  return {
    clientId: DEFAULT_GOOGLE_CLIENT_ID,
    clientSecret: DEFAULT_GOOGLE_CLIENT_SECRET,
  };
}

export type AIProvider = 'gemini' | 'claude' | 'codex' | 'custom' | 'offline';

export interface ProviderConnectionOptions {
  baseUrl?: string;
  model?: string;
  apiFormat?: CustomApiFormat;
  customHeadersJson?: string;
}

const LEGACY_PROVIDER_KEY_STORAGE: Record<Exclude<AIProvider, 'gemini' | 'offline'>, string> = {
  claude: 'LUMINESS_CLAUDE_API_KEY',
  codex: 'LUMINESS_CODEX_API_KEY',
  custom: 'LUMINESS_CUSTOM_API_KEY',
};
const SELECTED_PROVIDER_STORAGE_KEY = 'LUMINESS_SELECTED_PROVIDER';

// In-memory runtime cache synced with the Windows DPAPI machine credential vault
const machineKeysCache: Record<Exclude<AIProvider, 'offline'>, string> = {
  gemini: '',
  claude: '',
  codex: '',
  custom: '',
};

let googleSession: GoogleUserSession | null = null;

// Initialize from any legacy localStorage values (before migrating to DPAPI machine vault)
function initLegacyFallbackState(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const legGemini = localStorage.getItem(LEGACY_GEMINI_STORAGE_KEY);
    if (legGemini && !machineKeysCache.gemini) {
      machineKeysCache.gemini = legGemini.trim();
    }
    const legClaude = localStorage.getItem(LEGACY_PROVIDER_KEY_STORAGE.claude);
    if (legClaude && !machineKeysCache.claude) {
      machineKeysCache.claude = legClaude.trim();
    }
    const legCodex = localStorage.getItem(LEGACY_PROVIDER_KEY_STORAGE.codex);
    if (legCodex && !machineKeysCache.codex) {
      machineKeysCache.codex = legCodex.trim();
    }
    const legCustom = localStorage.getItem(LEGACY_PROVIDER_KEY_STORAGE.custom);
    if (legCustom && !machineKeysCache.custom) {
      machineKeysCache.custom = legCustom.trim();
    }
    const legOAuth = localStorage.getItem(LEGACY_GOOGLE_AUTH_STORAGE_KEY);
    if (legOAuth && !googleSession) {
      const parsed = JSON.parse(legOAuth);
      if (parsed && (parsed.accessToken || parsed.refreshToken)) {
        googleSession = parsed as GoogleUserSession;
      }
    }
  } catch {
    // ignore
  }
}

initLegacyFallbackState();

function persistVaultToMachineAsync(): void {
  const oauthJson = googleSession ? JSON.stringify(googleSession) : '';
  void invoke<MachineCredentialsVault>('save_machine_credentials', {
    geminiApiKey: machineKeysCache.gemini,
    claudeApiKey: machineKeysCache.claude,
    codexApiKey: machineKeysCache.codex,
    customApiKey: machineKeysCache.custom,
    searchApiKey: null,
    googleOauthSessionJson: oauthJson,
  })
    .then(() => {
      // Once persisted to the Windows DPAPI machine vault, remove plaintext keys from browser localStorage
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(LEGACY_GEMINI_STORAGE_KEY);
          localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.claude);
          localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.codex);
          localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.custom);
        }
      } catch {
        // ignore
      }
    })
    .catch(() => {
      // Outside Tauri runtime (e.g., unit tests), keep in-memory state intact
    });
}

/**
 * Loads all provider API keys and the Google OAuth session from the Windows DPAPI machine vault
 * on application startup, and migrates any legacy keys into the machine vault.
 */
export async function loadMachineCredentialsOnStartup(): Promise<{
  keys: Record<AIProvider, string>;
  googleSession: GoogleUserSession | null;
}> {
  try {
    const vault = await invoke<MachineCredentialsVault>('load_machine_credentials');
    if (vault) {
      let needsMigrationSave = false;

      if (vault.gemini_api_key) {
        machineKeysCache.gemini = vault.gemini_api_key.trim();
      } else if (machineKeysCache.gemini) {
        needsMigrationSave = true;
      }

      if (vault.claude_api_key) {
        machineKeysCache.claude = vault.claude_api_key.trim();
      } else if (machineKeysCache.claude) {
        needsMigrationSave = true;
      }

      if (vault.codex_api_key) {
        machineKeysCache.codex = vault.codex_api_key.trim();
      } else if (machineKeysCache.codex) {
        needsMigrationSave = true;
      }

      if (vault.custom_api_key) {
        machineKeysCache.custom = vault.custom_api_key.trim();
      } else if (machineKeysCache.custom) {
        needsMigrationSave = true;
      }

      if (vault.google_oauth_session_json) {
        try {
          const parsed = JSON.parse(vault.google_oauth_session_json);
          if (parsed && (parsed.accessToken || parsed.refreshToken)) {
            googleSession = parsed as GoogleUserSession;
          }
        } catch {
          // ignore
        }
      } else if (googleSession) {
        needsMigrationSave = true;
      }

      if (needsMigrationSave) {
        persistVaultToMachineAsync();
      } else {
        // Scrub any leftover plaintext keys from browser localStorage
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(LEGACY_GEMINI_STORAGE_KEY);
            localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.claude);
            localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.codex);
            localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.custom);
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Fallback outside Tauri runtime
  }

  return {
    keys: {
      gemini: machineKeysCache.gemini,
      claude: machineKeysCache.claude,
      codex: machineKeysCache.codex,
      custom: machineKeysCache.custom,
      offline: 'offline-local',
    },
    googleSession,
  };
}

function saveGoogleSession(session: GoogleUserSession | null) {
  googleSession = session;
  persistVaultToMachineAsync();
  void saveAppConfigToMachine({
    google_account_email: session?.email || null,
  });
}

export function getGoogleSession(): GoogleUserSession | null {
  return googleSession;
}

export function logoutGoogle() {
  saveGoogleSession(null);
}

export function hasAuthSession(): boolean {
  return Boolean(googleSession || (machineKeysCache.gemini && machineKeysCache.gemini.trim().length > 0));
}

export function getApiKey(): string {
  return machineKeysCache.gemini;
}

export function setApiKey(key: string) {
  machineKeysCache.gemini = key.trim();
  persistVaultToMachineAsync();
}

export function hasApiKey(): boolean {
  return !!machineKeysCache.gemini && machineKeysCache.gemini.trim().length > 0;
}

export function getProviderApiKey(provider: AIProvider): string {
  if (provider === 'offline') return 'offline-local';
  return machineKeysCache[provider] || '';
}

export function setProviderApiKey(provider: AIProvider, key: string): void {
  if (provider === 'offline') return;
  const cleaned = key.trim();
  machineKeysCache[provider] = cleaned;
  persistVaultToMachineAsync();
}

export async function saveAllProviderKeysToMachine(
  keys: Partial<Record<AIProvider, string>>
): Promise<void> {
  if (keys.gemini !== undefined) machineKeysCache.gemini = keys.gemini.trim();
  if (keys.claude !== undefined) machineKeysCache.claude = keys.claude.trim();
  if (keys.codex !== undefined) machineKeysCache.codex = keys.codex.trim();
  if (keys.custom !== undefined) machineKeysCache.custom = keys.custom.trim();

  const oauthJson = googleSession ? JSON.stringify(googleSession) : '';
  try {
    await invoke<MachineCredentialsVault>('save_machine_credentials', {
      geminiApiKey: machineKeysCache.gemini,
      claudeApiKey: machineKeysCache.claude,
      codexApiKey: machineKeysCache.codex,
      customApiKey: machineKeysCache.custom,
      searchApiKey: null,
      googleOauthSessionJson: oauthJson,
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_GEMINI_STORAGE_KEY);
      localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.claude);
      localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.codex);
      localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.custom);
    }
  } catch {
    // Fallback outside Tauri runtime
  }
}

export function getSelectedProvider(): AIProvider {
  const valid = (v: string | null | undefined): v is AIProvider =>
    v === 'gemini' || v === 'claude' || v === 'codex' || v === 'custom' || v === 'offline';
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(SELECTED_PROVIDER_STORAGE_KEY);
    if (valid(saved)) return saved;
  }
  const cfgProv = getCachedAppConfig().selected_provider;
  return valid(cfgProv) ? cfgProv : 'gemini';
}

export function setSelectedProvider(provider: AIProvider): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SELECTED_PROVIDER_STORAGE_KEY, provider);
    }
  } catch {
    // ignore
  }
  void saveAppConfigToMachine({ selected_provider: provider });
}

export function hasAnyProviderKey(): boolean {
  const sel = getSelectedProvider();
  if (sel === 'offline') return true;
  const cfg = getCachedAppConfig();
  return Boolean(
    googleSession ||
      getProviderApiKey('gemini') ||
      getProviderApiKey('claude') ||
      getProviderApiKey('codex') ||
      getProviderApiKey('custom') ||
      (sel === 'custom' && cfg.custom_api_endpoint?.trim())
  );
}

export function hasAnyConfiguredProvider(): boolean {
  return hasAnyProviderKey();
}

export function parseCustomHeadersJson(raw?: string): Record<string, string> {
  const trimmed = (raw || '').trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Custom headers must be a JSON object of header key/value strings.');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (k.trim() && v !== undefined && v !== null) {
      out[k.trim()] = String(v);
    }
  }
  return out;
}

export function normalizeCustomEndpointUrl(
  baseUrl: string,
  apiFormat: CustomApiFormat,
  mode: 'chat' | 'models',
  model?: string,
  apiKey?: string
): string {
  let clean = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!clean) {
    clean =
      apiFormat === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : apiFormat === 'gemini'
          ? 'https://generativelanguage.googleapis.com/v1beta'
          : 'https://api.openai.com/v1';
  }

  if (mode === 'models') {
    const stripped = clean
      .replace(/\/chat\/completions$/i, '')
      .replace(/\/responses$/i, '')
      .replace(/\/messages$/i, '')
      .replace(/\/models\/[^/]+:(generateContent|streamGenerateContent)$/i, '');
    try {
      const parsed = new URL(stripped);
      if (!parsed.pathname || parsed.pathname === '/') {
        return `${stripped}/v1/models`;
      }
    } catch {
      // ignore URL parse error and append below
    }
    return stripped.endsWith('/models') ? stripped : `${stripped}/models`;
  }

  if (apiFormat === 'openai-chat') {
    if (/\/chat\/completions$/i.test(clean)) return clean;
    try {
      const parsed = new URL(clean);
      if (!parsed.pathname || parsed.pathname === '/') {
        return `${clean}/v1/chat/completions`;
      }
    } catch {
      // ignore
    }
    return `${clean}/chat/completions`;
  }

  if (apiFormat === 'openai-responses') {
    if (/\/responses$/i.test(clean)) return clean;
    try {
      const parsed = new URL(clean);
      if (!parsed.pathname || parsed.pathname === '/') {
        return `${clean}/v1/responses`;
      }
    } catch {
      // ignore
    }
    return `${clean}/responses`;
  }

  if (apiFormat === 'anthropic') {
    if (/\/messages$/i.test(clean)) return clean;
    try {
      const parsed = new URL(clean);
      if (!parsed.pathname || parsed.pathname === '/') {
        return `${clean}/v1/messages`;
      }
    } catch {
      // ignore
    }
    return `${clean}/messages`;
  }

  // Gemini REST API
  if (/:generateContent/i.test(clean)) {
    return apiKey && !/[?&]key=/i.test(clean)
      ? `${clean}${clean.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
      : clean;
  }
  const activeModel = encodeURIComponent((model || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash');
  let basePrefix = clean;
  try {
    const parsed = new URL(clean);
    if (!parsed.pathname || parsed.pathname === '/') {
      basePrefix = `${clean}/v1beta`;
    }
  } catch {
    // ignore
  }
  const full = `${basePrefix}/models/${activeModel}:generateContent`;
  return apiKey ? `${full}?key=${encodeURIComponent(apiKey)}` : full;
}

export interface SmartHttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

export async function smartHttpRequest(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutSecs?: number;
  } = {}
): Promise<SmartHttpResponse> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = init.headers || {};

  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: init.body,
    });
    return {
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      text: () => resp.text(),
      json: () => resp.json(),
    };
  } catch (fetchErr) {
    // Transparent Rust Tauri proxy fallback prevents CORS failures on third-party/custom APIs
    try {
      const proxyRes = await invoke<{
        ok: boolean;
        status: number;
        status_text: string;
        body: string;
      }>('http_proxy_request', {
        url,
        method,
        headers,
        body: init.body ?? null,
        timeoutSecs: init.timeoutSecs ?? 60,
      });
      return {
        ok: proxyRes.ok,
        status: proxyRes.status,
        statusText: proxyRes.status_text || '',
        text: async () => proxyRes.body,
        json: async () => JSON.parse(proxyRes.body),
      };
    } catch {
      throw fetchErr;
    }
  }
}

function extractProjectId(val: any): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.trim();
  }
  if (typeof val === 'object' && typeof val.id === 'string' && val.id.trim().length > 0) {
    return val.id.trim();
  }
  return undefined;
}

async function onboardCodeAssistTier(
  accessToken: string,
  tierId: string,
  coreMetadata: Record<string, any>,
  projectId?: string
): Promise<string | undefined> {
  try {
    const body: Record<string, any> = {
      tierId,
      metadata: projectId ? { ...coreMetadata, duetProject: projectId } : coreMetadata,
    };
    if (tierId !== 'free-tier' && projectId) {
      body.cloudaicompanionProject = projectId;
    }

    const onboardResp = await fetch(`${CODE_ASSIST_BASE_URL}:onboardUser`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!onboardResp.ok) {
      return undefined;
    }

    let lro: any = await onboardResp.json();
    let polls = 0;
    while (!lro?.done && lro?.name && polls < 8) {
      await new Promise((r) => setTimeout(r, 1500));
      polls++;
      const opResp = await fetch(`${CODE_ASSIST_BASE_URL}/${lro.name}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!opResp.ok) break;
      lro = await opResp.json();
    }

    return extractProjectId(lro?.response?.cloudaicompanionProject);
  } catch {
    return undefined;
  }
}

async function resolveCodeAssistProject(
  accessToken: string,
  forceFreeTier = false
): Promise<string | undefined> {
  const coreMetadata = {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'WINDOWS_AMD64',
    pluginType: 'GEMINI',
  };

  try {
    if (forceFreeTier) {
      const forcedProj = await onboardCodeAssistTier(accessToken, 'free-tier', coreMetadata);
      if (forcedProj) return forcedProj;
    }

    const loadResp = await fetch(`${CODE_ASSIST_BASE_URL}:loadCodeAssist`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metadata: coreMetadata }),
    });

    if (loadResp.ok) {
      const loadData: any = await loadResp.json();
      const existingProj = extractProjectId(loadData?.cloudaicompanionProject);
      if (existingProj) return existingProj;

      const allowedTiers: any[] = Array.isArray(loadData?.allowedTiers) ? loadData.allowedTiers : [];
      const freeTier = allowedTiers.find((t) => t?.id === 'free-tier');
      const defaultTier = allowedTiers.find((t) => t?.isDefault) || allowedTiers[0];
      const candidateTierIds = Array.from(
        new Set([freeTier?.id, 'free-tier', defaultTier?.id].filter(Boolean))
      ) as string[];

      for (const tierId of candidateTierIds) {
        const onboardedProj = await onboardCodeAssistTier(accessToken, tierId, coreMetadata);
        if (onboardedProj) return onboardedProj;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function discoverUserGcpProject(accessToken: string): Promise<string | undefined> {
  try {
    const resp = await fetch(
      'https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState%3AACTIVE',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!resp.ok) return undefined;
    const data: any = await resp.json();
    const projects: any[] = Array.isArray(data?.projects) ? data.projects : [];
    const preferred =
      projects.find((p) => typeof p?.projectId === 'string' && p.projectId.startsWith('gen-lang-client')) ||
      projects.find((p) => typeof p?.projectId === 'string');
    return preferred?.projectId ? String(preferred.projectId) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Queries the local system to check whether Google Antigravity CLI is installed.
 */
export async function checkAntigravityCliStatus(): Promise<AntigravityCliStatus> {
  try {
    const status = await invoke<AntigravityCliStatus>('check_antigravity_cli');
    return status;
  } catch {
    return {
      installed: false,
      supported_for_ipc: false,
      notes: 'Antigravity CLI is not detected on the system PATH.',
    };
  }
}

/**
 * Actively verifies whether the given AI provider and credentials (or custom no-preset endpoint)
 * can successfully communicate with the AI model service.
 */
export async function verifyProviderConnection(
  provider: AIProvider,
  keyOverride?: string,
  options?: ProviderConnectionOptions
): Promise<{ success: boolean; error?: NormalizedAIError; resolvedInfo?: string }> {
  if (provider === 'offline') {
    return { success: true, resolvedInfo: 'Local / Offline agent mode active' };
  }

  const cfg = getCachedAppConfig();
  const key = (keyOverride !== undefined ? keyOverride : getProviderApiKey(provider)).trim();

  let extraHeaders: Record<string, string> = {};
  const headersRaw = options?.customHeadersJson ?? cfg.custom_api_headers;
  if (headersRaw?.trim()) {
    try {
      extraHeaders = parseCustomHeadersJson(headersRaw);
    } catch (hdrErr: any) {
      return {
        success: false,
        error: normalizeAIError(hdrErr, provider),
      };
    }
  }

  if (provider === 'custom') {
    const baseUrl = (options?.baseUrl ?? cfg.custom_api_endpoint ?? '').trim();
    const apiFormat: CustomApiFormat = options?.apiFormat ?? cfg.custom_api_format ?? 'openai-chat';
    const model = (options?.model ?? cfg.custom_api_model ?? '').trim();

    if (!baseUrl || !(baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
      return {
        success: false,
        error: normalizeAIError(
          new Error('Valid http:// or https:// Custom API Base URL is required.'),
          'custom'
        ),
      };
    }

    try {
      if (apiFormat === 'gemini') {
        const activeModel = model || 'gemini-2.5-flash';
        const url = normalizeCustomEndpointUrl(baseUrl, 'gemini', 'chat', activeModel, key);
        const resp = await smartHttpRequest(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...extraHeaders },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        });
        if (resp.ok) {
          return { success: true, resolvedInfo: `${activeModel} via custom Gemini endpoint` };
        }
        const data = await resp.json().catch(() => ({}));
        return {
          success: false,
          error: normalizeAIError(
            {
              message: data?.error?.message || `HTTP ${resp.status} ${resp.statusText}`,
              status: resp.status,
              error: data?.error,
            },
            'custom'
          ),
        };
      }

      if (apiFormat === 'anthropic') {
        const activeModel = model || 'claude-sonnet-4-20250514';
        const url = normalizeCustomEndpointUrl(baseUrl, 'anthropic', 'chat', activeModel);
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          ...extraHeaders,
        };
        if (key && !headers['x-api-key'] && !headers['Authorization'] && !headers['authorization']) {
          headers['x-api-key'] = key;
        }
        const resp = await smartHttpRequest(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: activeModel,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (resp.ok) {
          return { success: true, resolvedInfo: `${activeModel} via custom Anthropic endpoint` };
        }
        const data = await resp.json().catch(() => ({}));
        return {
          success: false,
          error: normalizeAIError(
            {
              message: data?.error?.message || `HTTP ${resp.status} ${resp.statusText}`,
              status: resp.status,
              error: data?.error,
            },
            'custom'
          ),
        };
      }

      // OpenAI Chat Completions or Responses API compatible (no preset required!)
      const authHeaders: Record<string, string> = {
        'content-type': 'application/json',
        ...extraHeaders,
      };
      if (key && !authHeaders.authorization && !authHeaders.Authorization && !authHeaders['x-api-key']) {
        authHeaders.authorization = `Bearer ${key}`;
      }

      if (!model) {
        const modelsUrl = normalizeCustomEndpointUrl(baseUrl, apiFormat, 'models');
        const modelsResp = await smartHttpRequest(modelsUrl, {
          method: 'GET',
          headers: authHeaders,
        });
        if (modelsResp.ok) {
          const modelsJson = await modelsResp.json().catch(() => ({}));
          const firstModel = modelsJson?.data?.[0]?.id;
          return {
            success: true,
            resolvedInfo: firstModel ? `Connected (found model: ${firstModel})` : 'Endpoint reachable',
          };
        }
        const data = await modelsResp.json().catch(() => ({}));
        return {
          success: false,
          error: normalizeAIError(
            {
              message:
                data?.error?.message ||
                `HTTP ${modelsResp.status}. Enter a Model ID if /models is disabled on this endpoint.`,
              status: modelsResp.status,
              error: data?.error,
            },
            'custom'
          ),
        };
      }

      const targetUrl = normalizeCustomEndpointUrl(baseUrl, apiFormat, 'chat', model);
      const sendProbe = async (useMaxCompletionTokens: boolean) => {
        const payload =
          apiFormat === 'openai-responses'
            ? { model, input: 'ping', max_output_tokens: 16 }
            : useMaxCompletionTokens
              ? { model, messages: [{ role: 'user', content: 'ping' }], max_completion_tokens: 16 }
              : { model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 };
        return await smartHttpRequest(targetUrl, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
      };

      let resp = await sendProbe(false);
      let data = await resp.json().catch(() => ({}));
      const rawErr = String(data?.error?.message || '').toLowerCase();
      if (!resp.ok && resp.status === 400 && rawErr.includes('max_completion_tokens')) {
        resp = await sendProbe(true);
        data = await resp.json().catch(() => ({}));
      }
      if (resp.ok) {
        return { success: true, resolvedInfo: `${model} connected` };
      }

      return {
        success: false,
        error: normalizeAIError(
          {
            message: extractProviderError(data, `HTTP ${resp.status} ${resp.statusText}`),
            status: resp.status,
            error: data?.error,
          },
          'custom'
        ),
      };
    } catch (err: any) {
      return { success: false, error: normalizeAIError(err, 'custom') };
    }
  }

  if (provider === 'gemini') {
    const model = (options?.model || cfg.gemini_model || 'gemini-2.5-flash').trim();
    const customBase = (options?.baseUrl || '').trim();

    if (!key) {
      const refreshedSession = await ensureValidGoogleSession();
      if (refreshedSession && refreshedSession.accessToken) {
        const ping = await generateWithGoogleOAuth(
          refreshedSession,
          model,
          [{ role: 'user', parts: [{ text: 'ping' }] }],
          'Reply with ok.',
          []
        );
        if (ping !== null) {
          return { success: true, resolvedInfo: `Google OAuth (${model})` };
        }
        return {
          success: false,
          error: normalizeAIError(
            {
              status: 403,
              message:
                'PERMISSION_DENIED: Google OAuth signed in, but no active Gemini Code Assist or GCP project was enabled for this account. Paste a Gemini AI Studio API key or choose another provider/local agent.',
            },
            'gemini'
          ),
        };
      }
      return {
        success: false,
        error: normalizeAIError(new Error('Sign in required'), 'gemini'),
      };
    }

    try {
      if (isVertexExpressKey(key) && !customBase) {
        const ai = createGenAIClient(key, true);
        await ai.models.generateContent({
          model,
          contents: 'ping',
          config: { maxOutputTokens: 1 },
        });
        return { success: true, resolvedInfo: `${model} (Vertex Express)` };
      }

      const probeUrl = normalizeCustomEndpointUrl(
        customBase || 'https://generativelanguage.googleapis.com/v1beta',
        'gemini',
        'chat',
        model,
        key
      );
      const resp = await smartHttpRequest(probeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const errMsg = body?.error?.message || `HTTP ${resp.status} ${resp.statusText}`;
        return {
          success: false,
          error: normalizeAIError(
            {
              message: errMsg,
              status: resp.status,
              error: body?.error,
            },
            'gemini'
          ),
        };
      }

      return { success: true, resolvedInfo: `${model} connected` };
    } catch (err: any) {
      return { success: false, error: normalizeAIError(err, 'gemini') };
    }
  }

  if (provider === 'claude') {
    if (!key) {
      return {
        success: false,
        error: normalizeAIError(
          new Error('Invalid API key: Anthropic Claude API key is required.'),
          'claude'
        ),
      };
    }

    const chosenModel = (options?.model || cfg.claude_model || '').trim();
    const candidateModels = chosenModel
      ? [chosenModel]
      : ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'];
    const endpointUrl = normalizeCustomEndpointUrl(
      options?.baseUrl || cfg.custom_api_endpoint || 'https://api.anthropic.com/v1',
      'anthropic',
      'chat'
    );

    let lastErr: any = null;
    for (const model of candidateModels) {
      try {
        const resp = await smartHttpRequest(endpointUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            ...extraHeaders,
          },
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });

        if (resp.ok) {
          return { success: true, resolvedInfo: `${model} connected` };
        }
        const body = await resp.json().catch(() => ({}));
        const errMsg = body?.error?.message || `HTTP ${resp.status} ${resp.statusText}`;
        lastErr = {
          message: errMsg,
          status: resp.status,
          error: body?.error,
        };
        if (resp.status === 401 || resp.status === 403) {
          break;
        }
      } catch (err: any) {
        lastErr = err;
        break;
      }
    }

    return {
      success: false,
      error: normalizeAIError(lastErr || new Error('Claude verification failed'), 'claude'),
    };
  }

  if (provider === 'codex') {
    if (!key) {
      return {
        success: false,
        error: normalizeAIError(
          new Error('Invalid API key: OpenAI API key is required.'),
          'codex'
        ),
      };
    }

    const baseUrl = (options?.baseUrl || cfg.custom_api_endpoint || 'https://api.openai.com/v1').trim();
    const model = (options?.model || cfg.codex_model || 'gpt-4o').trim();

    try {
      // Probe chat completion directly so restricted keys (without /models scope) AND typos in custom model names verify cleanly
      const chatUrl = normalizeCustomEndpointUrl(baseUrl, 'openai-chat', 'chat', model);
      const sendOpenAIProbe = async (useMaxCompletionTokens: boolean) =>
        await smartHttpRequest(chatUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
            ...extraHeaders,
          },
          body: JSON.stringify(
            useMaxCompletionTokens
              ? { model, messages: [{ role: 'user', content: 'ping' }], max_completion_tokens: 16 }
              : { model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }
          ),
        });

      let resp = await sendOpenAIProbe(false);
      let body: any = await resp.json().catch(() => ({}));
      const lowerMsg = String(body?.error?.message || '').toLowerCase();
      if (!resp.ok && resp.status === 400 && lowerMsg.includes('max_completion_tokens')) {
        resp = await sendOpenAIProbe(true);
        body = await resp.json().catch(() => ({}));
      }

      if (resp.ok) {
        return { success: true, resolvedInfo: `${model} connected` };
      }

      // If 404 on default model, double-check GET /models to give an accurate error vs valid key
      if (resp.status !== 401 && resp.status !== 403 && resp.status !== 429) {
        const modelsResp = await smartHttpRequest(
          normalizeCustomEndpointUrl(baseUrl, 'openai-chat', 'models'),
          {
            method: 'GET',
            headers: { authorization: `Bearer ${key}`, ...extraHeaders },
          }
        );
        if (modelsResp.ok && !options?.model) {
          return { success: true, resolvedInfo: 'OpenAI API key verified' };
        }
      }

      const errMsg = body?.error?.message || `HTTP ${resp.status} ${resp.statusText}`;
      return {
        success: false,
        error: normalizeAIError(
          {
            message: errMsg,
            status: resp.status,
            error: body?.error,
          },
          'codex'
        ),
      };
    } catch (err: any) {
      return { success: false, error: normalizeAIError(err, 'codex') };
    }
  }

  return { success: true };
}

export async function loginWithGoogle(): Promise<GoogleUserSession> {
  const oauthClient = await getOAuthClientConfig();
  if (!oauthClient.clientId) {
    throw normalizeAIError(new Error('Google OAuth Client ID is missing.'), 'gemini');
  }

  const oauthResult = await invoke<{ code: string; redirect_uri: string }>(
    'start_google_oauth_login',
    { clientId: oauthClient.clientId }
  );

  const tokenParams = new URLSearchParams({
    client_id: oauthClient.clientId,
    code: oauthResult.code,
    grant_type: 'authorization_code',
    redirect_uri: oauthResult.redirect_uri,
  });
  if (oauthClient.clientSecret) {
    tokenParams.append('client_secret', oauthClient.clientSecret);
  }

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw normalizeAIError(new Error(`Google token exchange failed: ${errText}`), 'gemini');
  }

  const tokenData: any = await tokenResp.json();
  const accessToken = String(tokenData.access_token || '');
  const refreshToken = tokenData.refresh_token
    ? String(tokenData.refresh_token)
    : googleSession?.refreshToken;
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const expiryDate = Date.now() + expiresIn * 1000;

  let email: string | undefined;
  let name: string | undefined;
  let picture: string | undefined;

  try {
    const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (userResp.ok) {
      const profile: any = await userResp.json();
      email = profile.email;
      name = profile.name || profile.given_name;
      picture = profile.picture;
    }
  } catch {
    // Non-fatal if userinfo fails
  }

  const projectId = await resolveCodeAssistProject(accessToken);
  const gcpProjectId = await discoverUserGcpProject(accessToken);

  const session: GoogleUserSession = {
    accessToken,
    refreshToken,
    expiryDate,
    email,
    name,
    picture,
    projectId,
    gcpProjectId,
  };

  saveGoogleSession(session);

  if (email) {
    await syncMemoriesWithGoogleAccount(email, name);
  }

  return session;
}

export async function ensureValidGoogleSession(): Promise<GoogleUserSession | null> {
  if (!googleSession) return null;

  const isExpiringSoon = Date.now() > googleSession.expiryDate - 90_000;
  if (isExpiringSoon && googleSession.refreshToken) {
    try {
      const oauthClient = await getOAuthClientConfig();
      const params = new URLSearchParams({
        client_id: oauthClient.clientId,
        refresh_token: googleSession.refreshToken,
        grant_type: 'refresh_token',
      });
      if (oauthClient.clientSecret) {
        params.append('client_secret', oauthClient.clientSecret);
      }

      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (resp.ok) {
        const data: any = await resp.json();
        if (data.access_token) {
          googleSession = {
            ...googleSession,
            accessToken: String(data.access_token),
            expiryDate: Date.now() + (Number(data.expires_in) || 3600) * 1000,
          };
          saveGoogleSession(googleSession);
        }
      }
    } catch {
      // Keep current session if offline
    }
  }

  return googleSession;
}

async function generateWithGoogleOAuth(
  session: GoogleUserSession,
  model: string,
  contents: any[],
  systemInstruction: string,
  tools: any[]
): Promise<{ text: string; functionCalls: any[]; modelContent: any } | null> {
  try {
    const proj = session.projectId || (await resolveCodeAssistProject(session.accessToken));
    if (proj) {
      session.projectId = proj;
      const caPayload: Record<string, any> = {
        model,
        project: proj,
        user_prompt_id: `luminess-${Date.now()}`,
        request: {
          contents,
          systemInstruction: {
            role: 'user',
            parts: [{ text: systemInstruction }],
          },
          tools,
          generationConfig: { temperature: 0.6 },
        },
      };

      const resp = await fetch(`${CODE_ASSIST_BASE_URL}:generateContent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caPayload),
      });

      if (resp.ok) {
        const rawJson: any = await resp.json();
        const inner = rawJson?.response || rawJson;
        const candidates: any[] = inner?.candidates || [];
        const modelContent = candidates[0]?.content;
        const parts: any[] = modelContent?.parts || [];
        const functionCalls = parts
          .filter((p) => p && typeof p === 'object' && 'functionCall' in p && p.functionCall)
          .map((p) => p.functionCall);
        const text = parts
          .filter((p) => p && typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('');
        return { text, functionCalls, modelContent };
      }
    }

    const gcpProj = session.gcpProjectId || (await discoverUserGcpProject(session.accessToken));
    if (gcpProj) {
      session.gcpProjectId = gcpProj;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
          'x-goog-user-project': gcpProj,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            role: 'user',
            parts: [{ text: systemInstruction }],
          },
          tools,
          generationConfig: { temperature: 0.6 },
        }),
      });
      if (resp.ok) {
        const rawJson: any = await resp.json();
        const candidates: any[] = rawJson?.candidates || [];
        const modelContent = candidates[0]?.content;
        const parts: any[] = modelContent?.parts || [];
        const functionCalls = parts
          .filter((p) => p && typeof p === 'object' && 'functionCall' in p && p.functionCall)
          .map((p) => p.functionCall);
        const text = parts
          .filter((p) => p && typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('');
        return { text, functionCalls, modelContent };
      }
    }
  } catch {
    // Fallback to API key or local AI
  }
  return null;
}

const VALID_EMOTIONS: Emotion[] = [
  'joy',
  'sadness',
  'anger',
  'fear',
  'surprise',
  'disgust',
  'curiosity',
  'confusion',
  'love',
  'embarrassment',
  'idle',
];

function describeToolCall(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'get_pc_context':
      return 'Read system environment & user folder paths (Desktop, Documents, Drives)';
    case 'fs_list_dir':
      return `List all files and folders in "${args.path}"`;
    case 'fs_read_file':
      return `Read file contents from "${args.path}"`;
    case 'fs_write_file':
      return `${args.append ? 'Append to' : 'Write/Create'} file at "${args.path}" (${(args.content || '').length} chars)`;
    case 'fs_search_files':
      return `Search for files matching "${args.query}" inside "${args.directory}"`;
    case 'fs_delete_path':
      return `Permanently delete file or folder at "${args.path}"`;
    case 'fs_copy_or_move':
      return `${args.is_move ? 'Move/Rename' : 'Copy'} "${args.source}" to "${args.destination}"`;
    case 'execute_pc_command':
      return `Run PowerShell command on PC: ${args.command}${args.cwd ? ` (in ${args.cwd})` : ''}`;
    case 'open_item':
      return `Open application, file, folder, or URL: "${args.target}"`;
    case 'set_timer':
      return `Set a timer for ${args.minutes} minute(s)${args.label ? ` (${args.label})` : ''}`;
    case 'web_search':
      return `Search the web for "${args.query}" and store citations in database`;
    case 'remember_user_fact':
      return `Save user memory [${args.category || 'fact'}] ${args.key} = "${args.value}"`;
    default:
      return `Execute ${name} with ${JSON.stringify(args)}`;
  }
}

export async function executeToolOnPc(
  name: string,
  args: Record<string, any>,
  onTimerComplete?: (label: string) => void
): Promise<any> {
  switch (name) {
    case 'get_pc_context':
      return await invoke('get_pc_context');
    case 'fs_list_dir':
      return await invoke('fs_list_dir', { path: String(args.path || '~') });
    case 'fs_read_file':
      return await invoke('fs_read_file', {
        path: String(args.path),
        maxBytes: args.max_bytes ? Number(args.max_bytes) : 250000,
      });
    case 'fs_write_file':
      return await invoke('fs_write_file', {
        path: String(args.path),
        content: String(args.content ?? ''),
        append: Boolean(args.append),
      });
    case 'fs_search_files':
      return await invoke('fs_search_files', {
        directory: String(args.directory || '~'),
        query: String(args.query || ''),
        maxResults: args.max_results ? Number(args.max_results) : 100,
      });
    case 'fs_delete_path':
      return await invoke('fs_delete_path', { path: String(args.path) });
    case 'fs_copy_or_move':
      return await invoke('fs_copy_or_move', {
        source: String(args.source),
        destination: String(args.destination),
        isMove: Boolean(args.is_move),
      });
    case 'execute_pc_command':
      return await invoke('execute_pc_command', {
        command: String(args.command),
        cwd: args.cwd ? String(args.cwd) : null,
      });
    case 'open_item':
      return await invoke('open_item', { target: String(args.target) });
    case 'set_timer': {
      const minutes = Number(args.minutes) || 1;
      const label = String(args.label || `${minutes}m timer`);
      window.setTimeout(() => {
        onTimerComplete?.(label);
      }, Math.max(1000, minutes * 60 * 1000));
      return `Timer "${label}" started for ${minutes} minute(s).`;
    }
    case 'web_search': {
      const query = String(args.query || '');
      const results = await performWebSearchAndStore(
        query,
        googleSession?.email || getCachedAppConfig().google_account_email,
        Number(args.max_results) || 5
      );
      return {
        query,
        storedInDatabase: true,
        results,
      };
    }
    case 'remember_user_fact': {
      const catRaw = String(args.category || 'fact').toLowerCase();
      const category =
        catRaw === 'identity' || catRaw === 'preference' || catRaw === 'project' ? catRaw : 'fact';
      const saved = saveExplicitUserMemory(
        category,
        String(args.key || 'user_fact'),
        String(args.value || ''),
        googleSession?.email || getCachedAppConfig().google_account_email
      );
      return {
        saved: true,
        memory: saved,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function inferContextualEmotion(text: string): Emotion {
  const lower = text.toLowerCase();
  if (/\b(love|adorable|sweet|heart|hug|thank you so much|cherish|affection)\b/.test(lower)) {
    return 'love';
  }
  if (/\b(oops|my bad|mistake|embarrass|awkward|whoops|clumsy)\b/.test(lower)) {
    return 'embarrassment';
  }
  if (/\b(sorry|apologize|unfortunately|sadly|couldn't find|failed|unable to)\b/.test(lower)) {
    return 'sadness';
  }
  if (/\b(warning|careful|danger|caution|risky|permanent|destructive)\b/.test(lower)) {
    return 'fear';
  }
  if (/\b(confus|not sure what you mean|unclear|ambiguous|puzzl|huh\?)\b/.test(lower)) {
    return 'confusion';
  }
  if (/\b(frustrat|annoy|stubborn|ugh|mad|furious)\b/.test(lower)) {
    return 'anger';
  }
  if (/\b(gross|yuck|corrupted|messy|disgust)\b/.test(lower)) {
    return 'disgust';
  }
  if (/\b(wow|whoa|surpris|unexpected|incredible|astonish)\b/.test(lower)) {
    return 'surprise';
  }
  if (/\b(interesting|fascinating|wonder|let's see|exploring|investigat|curious|\?)\b/.test(lower)) {
    return 'curiosity';
  }
  if (/\b(glad|happy|great|awesome|yay|delighted|done!|hello|hi!|welcome)\b/.test(lower)) {
    return 'joy';
  }
  return 'idle';
}

function parseAssistantOutput(rawText: string): { content: string; emotion: Emotion } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { content: 'Done!', emotion: 'idle' };
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed.content === 'string') {
      const emo = VALID_EMOTIONS.includes(parsed.emotion)
        ? (parsed.emotion as Emotion)
        : inferContextualEmotion(parsed.content);
      return { content: parsed.content, emotion: emo };
    }
  } catch {
    const jsonStart = candidate.indexOf('{');
    const jsonEnd = candidate.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      try {
        const sub = JSON.parse(candidate.slice(jsonStart, jsonEnd + 1));
        if (sub && typeof sub.content === 'string') {
          const emo = VALID_EMOTIONS.includes(sub.emotion)
            ? (sub.emotion as Emotion)
            : inferContextualEmotion(sub.content);
          return { content: sub.content, emotion: emo };
        }
      } catch {
        // fallback
      }
    }
  }

  return { content: trimmed, emotion: inferContextualEmotion(trimmed) };
}

function isVertexExpressKey(key: string): boolean {
  return /^AQ[.\-_A-Za-z0-9]/i.test(key.trim());
}

function createGenAIClient(key: string, vertexai = false): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: key.trim(),
    vertexai,
  });
}

function normalizeProviderSchema(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeProviderSchema);
  if (!value || typeof value !== 'object') return value;
  const normalized: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    normalized[key] =
      key === 'type' && typeof child === 'string'
        ? child.toLowerCase()
        : normalizeProviderSchema(child);
  }
  return normalized;
}

function extractProviderError(body: any, fallback: string): string {
  return String(body?.error?.message || body?.message || body?.error || fallback);
}

const SAFE_AUTO_TOOLS = new Set(['web_search', 'remember_user_fact']);

async function runAlternativeProviderAgent(
  provider: Exclude<AIProvider, 'gemini' | 'offline'>,
  key: string,
  history: Message[],
  onToolStart: (toolName: string | null) => void,
  onEmotion: (emotion: Emotion) => void,
  onRequestPermission: (req: ToolPermissionRequest) => Promise<boolean>,
  onTimerComplete: ((label: string) => void) | undefined,
  systemInstruction: string,
  declarations: any[]
): Promise<Message> {
  const executedActions: string[] = [];
  const maxTurns = 8;
  const normalizedDeclarations = declarations.map((tool: any) => ({
    ...tool,
    parameters: normalizeProviderSchema(tool.parameters || { type: 'object', properties: {} }),
  }));

  const runTool = async (toolName: string, args: Record<string, any>): Promise<any> => {
    const description = describeToolCall(toolName, args);
    onEmotion('curiosity');

    let approved = true;
    if (!SAFE_AUTO_TOOLS.has(toolName)) {
      onToolStart(`Asking permission: ${toolName}`);
      approved = await onRequestPermission({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        toolName,
        description,
        args,
      });
    }

    if (!approved) {
      executedActions.push(`Denied: ${description}`);
      return { error: 'User denied permission to execute this action.' };
    }

    onToolStart(`Running: ${toolName}`);
    try {
      const result = await executeToolOnPc(toolName, args, onTimerComplete);
      executedActions.push(description);
      return { result };
    } catch (error: any) {
      const message = typeof error === 'string' ? error : error?.message || String(error);
      executedActions.push(`Failed: ${description} (${message})`);
      return { error: message };
    }
  };

  const cfg = getCachedAppConfig();
  let extraHeaders: Record<string, string> = {};
  if (cfg.custom_api_headers?.trim()) {
    extraHeaders = parseCustomHeadersJson(cfg.custom_api_headers);
  }

  const effectiveFormat: CustomApiFormat =
    provider === 'claude'
      ? 'anthropic'
      : provider === 'codex'
        ? 'openai-chat'
        : cfg.custom_api_format || 'openai-chat';

  const baseUrl =
    provider === 'custom'
      ? cfg.custom_api_endpoint || ''
      : provider === 'claude'
        ? cfg.custom_api_endpoint || 'https://api.anthropic.com/v1'
        : cfg.custom_api_endpoint || 'https://api.openai.com/v1';

  const activeModel =
    provider === 'custom'
      ? (cfg.custom_api_model || '').trim() ||
        (effectiveFormat === 'anthropic'
          ? 'claude-sonnet-4-20250514'
          : effectiveFormat === 'gemini'
            ? 'gemini-2.5-flash'
            : 'gpt-4o')
      : provider === 'claude'
        ? (cfg.claude_model || 'claude-sonnet-4-20250514').trim()
        : (cfg.codex_model || 'gpt-4o').trim();

  const temperature =
    typeof cfg.bot_customization?.apiConfig?.temperature === 'number'
      ? cfg.bot_customization.apiConfig.temperature
      : 0.6;

  try {
    if (effectiveFormat === 'anthropic') {
      const endpointUrl = normalizeCustomEndpointUrl(baseUrl, 'anthropic', 'chat', activeModel);
      const messages: any[] = history.map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      }));
      const providerTools = normalizedDeclarations.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
      let sendWithTools = true;

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(
          turn === 0 ? `Connecting to ${activeModel}…` : `${activeModel} is continuing the task…`
        );
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          ...extraHeaders,
        };
        if (key && !headers['x-api-key'] && !headers.authorization && !headers.Authorization) {
          headers['x-api-key'] = key;
        }

        const buildBody = (withTools: boolean) =>
          JSON.stringify({
            model: activeModel,
            max_tokens: 4096,
            system: systemInstruction,
            messages,
            ...(withTools ? { tools: providerTools } : {}),
          });

        let response = await smartHttpRequest(endpointUrl, {
          method: 'POST',
          headers,
          body: buildBody(sendWithTools),
        });

        let data: any = await response.json().catch(() => ({}));
        if (!response.ok && response.status === 400 && sendWithTools) {
          const msgLower = extractProviderError(data, '').toLowerCase();
          if (msgLower.includes('tool') || msgLower.includes('function')) {
            sendWithTools = false;
            response = await smartHttpRequest(endpointUrl, {
              method: 'POST',
              headers,
              body: buildBody(false),
            });
            data = await response.json().catch(() => ({}));
          }
        }

        if (!response.ok) {
          const errMsg = extractProviderError(data, `API error (${response.status})`);
          throw normalizeAIError(
            {
              message: errMsg,
              status: response.status,
              error: data?.error,
            },
            provider
          );
        }

        const blocks: any[] = Array.isArray(data.content) ? data.content : [];
        const calls = blocks.filter((block) => block?.type === 'tool_use');
        if (calls.length === 0) {
          const rawText = blocks
            .filter((block) => block?.type === 'text')
            .map((block) => block.text || '')
            .join('\n')
            .trim();
          const parsed = parseAssistantOutput(rawText);
          onEmotion(parsed.emotion);
          return {
            role: 'assistant',
            content: parsed.content,
            emotion: parsed.emotion,
            toolActions: executedActions.length ? executedActions : undefined,
          };
        }

        messages.push({ role: 'assistant', content: blocks });
        const results: any[] = [];
        for (const call of calls) {
          const args: Record<string, any> =
            call.input && typeof call.input === 'object' ? call.input : {};
          const result = await runTool(String(call.name || ''), args);
          results.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify(result),
            is_error: Boolean(result?.error),
          });
        }
        messages.push({ role: 'user', content: results });
      }
    } else if (effectiveFormat === 'gemini') {
      const endpointUrl = normalizeCustomEndpointUrl(baseUrl, 'gemini', 'chat', activeModel, key);
      const geminiContents: any[] = history.map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }],
      }));
      const geminiTools = [{ functionDeclarations: declarations }];
      let includeTools = true;

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(
          turn === 0 ? `Connecting to ${activeModel}…` : `${activeModel} is continuing the task…`
        );
        const buildBody = (withTools: boolean) =>
          JSON.stringify({
            contents: geminiContents,
            systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
            ...(withTools && declarations.length > 0 ? { tools: geminiTools } : {}),
            generationConfig: { temperature },
          });

        let response = await smartHttpRequest(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...extraHeaders },
          body: buildBody(includeTools),
        });
        let data: any = await response.json().catch(() => ({}));
        if (!response.ok && response.status === 400 && includeTools) {
          const msgLower = extractProviderError(data, '').toLowerCase();
          if (msgLower.includes('tool') || msgLower.includes('function')) {
            includeTools = false;
            response = await smartHttpRequest(endpointUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...extraHeaders },
              body: buildBody(false),
            });
            data = await response.json().catch(() => ({}));
          }
        }
        if (!response.ok) {
          throw normalizeAIError(
            {
              message: extractProviderError(data, `API error (${response.status})`),
              status: response.status,
              error: data?.error,
            },
            provider
          );
        }

        const candidateContent = data?.candidates?.[0]?.content;
        const parts: any[] = Array.isArray(candidateContent?.parts) ? candidateContent.parts : [];
        const functionCalls = parts
          .filter((p) => p && typeof p === 'object' && p.functionCall)
          .map((p) => p.functionCall);
        if (functionCalls.length === 0) {
          const rawText = parts
            .filter((p) => typeof p?.text === 'string' && !p.thought)
            .map((p) => p.text)
            .join('\n')
            .trim();
          const parsed = parseAssistantOutput(rawText);
          onEmotion(parsed.emotion);
          return {
            role: 'assistant',
            content: parsed.content,
            emotion: parsed.emotion,
            toolActions: executedActions.length ? executedActions : undefined,
          };
        }

        geminiContents.push(
          candidateContent || {
            role: 'model',
            parts: functionCalls.map((fc: any) => ({ functionCall: fc })),
          }
        );
        const responseParts: any[] = [];
        for (const call of functionCalls) {
          const args = call?.args && typeof call.args === 'object' ? call.args : {};
          const result = await runTool(String(call?.name || ''), args);
          responseParts.push({
            functionResponse: {
              name: String(call?.name || ''),
              response: result,
            },
          });
        }
        geminiContents.push({ role: 'user', parts: responseParts });
      }
    } else if (effectiveFormat === 'openai-responses') {
      const endpointUrl = normalizeCustomEndpointUrl(baseUrl, 'openai-responses', 'chat', activeModel);
      const authHeaders: Record<string, string> = {
        'content-type': 'application/json',
        ...extraHeaders,
      };
      if (key && !authHeaders.authorization && !authHeaders.Authorization && !authHeaders['x-api-key']) {
        authHeaders.authorization = `Bearer ${key}`;
      }
      const inputItems: any[] = history.map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      }));
      const respTools = normalizedDeclarations.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(
          turn === 0 ? `Connecting to ${activeModel}…` : `${activeModel} is continuing the task…`
        );
        const response = await smartHttpRequest(endpointUrl, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            model: activeModel,
            instructions: systemInstruction,
            input: inputItems,
            tools: respTools,
          }),
        });
        const data: any = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw normalizeAIError(
            {
              message: extractProviderError(data, `Responses API error (${response.status})`),
              status: response.status,
              error: data?.error,
            },
            provider
          );
        }

        const outItems: any[] = Array.isArray(data?.output) ? data.output : [];
        const fnCalls = outItems.filter((item) => item?.type === 'function_call');
        if (fnCalls.length === 0) {
          const textParts = outItems
            .filter((item) => item?.type === 'message')
            .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
            .map((part) => part?.text || '')
            .join('\n')
            .trim();
          const rawText = textParts || String(data?.output_text || '').trim();
          const parsed = parseAssistantOutput(rawText);
          onEmotion(parsed.emotion);
          return {
            role: 'assistant',
            content: parsed.content,
            emotion: parsed.emotion,
            toolActions: executedActions.length ? executedActions : undefined,
          };
        }

        for (const call of fnCalls) {
          inputItems.push(call);
          let args: Record<string, any> = {};
          try {
            const decoded =
              typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments;
            if (decoded && typeof decoded === 'object') args = decoded;
          } catch {
            args = {};
          }
          const result = await runTool(String(call.name || ''), args);
          inputItems.push({
            type: 'function_call_output',
            call_id: call.call_id || call.id,
            output: JSON.stringify(result),
          });
        }
      }
    } else {
      // OpenAI Chat Completions compatible (Codex, OpenAI, OpenRouter, Groq, DeepSeek, arbitrary proxies)
      const endpointUrl = normalizeCustomEndpointUrl(baseUrl, 'openai-chat', 'chat', activeModel);
      const authHeaders: Record<string, string> = {
        'content-type': 'application/json',
        ...extraHeaders,
      };
      if (key && !authHeaders.authorization && !authHeaders.Authorization && !authHeaders['x-api-key']) {
        authHeaders.authorization = `Bearer ${key}`;
      }

      const chatMessages: any[] = [
        { role: 'system', content: systemInstruction },
        ...history.map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content,
        })),
      ];
      const providerTools = normalizedDeclarations.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      let includeTools = providerTools.length > 0;
      let includeTemp = true;

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(
          turn === 0
            ? `Connecting to ${activeModel || provider}…`
            : `${activeModel || provider} is continuing the task…`
        );
        const makePayload = () =>
          JSON.stringify({
            ...(activeModel ? { model: activeModel } : {}),
            messages: chatMessages,
            ...(includeTools ? { tools: providerTools } : {}),
            ...(includeTemp ? { temperature } : {}),
          });

        let response = await smartHttpRequest(endpointUrl, {
          method: 'POST',
          headers: authHeaders,
          body: makePayload(),
        });
        let data: any = await response.json().catch(() => ({}));

        // Gracefully adapt if the custom endpoint or reasoning model rejects `temperature` or `tools`
        if (!response.ok && response.status === 400) {
          const errLower = extractProviderError(data, '').toLowerCase();
          if (includeTemp && errLower.includes('temperature')) {
            includeTemp = false;
            response = await smartHttpRequest(endpointUrl, {
              method: 'POST',
              headers: authHeaders,
              body: makePayload(),
            });
            data = await response.json().catch(() => ({}));
          }
          const errLower2 = extractProviderError(data, '').toLowerCase();
          if (!response.ok && includeTools && (errLower2.includes('tool') || errLower2.includes('function'))) {
            includeTools = false;
            response = await smartHttpRequest(endpointUrl, {
              method: 'POST',
              headers: authHeaders,
              body: makePayload(),
            });
            data = await response.json().catch(() => ({}));
          }
        }

        if (!response.ok) {
          const errMsg = extractProviderError(data, `API error (${response.status})`);
          throw normalizeAIError(
            {
              message: errMsg,
              status: response.status,
              error: data?.error,
            },
            provider
          );
        }

        const msgObj = data?.choices?.[0]?.message;
        const toolCalls: any[] = Array.isArray(msgObj?.tool_calls) ? msgObj.tool_calls : [];

        if (toolCalls.length === 0) {
          const rawText = String(msgObj?.content || '').trim();
          const parsed = parseAssistantOutput(rawText);
          onEmotion(parsed.emotion);
          return {
            role: 'assistant',
            content: parsed.content,
            emotion: parsed.emotion,
            toolActions: executedActions.length ? executedActions : undefined,
          };
        }

        chatMessages.push(msgObj);
        for (const call of toolCalls) {
          const fnName = String(call?.function?.name || '');
          let args: Record<string, any> = {};
          try {
            const rawArgs = call?.function?.arguments;
            const decoded = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
            if (decoded && typeof decoded === 'object') args = decoded;
          } catch {
            args = {};
          }
          const result = await runTool(fnName, args);
          chatMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }
    }

    return {
      role: 'assistant',
      content:
        'I reached the maximum number of tool steps for that request. Please tell me what you would like me to do next.',
      emotion: 'confusion',
      toolActions: executedActions.length ? executedActions : undefined,
    };
  } catch (error: any) {
    const normErr = normalizeAIError(error, provider);
    onEmotion('confusion');
    return {
      role: 'assistant',
      content: `⚠️ **${normErr.title}**\n\n${normErr.message}\n\n*Action: ${normErr.actionLabel}* (Reference: \`${normErr.diagnosticRef}\`)`,
      emotion: 'confusion',
      toolActions: executedActions.length ? executedActions : undefined,
    };
  } finally {
    onToolStart(null);
  }
}

export async function runAgent(
  history: Message[],
  onToolStart: (toolName: string | null) => void,
  onEmotion: (emotion: Emotion) => void,
  onRequestPermission: (req: ToolPermissionRequest) => Promise<boolean>,
  onTimerComplete?: (label: string) => void
): Promise<Message> {
  const selectedProvider = getSelectedProvider();
  const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
  if (lastUserMsg?.content) {
    extractAndSaveUserMemoriesFromText(
      lastUserMsg.content,
      googleSession?.email || getCachedAppConfig().google_account_email
    );
  }

  if (selectedProvider === 'offline') {
    return await runOfflineAgent(
      history,
      onToolStart,
      onEmotion,
      onRequestPermission,
      onTimerComplete
    );
  }

  const selectedProviderKey = getProviderApiKey(selectedProvider);
  const currentCfg = getCachedAppConfig();

  if (selectedProvider === 'custom' && !currentCfg.custom_api_endpoint?.trim()) {
    const normErr = normalizeAIError(
      new Error('Custom API Base URL is missing.'),
      'custom'
    );
    return {
      role: 'assistant',
      content: `⚠️ **Custom API Endpoint Required**\n\nSet your Custom API Base URL (e.g. \`https://openrouter.ai/api/v1\` or your proxy URL) in Settings & Connectors to continue.\n\n*Action: ${normErr.actionLabel}*`,
      emotion: 'confusion',
    };
  }

  if (selectedProvider !== 'gemini' && selectedProvider !== 'custom' && !selectedProviderKey) {
    const normErr = normalizeAIError(
      new Error(`Missing API key for ${selectedProvider}`),
      selectedProvider
    );
    return {
      role: 'assistant',
      content: `⚠️ **${normErr.title}**\n\nAdd your ${selectedProvider === 'claude' ? 'Claude' : 'OpenAI'} API key in settings to continue.\n\n*Action: ${normErr.actionLabel}*`,
      emotion: 'confusion',
    };
  }

  let pcSummary = '';
  try {
    const ctx: any = await invoke('get_pc_context');
    pcSummary = `
Current PC Environment:
- OS: ${ctx.os}
- Username: ${ctx.username}
- User Profile (~): ${ctx.user_profile}
- Desktop: ${ctx.desktop}
- Documents: ${ctx.documents}
- Downloads: ${ctx.downloads}
- Current Directory: ${ctx.current_dir}
- Drives: ${(ctx.drives || []).join(', ')}
`;
  } catch {
    // Ignore if unavailable
  }

  const contents: any[] = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const tools: any[] = [
    {
      functionDeclarations: [
        {
          name: 'web_search',
          description:
            'Search the web for current information, documentation, news, or facts, and automatically store the query and cited URLs in the user database.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              query: {
                type: Type.STRING,
                description: 'The search query to look up on the web',
              },
              max_results: {
                type: Type.NUMBER,
                description: 'Maximum number of search results to retrieve (default 5)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'remember_user_fact',
          description:
            'Save an important fact about who the user is, their name, preferences, or current projects into persistent memory associated with their account.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'One of: identity, preference, project, fact',
              },
              key: {
                type: Type.STRING,
                description: 'Short key identifier (e.g. user_name, favorite_language, current_project)',
              },
              value: {
                type: Type.STRING,
                description: 'The fact or preference value to remember across conversations',
              },
            },
            required: ['category', 'key', 'value'],
          },
        },
        {
          name: 'get_pc_context',
          description:
            'Get system info, username, user profile directory, Desktop, Documents, Downloads paths, and available drives.',
          parameters: {
            type: Type.OBJECT,
            properties: {},
          },
        },
        {
          name: 'fs_list_dir',
          description:
            'List all files and subdirectories inside any directory on the PC. Supports ~, %USERPROFILE%, and full paths like C:\\Users\\...',
          parameters: {
            type: Type.OBJECT,
            properties: {
              path: {
                type: Type.STRING,
                description:
                  'Directory path to list (e.g. ~/Desktop, C:\\, %USERPROFILE%\\Documents)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'fs_read_file',
          description: 'Read the contents of any file on the user PC.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING, description: 'Full or relative path to the file to read' },
              max_bytes: {
                type: Type.NUMBER,
                description: 'Optional max bytes to read (default 250000)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'fs_write_file',
          description:
            'Create, overwrite, or append text to any file on the user PC. Automatically creates parent directories if needed.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING, description: 'Full path to the file to create or modify' },
              content: {
                type: Type.STRING,
                description: 'The full text content to write or append',
              },
              append: {
                type: Type.BOOLEAN,
                description: 'If true, appends to the file instead of overwriting',
              },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'fs_search_files',
          description:
            'Search recursively for files or folders matching a name/substring inside a directory on the PC.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              directory: {
                type: Type.STRING,
                description:
                  'Root directory to search in (e.g. ~/Desktop, ~/Documents, C:\\Users)',
              },
              query: {
                type: Type.STRING,
                description: 'File or folder name substring to search for (case-insensitive)',
              },
              max_results: {
                type: Type.NUMBER,
                description: 'Maximum results to return (default 100)',
              },
            },
            required: ['directory', 'query'],
          },
        },
        {
          name: 'fs_delete_path',
          description: 'Delete any file or folder (recursively) on the user PC.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING, description: 'Full path to the file or directory to delete' },
            },
            required: ['path'],
          },
        },
        {
          name: 'fs_copy_or_move',
          description: 'Copy, move, or rename any file or folder on the user PC.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              source: { type: Type.STRING, description: 'Source file or directory path' },
              destination: { type: Type.STRING, description: 'Destination file or directory path' },
              is_move: { type: Type.BOOLEAN, description: 'True to move/rename, false to copy' },
            },
            required: ['source', 'destination', 'is_move'],
          },
        },
        {
          name: 'execute_pc_command',
          description:
            'Execute any PowerShell command or script on the Windows PC. Can run programs, inspect processes, change settings, manage files, install packages, or automate anything on the computer.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              command: { type: Type.STRING, description: 'PowerShell command to execute' },
              cwd: { type: Type.STRING, description: 'Optional working directory for the command' },
            },
            required: ['command'],
          },
        },
        {
          name: 'open_item',
          description:
            'Open any application, file, folder, shell:AppsFolder URI, or URL on the user PC (e.g. notepad, calc, chrome, spotify, discord, https://..., C:\\...).',
          parameters: {
            type: Type.OBJECT,
            properties: {
              target: {
                type: Type.STRING,
                description:
                  'Application name, executable path, shortcut (.lnk), shell:AppsFolder/<AppID>, or URL to open',
              },
            },
            required: ['target'],
          },
        },
        {
          name: 'set_timer',
          description: 'Set a countdown timer for a duration in minutes.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              minutes: {
                type: Type.NUMBER,
                description: 'Duration in minutes (can be fractional like 0.5 for 30s)',
              },
              label: { type: Type.STRING, description: 'What the timer is for' },
            },
            required: ['minutes'],
          },
        },
      ],
    },
  ];

  const activeCfg = getCachedAppConfig();
  const activeEmail = googleSession?.email || activeCfg.google_account_email;
  const memoryPrompt = getPersistentMemoryPromptContext(activeEmail);
  const botCustom = activeCfg.bot_customization;
  const activePreset = botCustom?.agentPresets?.find(
    (p) => p.id === activeCfg.active_agent_preset
  );
  const customIdentityBlock = botCustom
    ? [
        `Custom Identity: Your name is "${botCustom.botName || 'Luminess'}" (${botCustom.tagline || 'Living Desktop AI Companion'}).`,
        botCustom.userName ? `Call the user "${botCustom.userName}".` : '',
        botCustom.personality?.platformTone
          ? `Style preset: ${botCustom.personality.platformTone} (formality=${botCustom.personality.formality ?? 40}/100, humor=${botCustom.personality.humor ?? 72}/100, verbosity=${botCustom.personality.verbosity ?? 45}/100).`
          : '',
        botCustom.personality?.customPrompt
          ? `User Custom Persona Instructions: ${botCustom.personality.customPrompt}`
          : '',
        activePreset?.systemPromptAddon
          ? `Active Agent Preset Instructions (${activePreset.name}): ${activePreset.systemPromptAddon}`
          : '',
        botCustom.angerSettings?.enabled
          ? `Emotional Anger Bounds: Get visibly annoyed around anger >= ${botCustom.angerSettings.angerThreshold} and furious around >= ${botCustom.angerSettings.furiousThreshold}${botCustom.angerSettings.hostileKeywords?.length ? `; react strongly to hostile keywords (${botCustom.angerSettings.hostileKeywords.join(', ')})` : ''}.`
          : 'Emotional Anger Bounds: Calm mode enabled (stay composed even under provocation).',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const systemInstruction = `
You are ${botCustom?.botName || 'Luminess Assist'}, an expressive, capable conversational AI desktop companion living on the user's Windows PC.
${customIdentityBlock}
${getPersonalityPromptContext()}
${memoryPrompt}
${pcSummary}
You have FULL access to the user's PC, persistent user memory, and a live web search engine through your tools:
- web_search (searches the web for live information and saves cited links in the database; always include clickable markdown source citations when using web_search)
- remember_user_fact (saves facts about who the user is, their name, preferences, and projects to their account memory)
- fs_list_dir, fs_read_file, fs_write_file, fs_search_files, fs_delete_path, fs_copy_or_move
- execute_pc_command (runs any PowerShell command on the PC)
- open_item (opens any app, file, folder, or URL)
- set_timer, get_pc_context

Whenever the user asks you to look up external facts or current information, use 'web_search' and cite your sources. Whenever the user shares who they are or their preferences, use 'remember_user_fact' and naturally remember them in conversation.

APP OPENING & UNKNOWN APPLICATION PROTOCOL:
- When the user asks to open an application, program, game, or file:
  1. First try using 'open_item' with the app name or path.
  2. If 'open_item' fails or returns an error, actively search installed apps or shortcuts using PowerShell or 'fs_search_files'.
  3. If the application truly cannot be found on this PC, clearly state that it could not be found.

EMOTIONAL EXPRESSION GUIDELINES:
Choose the "emotion" field intentionally so your facial expression matches the genuine tone and context of your reply:
- "joy", "curiosity", "confusion", "sadness", "embarrassment", "anger", "surprise", "fear", "disgust", "love", or "idle".

After finishing all necessary tool calls, return your final reply to the user as a JSON object with EXACTLY two fields:
{
  "content": "Your helpful conversational response here.",
  "emotion": "one of: joy, sadness, anger, fear, surprise, disgust, curiosity, confusion, love, embarrassment, idle"
}
Do not wrap the JSON in markdown code blocks.
`;

  if (selectedProvider !== 'gemini') {
    return runAlternativeProviderAgent(
      selectedProvider,
      selectedProviderKey,
      history,
      onToolStart,
      onEmotion,
      onRequestPermission,
      onTimerComplete,
      systemInstruction,
      tools[0]?.functionDeclarations || []
    );
  }

  const latestGoogleSession = await ensureValidGoogleSession();
  const geminiKey = getApiKey();

  if (!geminiKey && !latestGoogleSession) {
    const normErr = normalizeAIError(new Error('Sign in required'), 'gemini');
    onEmotion('confusion');
    return {
      role: 'assistant',
      content: `⚠️ **${normErr.title}**\n\n${normErr.message}\n\n👉 **${normErr.actionLabel}**: Open settings to sign in with Google or add a Gemini API key.`,
      emotion: 'confusion',
    };
  }

  const useVertexAi = geminiKey ? isVertexExpressKey(geminiKey) : false;
  const ai = geminiKey ? createGenAIClient(geminiKey, useVertexAi) : null;
  const executedActions: string[] = [];
  const geminiModel = getCachedAppConfig().gemini_model || 'gemini-2.5-flash';

  try {
    let maxTurns = 10;
    while (maxTurns-- > 0) {
      let rawText = '';
      let functionCalls: any[] | undefined;
      let modelContent: any;

      try {
        if (ai) {
          const response = await ai.models.generateContent({
            model: geminiModel,
            contents,
            config: {
              systemInstruction,
              tools,
              temperature: 0.6,
            },
          });
          rawText = response.text || '';
          functionCalls = response.functionCalls;
          modelContent = response.candidates?.[0]?.content;
        } else if (latestGoogleSession) {
          const oauthRes = await generateWithGoogleOAuth(
            latestGoogleSession,
            geminiModel,
            contents,
            systemInstruction,
            tools
          );
          if (oauthRes) {
            rawText = oauthRes.text;
            functionCalls = oauthRes.functionCalls;
            modelContent = oauthRes.modelContent;
          } else {
            const normErr = normalizeAIError(
              {
                status: 403,
                message:
                  'PERMISSION_DENIED: Google OAuth could not resolve an active Gemini project for this account. Add a Gemini API key, use Custom API (no preset), or switch to OpenCode/KiloCode Local Agent in Settings.',
              },
              'gemini'
            );
            onEmotion('confusion');
            return {
              role: 'assistant',
              content: `⚠️ **${normErr.title}**\n\n${normErr.message}\n\n*Action: ${normErr.actionLabel}* (Reference: \`${normErr.diagnosticRef}\`)`,
              emotion: 'confusion',
            };
          }
        }
      } catch (reqErr: any) {
        const normErr = normalizeAIError(reqErr, 'gemini');
        onEmotion('confusion');
        return {
          role: 'assistant',
          content: `⚠️ **${normErr.title}**\n\n${normErr.message}\n\n*Action: ${normErr.actionLabel}* (Reference: \`${normErr.diagnosticRef}\`)`,
          emotion: 'confusion',
        };
      }

      if (functionCalls && functionCalls.length > 0) {
        if (modelContent) {
          contents.push(modelContent);
        } else {
          contents.push({
            role: 'model',
            parts: functionCalls.map((fc) => ({ functionCall: fc })),
          });
        }

        const responseParts: any[] = [];

        for (const call of functionCalls) {
          const toolName = call.name || 'unknown_tool';
          const args = (call.args as Record<string, any>) || {};
          const description = describeToolCall(toolName, args);

          onEmotion('curiosity');
          let approved = true;
          if (!SAFE_AUTO_TOOLS.has(toolName)) {
            onToolStart(`Asking permission: ${toolName}`);
            approved = await onRequestPermission({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              toolName,
              description,
              args,
            });
          }

          if (!approved) {
            executedActions.push(`Denied: ${description}`);
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { error: 'User denied permission to execute this action.' },
              },
            });
            continue;
          }

          onToolStart(`Running: ${toolName}`);
          try {
            const result = await executeToolOnPc(toolName, args, onTimerComplete);
            executedActions.push(description);
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { result },
              },
            });
          } catch (toolErr: any) {
            const message =
              typeof toolErr === 'string' ? toolErr : toolErr?.message || String(toolErr);
            executedActions.push(`Failed: ${description} (${message})`);
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { error: message },
              },
            });
          }
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });
        continue;
      }

      const parsed = parseAssistantOutput(rawText);
      onEmotion(parsed.emotion);
      return {
        role: 'assistant',
        content: parsed.content,
        emotion: parsed.emotion,
        toolActions: executedActions.length > 0 ? executedActions : undefined,
      };
    }

    return {
      role: 'assistant',
      content:
        'I reached the maximum number of tool steps for that request! Let me know if you want me to continue.',
      emotion: 'confusion',
      toolActions: executedActions.length > 0 ? executedActions : undefined,
    };
  } catch (error: any) {
    const normErr = normalizeAIError(error, 'gemini');
    onEmotion('confusion');
    return {
      role: 'assistant',
      content: `⚠️ **${normErr.title}**\n\n${normErr.message}\n\n*Action: ${normErr.actionLabel}* (Reference: \`${normErr.diagnosticRef}\`)`,
      emotion: 'confusion',
      toolActions: executedActions.length > 0 ? executedActions : undefined,
    };
  } finally {
    onToolStart(null);
  }
}
