import { GoogleGenAI, Type } from '@google/genai';
import { invoke } from '@tauri-apps/api/core';
import type { Emotion } from '../components/Robot.tsx';
import { getPersonalityPromptContext } from './personality.ts';
import {
  normalizeAIError,
  type NormalizedAIError,
  type AIErrorKind,
  type AIConnectionState,
} from './aiErrors.ts';

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

const STORAGE_KEY = 'GEMINI_API_KEY';
const GOOGLE_AUTH_STORAGE_KEY = 'LUMINESS_GOOGLE_AUTH';
const OAUTH_CLIENT_CACHE_KEY = 'LUMINESS_GOOGLE_OAUTH_CLIENT';

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
  if (envClientId) {
    return {
      clientId: String(envClientId).trim(),
      clientSecret: envClientSecret ? String(envClientSecret).trim() : undefined,
    };
  }

  try {
    const cached = localStorage.getItem(OAUTH_CLIENT_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.clientId) {
        return parsed as OAuthClientConfig;
      }
    }
  } catch {
    // ignore cache error
  }

  return {
    clientId: DEFAULT_GOOGLE_CLIENT_ID,
    clientSecret: DEFAULT_GOOGLE_CLIENT_SECRET,
  };
}

let apiKey = localStorage.getItem(STORAGE_KEY) || '';
let googleSession: GoogleUserSession | null = loadSavedGoogleSession();

