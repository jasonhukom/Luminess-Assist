import { GoogleGenAI, Type } from '@google/genai';
import { invoke } from '@tauri-apps/api/core';
import type { Emotion } from '../components/Robot.tsx';

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
}

const STORAGE_KEY = 'GEMINI_API_KEY';
const GOOGLE_AUTH_STORAGE_KEY = 'LUMINESS_GOOGLE_AUTH';
const OAUTH_CLIENT_CACHE_KEY = 'LUMINESS_GOOGLE_OAUTH_CLIENT';
const PUBLIC_GEMINI_CLI_OAUTH_URL =
  'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/packages/core/src/code_assist/oauth2.ts';
const CODE_ASSIST_BASE_URL = 'https://cloudcode-pa.googleapis.com/v1internal';

interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

async function getOAuthClientConfig(): Promise<OAuthClientConfig> {
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const envClientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  if (envClientId && envClientSecret) {
    return { clientId: String(envClientId), clientSecret: String(envClientSecret) };
  }

  try {
    const cached = localStorage.getItem(OAUTH_CLIENT_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.clientId && parsed?.clientSecret) {
        return parsed as OAuthClientConfig;
      }
    }
  } catch {
    // ignore cache error
  }

  const resp = await fetch(PUBLIC_GEMINI_CLI_OAUTH_URL);
  if (!resp.ok) {
    throw new Error('Failed to load Google OAuth configuration.');
  }
  const source = await resp.text();
  const idMatch = source.match(/OAUTH_CLIENT_ID\s*=\s*['"]([^'"]+)['"]/);
  const secretMatch = source.match(/OAUTH_CLIENT_SECRET\s*=\s*['"]([^'"]+)['"]/);

  if (!idMatch?.[1] || !secretMatch?.[1]) {
    throw new Error('Could not parse public OAuth client configuration.');
  }

  const config: OAuthClientConfig = {
    clientId: idMatch[1],
    clientSecret: secretMatch[1],
  };

  try {
    localStorage.setItem(OAUTH_CLIENT_CACHE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }

  return config;
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
  return Boolean(
    (googleSession && (googleSession.accessToken || googleSession.refreshToken)) ||
      (apiKey && apiKey.trim().length > 0)
  );
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

async function resolveCodeAssistProject(accessToken: string): Promise<string | undefined> {
  const coreMetadata = {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  };

  try {
    const loadResp = await fetch(`${CODE_ASSIST_BASE_URL}:loadCodeAssist`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata: coreMetadata,
      }),
    });

    if (!loadResp.ok) {
      return undefined;
    }

    const loadData: any = await loadResp.json();
    if (loadData?.cloudaicompanionProject) {
      return String(loadData.cloudaicompanionProject);
    }

    // If user is not yet onboarded, onboard to the default tier (e.g. free-tier)
    const allowedTiers: any[] = Array.isArray(loadData?.allowedTiers)
      ? loadData.allowedTiers
      : [];
    const defaultTier =
      allowedTiers.find((t) => t?.isDefault) ||
      allowedTiers[0] || { id: 'free-tier' };
    const tierId = defaultTier?.id || 'free-tier';

    const onboardResp = await fetch(`${CODE_ASSIST_BASE_URL}:onboardUser`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tierId,
        metadata: coreMetadata,
      }),
    });

    if (!onboardResp.ok) {
      return undefined;
    }

    let lro: any = await onboardResp.json();
    let polls = 0;
    while (!lro?.done && lro?.name && polls < 10) {
      await new Promise((r) => setTimeout(r, 2500));
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

    const projId = lro?.response?.cloudaicompanionProject?.id;
    return projId ? String(projId) : undefined;
  } catch {
    return undefined;
  }
}

