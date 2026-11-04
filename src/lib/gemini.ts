import { GoogleGenAI, Type } from '@google/genai';
import { invoke } from '@tauri-apps/api/core';
import type { Emotion } from '../components/Robot.tsx';
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

export type AIProvider = 'gemini' | 'claude' | 'codex' | 'offline';

const LEGACY_PROVIDER_KEY_STORAGE: Record<Exclude<AIProvider, 'gemini' | 'offline'>, string> = {
  claude: 'LUMINESS_CLAUDE_API_KEY',
  codex: 'LUMINESS_CODEX_API_KEY',
};
const SELECTED_PROVIDER_STORAGE_KEY = 'LUMINESS_SELECTED_PROVIDER';

// In-memory runtime cache synced with the Windows DPAPI machine credential vault
const machineKeysCache: Record<Exclude<AIProvider, 'offline'>, string> = {
  gemini: '',
  claude: '',
  codex: '',
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
 * Loads all three provider API keys and the Google OAuth session from the Windows DPAPI machine vault
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

  const oauthJson = googleSession ? JSON.stringify(googleSession) : '';
  try {
    await invoke<MachineCredentialsVault>('save_machine_credentials', {
      geminiApiKey: machineKeysCache.gemini,
      claudeApiKey: machineKeysCache.claude,
      codexApiKey: machineKeysCache.codex,
      searchApiKey: null,
      googleOauthSessionJson: oauthJson,
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_GEMINI_STORAGE_KEY);
      localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.claude);
      localStorage.removeItem(LEGACY_PROVIDER_KEY_STORAGE.codex);
    }
  } catch {
    // Fallback outside Tauri runtime
  }
}

export function getSelectedProvider(): AIProvider {
  if (typeof localStorage === 'undefined') return 'gemini';
  const saved = localStorage.getItem(SELECTED_PROVIDER_STORAGE_KEY);
  return saved === 'gemini' || saved === 'claude' || saved === 'codex' || saved === 'offline' ? saved : 'gemini';
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
  if (getSelectedProvider() === 'offline') return true;
  return Boolean(
    googleSession ||
      getProviderApiKey('gemini') ||
      getProviderApiKey('claude') ||
      getProviderApiKey('codex')
  );
}

export function hasAnyConfiguredProvider(): boolean {
  return hasAnyProviderKey();
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
 * Actively verifies whether the given AI provider and credentials can successfully
 * communicate with the AI model service.
 */
export async function verifyProviderConnection(
  provider: AIProvider,
  keyOverride?: string
): Promise<{ success: boolean; error?: NormalizedAIError }> {
  if (provider === 'offline') {
    return { success: true };
  }
  const key = (keyOverride !== undefined ? keyOverride : getProviderApiKey(provider)).trim();

  if (provider === 'gemini') {
    if (!key) {
      if (googleSession && googleSession.accessToken) {
        // Signed-in Google OAuth session is active!
        return { success: true };
      }
      return {
        success: false,
        error: normalizeAIError(new Error('Sign in required'), 'gemini'),
      };
    }

    try {
      const model = getCachedAppConfig().gemini_model || 'gemini-2.5-flash';
      const probeUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const resp = await fetch(probeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      return { success: true };
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

    const candidateModels = [
      getCachedAppConfig().claude_model || 'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-latest',
      'claude-3-haiku-20240307',
    ];

    let lastErr: any = null;
    for (const model of candidateModels) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });

        if (resp.ok) {
          return { success: true };
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

    try {
      const resp = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${key}`,
        },
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
            'codex'
          ),
        };
      }

      return { success: true };
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

  try {
    if (provider === 'claude') {
      const messages: any[] = history.map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      }));
      const providerTools = normalizedDeclarations.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      const claudeModel = getCachedAppConfig().claude_model || 'claude-sonnet-4-20250514';

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(turn === 0 ? 'Connecting to Claude…' : 'Claude is continuing the task…');
        let response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: claudeModel,
            max_tokens: 4096,
            system: systemInstruction,
            messages,
            tools: providerTools,
          }),
        });

        // Automatic fallback if model alias differs on the user's Anthropic tier
        if (response.status === 404 && claudeModel !== 'claude-3-5-sonnet-latest') {
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-latest',
              max_tokens: 4096,
              system: systemInstruction,
              messages,
              tools: providerTools,
            }),
          });
        }

        const data: any = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errMsg = extractProviderError(data, `Claude API error (${response.status})`);
          throw normalizeAIError(
            {
              message: errMsg,
              status: response.status,
              error: data?.error,
            },
            'claude'
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
    } else {
      // OpenAI (Codex) via standard /v1/chat/completions
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
      const codexModel = getCachedAppConfig().codex_model || 'gpt-4o';

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(turn === 0 ? 'Connecting to OpenAI…' : 'OpenAI is continuing the task…');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: codexModel,
            messages: chatMessages,
            tools: providerTools,
            temperature: 0.6,
          }),
        });
        const data: any = await response.json().catch(() => ({}));
        if (!response.ok) {
          const errMsg = extractProviderError(data, `OpenAI API error (${response.status})`);
          throw normalizeAIError(
            {
              message: errMsg,
              status: response.status,
              error: data?.error,
            },
            'codex'
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

  if (selectedProvider !== 'gemini' && !selectedProviderKey) {
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

  const activeEmail = googleSession?.email || getCachedAppConfig().google_account_email;
  const memoryPrompt = getPersistentMemoryPromptContext(activeEmail);

  const systemInstruction = `
You are Luminess Assist, an expressive, capable conversational AI desktop companion living on the user's Windows PC.
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
            // Seamlessly fall back to local conversational AI with search & memory if Google Cloud project isn't provisioned yet
            return await runOfflineAgent(
              history,
              onToolStart,
              onEmotion,
              onRequestPermission,
              onTimerComplete
            );
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