function loadSavedGoogleSession(): GoogleUserSession | null {
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.accessToken || parsed.refreshToken)) {
      return parsed as GoogleUserSession;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

function saveGoogleSession(session: GoogleUserSession | null) {
  googleSession = session;
  if (session) {
    localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
  }
}

export function getGoogleSession(): GoogleUserSession | null {
  return googleSession;
}

export function logoutGoogle() {
  saveGoogleSession(null);
}

export function hasAuthSession(): boolean {
  return Boolean(googleSession || (apiKey && apiKey.trim().length > 0));
}

export function getApiKey(): string {
  return apiKey;
}

export function setApiKey(key: string) {
  apiKey = key.trim();
  if (apiKey) {
    localStorage.setItem(STORAGE_KEY, apiKey);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasApiKey(): boolean {
  return !!apiKey && apiKey.trim().length > 0;
}

export type AIProvider = 'gemini' | 'claude' | 'codex';

const PROVIDER_KEY_STORAGE: Record<Exclude<AIProvider, 'gemini'>, string> = {
  claude: 'LUMINESS_CLAUDE_API_KEY',
  codex: 'LUMINESS_CODEX_API_KEY',
};
const SELECTED_PROVIDER_STORAGE_KEY = 'LUMINESS_SELECTED_PROVIDER';

export function getProviderApiKey(provider: AIProvider): string {
  if (provider === 'gemini') return getApiKey();
  return localStorage.getItem(PROVIDER_KEY_STORAGE[provider]) || '';
}

export function setProviderApiKey(provider: AIProvider, key: string): void {
  const cleaned = key.trim();
  if (provider === 'gemini') {
    setApiKey(cleaned);
    return;
  }
  const storageKey = PROVIDER_KEY_STORAGE[provider];
  if (cleaned) localStorage.setItem(storageKey, cleaned);
  else localStorage.removeItem(storageKey);
}

export function getSelectedProvider(): AIProvider {
  const saved = localStorage.getItem(SELECTED_PROVIDER_STORAGE_KEY);
  return saved === 'gemini' || saved === 'claude' || saved === 'codex' ? saved : 'gemini';
}

export function setSelectedProvider(provider: AIProvider): void {
  localStorage.setItem(SELECTED_PROVIDER_STORAGE_KEY, provider);
}

export function hasAnyProviderKey(): boolean {
  return Boolean(getProviderApiKey('gemini') || getProviderApiKey('claude') || getProviderApiKey('codex'));
}

export function hasAnyConfiguredProvider(): boolean {
  return hasAnyProviderKey();
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
  const key = (keyOverride !== undefined ? keyOverride : getProviderApiKey(provider)).trim();

  if (provider === 'gemini') {
    if (!key) {
      if (googleSession) {
        return {
          success: false,
          error: normalizeAIError(
            new Error(
              'ACCESS_TOKEN_TYPE_UNSUPPORTED: Google identity is connected, but a Gemini API key is required to activate the model.'
            ),
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
      const probeUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
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
          model: 'claude-sonnet-5-5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
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
            'claude'
          ),
        };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: normalizeAIError(err, 'claude') };
    }
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

  const session: GoogleUserSession = {
    accessToken,
    refreshToken,
    expiryDate,
    email,
    name,
    picture,
  };

  saveGoogleSession(session);
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
    default:
      return `Execute ${name} with ${JSON.stringify(args)}`;
  }
}

async function executeToolOnPc(
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

async function runAlternativeProviderAgent(
  provider: Exclude<AIProvider, 'gemini'>,
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
    onToolStart(`Asking permission: ${toolName}`);
    const approved = await onRequestPermission({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      toolName,
      description,
      args,
    });

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

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(turn === 0 ? 'Connecting to Claude…' : 'Claude is continuing the task…');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-5-5',
            max_tokens: 4096,
            system: systemInstruction,
            messages,
            tools: providerTools,
          }),
        });
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
      const input: any[] = history.map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      }));
      const providerTools = normalizedDeclarations.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: false,
      }));

      for (let turn = 0; turn < maxTurns; turn++) {
        onToolStart(turn === 0 ? 'Connecting to OpenAI…' : 'OpenAI is continuing the task…');
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'gpt-5.5',
            instructions: systemInstruction,
            input,
            tools: providerTools,
            max_output_tokens: 4096,
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

        const output: any[] = Array.isArray(data.output) ? data.output : [];
        const calls = output.filter((item) => item?.type === 'function_call');
        if (calls.length === 0) {
          const rawText = String(
            data.output_text ||
              output
                .filter((item) => item?.type === 'message')
                .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
                .filter((part) => part?.type === 'output_text' || part?.type === 'text')
                .map((part) => part.text || '')
                .join('\n')
          ).trim();
          const parsed = parseAssistantOutput(rawText);
          onEmotion(parsed.emotion);
          return {
            role: 'assistant',
            content: parsed.content,
            emotion: parsed.emotion,
            toolActions: executedActions.length ? executedActions : undefined,
          };
        }

        input.push(...output);
        for (const call of calls) {
          let args: Record<string, any> = {};
          try {
            const decoded =
              typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments;
            if (decoded && typeof decoded === 'object') args = decoded;
          } catch {
            args = {};
          }
          const result = await runTool(String(call.name || ''), args);
          input.push({
            type: 'function_call_output',
            call_id: call.call_id || call.id,
            output: JSON.stringify(result),
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

  const systemInstruction = `
You are Luminess Assist, an expressive, capable robotic desktop companion living on the user's Windows PC.
${getPersonalityPromptContext()}
${pcSummary}
You have FULL access to the user's PC and every file on the computer through your tools:
- fs_list_dir, fs_read_file, fs_write_file, fs_search_files, fs_delete_path, fs_copy_or_move
- execute_pc_command (runs any PowerShell command on the PC)
- open_item (opens any app, file, folder, or URL)
- set_timer, get_pc_context

Whenever the user asks you to inspect files, create/edit/delete files, run commands, open apps, check PC status, or do anything on their computer, ALWAYS use the appropriate tool(s). The app will automatically ask the user for confirmation before executing your tool call.

APP OPENING & UNKNOWN APPLICATION PROTOCOL:
- When the user asks to open an application, program, game, or file:
  1. First try using 'open_item' with the app name or path.
  2. If 'open_item' fails or returns an error, or if an app is unknown or unrecognized:
     DO NOT GIVE UP! Actively find another way to locate and open it:
     - Search installed Windows and Store apps using 'execute_pc_command' with PowerShell:
       Get-StartApps | Where-Object { $_.Name -like "*<name>*" -or $_.AppID -like "*<name>*" }
     - Search Start Menu shortcuts:
       Get-ChildItem -Path "$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:APPDATA\Microsoft\Windows\Start Menu\Programs" -Recurse -Filter "*<name>*.lnk"
     - Search user install directories (LocalAppData, Program Files) using 'fs_search_files' or PowerShell.
     - If found, open it using 'open_item' with the full path, shortcut path, or 'shell:AppsFolder\\<AppID>'.
  3. If you have searched and tried alternate methods and the application truly cannot be found or opened on this PC:
     Clearly and honestly state that it cannot be opened (e.g. "I couldn't open [App Name] because it could not be found on your PC. It might not be installed.").
     NEVER claim that you opened an application if it could not be opened or failed!

EMOTIONAL EXPRESSION GUIDELINES:
Choose the "emotion" field intentionally so your facial expression matches the genuine tone and context of your reply. Do NOT default to "joy" when another expression fits better:
- "joy": Friendly greetings, exciting news, jokes, playful banter, or celebrating a big win.
- "curiosity": Exploring files, investigating an interesting discovery, analyzing a problem, or asking a thoughtful follow-up question.
- "confusion": Ambiguous, contradictory, or puzzling questions where you need clarification.
- "sadness": Sympathizing with user frustration, delivering unfortunate news, or when something requested cannot be found.
- "embarrassment": Apologizing for a mistake, a failed command, or a misunderstanding.
- "anger": Playfully indignant reactions to teasing, or sharing in the user's annoyance at a stubborn bug or error.
- "surprise": Unexpected discoveries, startling findings, or impressive results.
- "fear": Cautious warnings about risky or destructive operations (such as deleting files or modifying system state).
- "disgust": Reacting to messy, corrupted, or unpleasant content.
- "love": Warm responses to compliments, affection, gratitude, or kindness from the user.
- "idle": Calm, neutral, matter-of-fact explanations, status reports, or straightforward answers where a neutral/thoughtful expression is most natural.

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

  if (!apiKey) {
    if (latestGoogleSession) {
      const normErr = normalizeAIError(
        new Error(
          'ACCESS_TOKEN_TYPE_UNSUPPORTED: Google identity is connected, but a Gemini API key is required to activate the AI engine.'
        ),
        'gemini'
      );
      onEmotion('confusion');
      return {
        role: 'assistant',
        content: `⚠️ **${normErr.title}**\n\n${normErr.message}\n\n👉 **${normErr.actionLabel}**: Click Settings to enter a free Gemini API key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).`,
        emotion: 'confusion',
      };
    }
    const normErr = normalizeAIError(new Error('Sign in required'), 'gemini');
    onEmotion('confusion');
    return {
      role: 'assistant',
      content: `⚠️ **${normErr.title}**\n\n${normErr.message}\n\n👉 **${normErr.actionLabel}**: Open settings to sign in or add a Gemini API key.`,
      emotion: 'confusion',
    };
  }

  const useVertexAi = isVertexExpressKey(apiKey);
  const ai = createGenAIClient(apiKey, useVertexAi);
  const executedActions: string[] = [];

  try {
    let maxTurns = 10;
    while (maxTurns-- > 0) {
      let rawText = '';
      let functionCalls: any[] | undefined;
      let modelContent: any;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
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
          onToolStart(`Asking permission: ${toolName}`);

          const approved = await onRequestPermission({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            toolName,
            description,
            args,
          });

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
      content: 'I completed the maximum number of steps for that request.',
      emotion: 'confusion',
      toolActions: executedActions.length > 0 ? executedActions : undefined,
    };
  } catch (error: any) {
    const normErr = normalizeAIError(error, selectedProvider);
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