export async function loginWithGoogle(): Promise<GoogleUserSession> {
  const oauthClient = await getOAuthClientConfig();
  const oauthResult = await invoke<{ code: string; redirect_uri: string }>(
    'start_google_oauth_login',
    { clientId: oauthClient.clientId }
  );

  const tokenParams = new URLSearchParams({
    client_id: oauthClient.clientId,
    client_secret: oauthClient.clientSecret,
    code: oauthResult.code,
    grant_type: 'authorization_code',
    redirect_uri: oauthResult.redirect_uri,
  });

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Google token exchange failed: ${errText}`);
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

  const session: GoogleUserSession = {
    accessToken,
    refreshToken,
    expiryDate,
    email,
    name,
    picture,
    projectId,
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
        client_secret: oauthClient.clientSecret,
        refresh_token: googleSession.refreshToken,
        grant_type: 'refresh_token',
      });

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
      // Keep current session if offline/transient error
    }
  }

  if (!googleSession.projectId && googleSession.accessToken) {
    const projectId = await resolveCodeAssistProject(googleSession.accessToken);
    if (projectId) {
      googleSession = { ...googleSession, projectId };
      saveGoogleSession(googleSession);
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
): Promise<{ text: string; functionCalls: any[]; modelContent: any }> {
  const promptId = `luminess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const caPayload: Record<string, any> = {
    model,
    project: session.projectId,
    user_prompt_id: promptId,
    request: {
      contents,
      systemInstruction: {
        role: 'user',
        parts: [{ text: systemInstruction }],
      },
      tools,
      generationConfig: {
        temperature: 0.6,
      },
    },
  };

  let resp = await fetch(`${CODE_ASSIST_BASE_URL}:generateContent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(caPayload),
  });

  // If token expired (401), force refresh once and retry
  if (resp.status === 401 && session.refreshToken) {
    session.expiryDate = 0;
    const refreshed = await ensureValidGoogleSession();
    if (refreshed) {
      resp = await fetch(`${CODE_ASSIST_BASE_URL}:generateContent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshed.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...caPayload,
          project: refreshed.projectId,
        }),
      });
    }
  }

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Google AI request failed (${resp.status}): ${errBody}`);
  }

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

const VALID_EMOTIONS: Emotion[] = [
  'joy', 'sadness', 'anger', 'fear', 'surprise',
  'disgust', 'curiosity', 'confusion', 'love',
  'embarrassment', 'idle'
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

function parseAssistantOutput(rawText: string): { content: string; emotion: Emotion } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { content: 'Done!', emotion: 'joy' };
  }

  // Strip optional markdown code fences if present
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed.content === 'string') {
      const emo = VALID_EMOTIONS.includes(parsed.emotion) ? (parsed.emotion as Emotion) : 'joy';
      return { content: parsed.content, emotion: emo };
    }
  } catch {
    // Try extracting a JSON object embedded in the text
    const jsonStart = candidate.indexOf('{');
    const jsonEnd = candidate.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      try {
        const sub = JSON.parse(candidate.slice(jsonStart, jsonEnd + 1));
        if (sub && typeof sub.content === 'string') {
          const emo = VALID_EMOTIONS.includes(sub.emotion) ? (sub.emotion as Emotion) : 'joy';
          return { content: sub.content, emotion: emo };
        }
      } catch {
        // fallback to plain text
      }
    }
  }

  return { content: trimmed, emotion: 'joy' };
}

function isVertexExpressKey(key: string): boolean {
  return /^AQ[\.\-_A-Za-z0-9]/i.test(key.trim());
}

function createGenAIClient(key: string, vertexai: boolean): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: key.trim(),
    vertexai,
  });
}

export async function runAgent(
  history: Message[],
  onToolStart: (toolName: string | null) => void,
  onEmotion: (emotion: Emotion) => void,
  onRequestPermission: (req: ToolPermissionRequest) => Promise<boolean>,
  onTimerComplete?: (label: string) => void
): Promise<Message> {
  const activeGoogleSession = await ensureValidGoogleSession();

  if (!activeGoogleSession && !apiKey) {
    return {
      role: 'assistant',
      content: 'Please sign in with your Google account first so I can help you!',
      emotion: 'sadness',
    };
  }

  let useVertexAi = apiKey ? isVertexExpressKey(apiKey) : false;
  let ai = apiKey ? createGenAIClient(apiKey, useVertexAi) : null;

  // Fetch basic PC context automatically so the AI knows paths like Desktop, Documents, Username, Drives
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

  const contents: any[] = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const tools: any[] = [{
    functionDeclarations: [
      {
        name: 'get_pc_context',
        description: 'Get system info, username, user profile directory, Desktop, Documents, Downloads paths, and available drives.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      },
      {
        name: 'fs_list_dir',
        description: 'List all files and subdirectories inside any directory on the PC. Supports ~, %USERPROFILE%, and full paths like C:\\Users\\...',
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'Directory path to list (e.g. ~/Desktop, C:\\, %USERPROFILE%\\Documents)' }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_read_file',
        description: 'Read the contents of any file on the user PC.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'Full or relative path to the file to read' },
            max_bytes: { type: Type.NUMBER, description: 'Optional max bytes to read (default 250000)' }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_write_file',
        description: 'Create, overwrite, or append text to any file on the user PC. Automatically creates parent directories if needed.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'Full path to the file to create or modify' },
            content: { type: Type.STRING, description: 'The full text content to write or append' },
            append: { type: Type.BOOLEAN, description: 'If true, appends to the file instead of overwriting' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'fs_search_files',
        description: 'Search recursively for files or folders matching a name/substring inside a directory on the PC.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            directory: { type: Type.STRING, description: 'Root directory to search in (e.g. ~/Desktop, ~/Documents, C:\\Users)' },
            query: { type: Type.STRING, description: 'File or folder name substring to search for (case-insensitive)' },
            max_results: { type: Type.NUMBER, description: 'Maximum results to return (default 100)' }
          },
          required: ['directory', 'query']
        }
      },
      {
        name: 'fs_delete_path',
        description: 'Delete any file or folder (recursively) on the user PC.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: 'Full path to the file or directory to delete' }
          },
          required: ['path']
        }
      },
      {
        name: 'fs_copy_or_move',
        description: 'Copy, move, or rename any file or folder on the user PC.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING, description: 'Source file or directory path' },
            destination: { type: Type.STRING, description: 'Destination file or directory path' },
            is_move: { type: Type.BOOLEAN, description: 'True to move/rename, false to copy' }
          },
          required: ['source', 'destination', 'is_move']
        }
      },
      {
        name: 'execute_pc_command',
        description: 'Execute any PowerShell command or script on the Windows PC. Can run programs, inspect processes, change settings, manage files, install packages, or automate anything on the computer.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            command: { type: Type.STRING, description: 'PowerShell command to execute' },
            cwd: { type: Type.STRING, description: 'Optional working directory for the command' }
          },
          required: ['command']
        }
      },
      {
        name: 'open_item',
        description: 'Open any application, file, folder, or URL on the user PC (e.g. notepad, calc, chrome, https://google.com, C:\\Users\\...).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            target: { type: Type.STRING, description: 'Application name, file/folder path, or URL to open' }
          },
          required: ['target']
        }
      },
      {
        name: 'set_timer',
        description: 'Set a countdown timer for a duration in minutes.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            minutes: { type: Type.NUMBER, description: 'Duration in minutes (can be fractional like 0.5 for 30s)' },
            label: { type: Type.STRING, description: 'What the timer is for' }
          },
          required: ['minutes']
        }
      }
    ]
  }];

  const systemInstruction = `
You are Luminess Assist, an expressive, capable robotic desktop companion living on the user's Windows PC.
${pcSummary}
You have FULL access to the user's PC and every file on the computer through your tools:
- fs_list_dir, fs_read_file, fs_write_file, fs_search_files, fs_delete_path, fs_copy_or_move
- execute_pc_command (runs any PowerShell command on the PC)
- open_item (opens any app, file, folder, or URL)
- set_timer, get_pc_context

Whenever the user asks you to inspect files, create/edit/delete files, run commands, open apps, check PC status, or do anything on their computer, ALWAYS use the appropriate tool(s). The app will automatically ask the user for confirmation before executing your tool call.
After finishing all necessary tool calls, return your final reply to the user as a JSON object with EXACTLY two fields:
{
  "content": "Your helpful conversational response here.",
  "emotion": "one of: joy, sadness, anger, fear, surprise, disgust, curiosity, confusion, love, embarrassment, idle"
}
Do not wrap the JSON in markdown code blocks.
`;

  const executedActions: string[] = [];

  try {
    let maxTurns = 10;
    while (maxTurns-- > 0) {
      let rawText = '';
      let functionCalls: any[] | undefined;
      let modelContent: any;

      const latestGoogleSession = await ensureValidGoogleSession();
      if (latestGoogleSession) {
        const oauthRes = await generateWithGoogleOAuth(
          latestGoogleSession,
          'gemini-2.5-flash',
          contents,
          systemInstruction,
          tools
        );
        rawText = oauthRes.text;
        functionCalls = oauthRes.functionCalls;
        modelContent = oauthRes.modelContent;
      } else if (ai) {
        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
              systemInstruction,
              tools,
              temperature: 0.6,
            },
          });
        } catch (reqErr: any) {
          const msg = String(reqErr?.message || reqErr || '');
          if (
            msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
            msg.includes('UNAUTHENTICATED') ||
            msg.includes('API_KEY_INVALID') ||
            msg.includes('401')
          ) {
            useVertexAi = !useVertexAi;
            ai = createGenAIClient(apiKey, useVertexAi);
            response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents,
              config: {
                systemInstruction,
                tools,
                temperature: 0.6,
              },
            });
          } else {
            throw reqErr;
          }
        }
        rawText = response.text || '';
        functionCalls = response.functionCalls;
        modelContent = response.candidates?.[0]?.content;
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
                response: { error: 'User denied permission to execute this action.' }
              }
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
                response: { result }
              }
            });
          } catch (err: any) {
            const errMsg = typeof err === 'string' ? err : err?.message || String(err);
            executedActions.push(`Failed: ${description} (${errMsg})`);
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { error: errMsg }
              }
            });
          }
        }

        contents.push({
          role: 'user',
          parts: responseParts
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
    console.error('Gemini error:', error);
    throw error;
  } finally {
    onToolStart(null);
  }
}
