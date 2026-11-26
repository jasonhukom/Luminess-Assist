import { invoke } from '@tauri-apps/api/core';
import type { PersonalityArchetype } from './personality';

export type BotVisualMode = 'robot' | 'image' | 'sprite_frames' | 'video';

export type BotChassisModel = 'classic' | 'visor' | 'orb' | 'retro';

export type BotAccessoryId =
  | 'none'
  | 'headphones'
  | 'cat_ears'
  | 'wizard_hat'
  | 'visor'
  | 'halo'
  | 'crown';

export type CustomApiFormat = 'openai-chat' | 'openai-responses' | 'anthropic' | 'gemini';

export type AgentPresetKind = 'api' | 'local-cli' | 'local-server';

export interface AgentPresetDefinition {
  id: string;
  name: string;
  kind: AgentPresetKind;
  provider: string;
  apiFormat: CustomApiFormat;
  baseUrl: string;
  model: string;
  cliCommand?: string;
  systemPromptAddon?: string;
  description?: string;
}

export interface BotAppearanceConfig {
  model: BotChassisModel;
  paletteName: string;
  idleColor: string;
  glowColor: string;
  joyColor: string;
  loveColor: string;
  thinkingColor: string;
  angerColor: string;
  furiousColor: string;
  shellBg: string;
  accessory: BotAccessoryId;
  scale: number;
}

export interface BotAngerSettings {
  enabled: boolean;
  wallImpactSensitivity: number;
  maxPatience: number;
  angerThreshold: number;
  furiousThreshold: number;
  breakOnMaxDamage: boolean;
  repairSeconds: number;
  triggers: {
    wallImpact: boolean;
    hostileWords: boolean;
    rapidShake: boolean;
    repeatedInterruptions: boolean;
  };
  hostileKeywords: string[];
  customAnnoyedPhrases: string[];
  customFuriousPhrases: string[];
  customCalmRemarks: string[];
}

export interface BotPersonalityCustomization {
  archetype: PersonalityArchetype;
  platformTone: string;
  formality: number;
  humor: number;
  verbosity: number;
  customPrompt: string;
}

export interface BotApiConfig {
  activePresetId: string;
  requirePreset: boolean;
  customBaseUrl: string;
  customApiFormat: CustomApiFormat;
  customModel: string;
  customHeadersJson: string;
  temperature: number;
}

export interface BotFramesConfig {
  idle?: string;
  happy?: string;
  thinking?: string;
  anger?: string;
  furious?: string;
  coding?: string;
  broken?: string;
}

export interface BotCustomizationManifest {
  schemaVersion: string;
  botName: string;
  tagline: string;
  userName: string;
  repo: string;
  upstreamRepo: string;
  branch: string;
  platformBaseUrl: string;
  platformPairingCode: string;
  autoSyncOnStartup: boolean;
  lastSyncedAt?: number | null;
  visualMode: BotVisualMode;
  avatarImageUrl: string;
  videoUrl: string;
  framesConfig: BotFramesConfig;
  appearance: BotAppearanceConfig;
  personality: BotPersonalityCustomization;
  angerSettings: BotAngerSettings;
  apiConfig: BotApiConfig;
  agentPresets: AgentPresetDefinition[];
}

export const DEFAULT_AGENT_PRESETS: AgentPresetDefinition[] = [
  {
    id: 'direct-custom',
    name: 'Custom API (No Preset)',
    kind: 'api',
    provider: 'custom',
    apiFormat: 'openai-chat',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    description: 'Use any API key, endpoint URL, and model string directly.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'api',
    provider: 'gemini',
    apiFormat: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    description: 'Google Gemini models via API key or OAuth.',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    kind: 'api',
    provider: 'claude',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-20250514',
    description: 'Anthropic Messages API.',
  },
  {
    id: 'codex',
    name: 'OpenAI / Codex',
    kind: 'api',
    provider: 'codex',
    apiFormat: 'openai-chat',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    description: 'OpenAI Chat Completions or Responses API.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'api',
    provider: 'custom',
    apiFormat: 'openai-chat',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-sonnet-4',
    description: 'Access hundreds of cloud models with one API key.',
  },
  {
    id: 'groq',
    name: 'Groq Fast Inference',
    kind: 'api',
    provider: 'custom',
    apiFormat: 'openai-chat',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    description: 'Ultra-low latency OpenAI-compatible inference.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'api',
    provider: 'custom',
    apiFormat: 'openai-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    description: 'DeepSeek chat and reasoning endpoints.',
  },
  {
    id: 'opencode',
    name: 'OpenCode Local Agent',
    kind: 'local-cli',
    provider: 'offline',
    apiFormat: 'openai-chat',
    baseUrl: 'http://127.0.0.1:4096',
    model: 'opencode-default',
    cliCommand: 'opencode',
    description: 'Local autonomous CLI coding agent (opencode).',
  },
  {
    id: 'kilocode',
    name: 'KiloCode Local Agent',
    kind: 'local-cli',
    provider: 'offline',
    apiFormat: 'openai-chat',
    baseUrl: '',
    model: 'kilocode-default',
    cliCommand: 'kilocode',
    description: 'Local autonomous CLI agent (@kilocode/cli).',
  },
  {
    id: 'ollama',
    name: 'Ollama / Local OpenAI',
    kind: 'local-server',
    provider: 'offline',
    apiFormat: 'openai-chat',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen2.5-coder:latest',
    description: 'Offline local models via Ollama, LM Studio, or llama.cpp.',
  },
];

export const COLOR_PALETTE_PRESETS: Array<{
  name: string;
  idleColor: string;
  glowColor: string;
  joyColor: string;
  angerColor: string;
  furiousColor: string;
}> = [
  {
    name: 'Neon Cyan',
    idleColor: '#38bdf8',
    glowColor: '#0ea5e9',
    joyColor: '#22d3ee',
    angerColor: '#f97316',
    furiousColor: '#ef4444',
  },
  {
    name: 'Crimson Core',
    idleColor: '#fb7185',
    glowColor: '#f43f5e',
    joyColor: '#fda4af',
    angerColor: '#ef4444',
    furiousColor: '#dc2626',
  },
  {
    name: 'Emerald Spark',
    idleColor: '#34d399',
    glowColor: '#10b981',
    joyColor: '#6ee7b7',
    angerColor: '#f59e0b',
    furiousColor: '#ef4444',
  },
  {
    name: 'Violet Synth',
    idleColor: '#a78bfa',
    glowColor: '#8b5cf6',
    joyColor: '#e879f9',
    angerColor: '#fb7185',
    furiousColor: '#e11d48',
  },
  {
    name: 'Solar Gold',
    idleColor: '#fbbf24',
    glowColor: '#f59e0b',
    joyColor: '#fde047',
    angerColor: '#ea580c',
    furiousColor: '#dc2626',
  },
];

export function createDefaultBotCustomization(): BotCustomizationManifest {
  return {
    schemaVersion: '1.2.0',
    botName: 'Luminess',
    tagline: 'Living Desktop AI Companion',
    userName: '',
    repo: 'jasonhukom/Luminess-Assist',
    upstreamRepo: 'jasonhukom/Luminess-Assist',
    branch: 'main',
    platformBaseUrl: 'http://127.0.0.1:8000',
    platformPairingCode: '',
    autoSyncOnStartup: false,
    lastSyncedAt: null,
    visualMode: 'robot',
    avatarImageUrl: '',
    videoUrl: '',
    framesConfig: {},
    appearance: {
      model: 'classic',
      paletteName: 'Neon Cyan',
      idleColor: '#38bdf8',
      glowColor: '#0ea5e9',
      joyColor: '#22d3ee',
      loveColor: '#f472b6',
      thinkingColor: '#a855f7',
      angerColor: '#f97316',
      furiousColor: '#ef4444',
      shellBg: '#0f172a',
      accessory: 'none',
      scale: 1.0,
    },
    personality: {
      archetype: 'lively',
      platformTone: 'friendly',
      formality: 40,
      humor: 72,
      verbosity: 45,
      customPrompt: '',
    },
    angerSettings: {
      enabled: true,
      wallImpactSensitivity: 1.0,
      maxPatience: 100,
      angerThreshold: 20,
      furiousThreshold: 60,
      breakOnMaxDamage: true,
      repairSeconds: 30,
      triggers: {
        wallImpact: true,
        hostileWords: true,
        rapidShake: true,
        repeatedInterruptions: false,
      },
      hostileKeywords: ['stupid', 'idiot', 'useless', 'shut up', 'hate you', 'trash'],
      customAnnoyedPhrases: [
        'Hey! Watch the screen edges!',
        'Not a stress ball!',
        'Easy on the thrusters...',
      ],
      customFuriousPhrases: [
        'MY CHASSIS!',
        'STOP THROWING ME!',
        'WARNING: HULL CRIT!',
      ],
      customCalmRemarks: ['Finally calmed down.', 'Systems nominal again.'],
    },
    apiConfig: {
      activePresetId: 'direct-custom',
      requirePreset: false,
      customBaseUrl: '',
      customApiFormat: 'openai-chat',
      customModel: '',
      customHeadersJson: '',
      temperature: 0.7,
    },
    agentPresets: DEFAULT_AGENT_PRESETS.map((preset) => ({ ...preset })),
  };
}

export function normalizePlatformArchetypeToCompanion(raw?: string): PersonalityArchetype {
  const val = (raw || '').trim().toLowerCase();
  if (val === 'serious' || val === 'scholar') return 'serious';
  if (val === 'dependable' || val === 'zen') return 'dependable';
  if (val === 'extraverted' || val === 'friendly' || val === 'sarcastic') return 'extraverted';
  if (val === 'responsible') return 'responsible';
  return 'lively';
}

export function mergeBotCustomization(
  base: BotCustomizationManifest,
  incoming?: Partial<BotCustomizationManifest> | Record<string, unknown> | null
): BotCustomizationManifest {
  if (!incoming || typeof incoming !== 'object') {
    return base;
  }
  const src = incoming as Record<string, unknown>;
  const appearanceIn = (src.appearance && typeof src.appearance === 'object'
    ? src.appearance
    : {}) as Record<string, unknown>;
  const personalityIn = (src.personality && typeof src.personality === 'object'
    ? src.personality
    : {}) as Record<string, unknown>;
  const angerIn = (src.angerSettings && typeof src.angerSettings === 'object'
    ? src.angerSettings
    : {}) as Record<string, unknown>;
  const apiIn = (src.apiConfig && typeof src.apiConfig === 'object'
    ? src.apiConfig
    : {}) as Record<string, unknown>;

  // Support both Luminess-Assist manifest format and Luminess-Platform BotProfile JSON format
  const rawArch =
    typeof personalityIn.archetype === 'string' ? personalityIn.archetype : base.personality.archetype;
  const legacyColor =
    typeof appearanceIn.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(appearanceIn.color)
      ? appearanceIn.color
      : undefined;

  const mergedScale = Number(appearanceIn.scale);
  const clampedScale = Number.isFinite(mergedScale)
    ? Math.max(0.7, Math.min(1.5, mergedScale))
    : base.appearance.scale;

  const rawVisualMode = (src.visualMode ?? src.visual_mode) as string | undefined;
  const visualMode: BotVisualMode =
    rawVisualMode === 'image' ||
    rawVisualMode === 'sprite_frames' ||
    rawVisualMode === 'video' ||
    rawVisualMode === 'robot'
      ? rawVisualMode
      : base.visualMode;

  const rawBotName =
    typeof src.botName === 'string' && src.botName.trim()
      ? src.botName.trim()
      : typeof personalityIn.botName === 'string' && personalityIn.botName.trim()
        ? personalityIn.botName.trim()
        : base.botName;

  const rawRepo =
    typeof src.repo === 'string' && src.repo.trim()
      ? parseGitHubRepoSlug(src.repo) || base.repo
      : typeof src.githubRepo === 'string' && src.githubRepo.trim()
        ? parseGitHubRepoSlug(src.githubRepo) || base.repo
        : base.repo;

  const presetsIn = Array.isArray(src.agentPresets)
    ? (src.agentPresets as AgentPresetDefinition[]).filter(
        (p) => p && typeof p.id === 'string' && typeof p.name === 'string'
      )
    : null;

  const triggersIn = (angerIn.triggers && typeof angerIn.triggers === 'object'
    ? angerIn.triggers
    : {}) as Record<string, unknown>;

  const sensitivityRaw = Number(angerIn.wallImpactSensitivity);
  const angerThreshRaw = Number(angerIn.angerThreshold);
  const furiousThreshRaw = Number(angerIn.furiousThreshold);
  const repairSecRaw = Number(angerIn.repairSeconds);
  const maxPatienceRaw = Number(angerIn.maxPatience);

  return {
    ...base,
    schemaVersion: typeof src.schemaVersion === 'string' ? src.schemaVersion : base.schemaVersion,
    botName: rawBotName,
    tagline: typeof src.tagline === 'string' ? src.tagline : base.tagline,
    userName:
      typeof src.userName === 'string'
        ? src.userName
        : typeof personalityIn.userName === 'string'
          ? personalityIn.userName
          : base.userName,
    repo: rawRepo,
    upstreamRepo: typeof src.upstreamRepo === 'string' ? src.upstreamRepo : base.upstreamRepo,
    branch: typeof src.branch === 'string' && src.branch.trim() ? src.branch.trim() : base.branch,
    platformBaseUrl:
      typeof src.platformBaseUrl === 'string' && src.platformBaseUrl.trim()
        ? src.platformBaseUrl.trim().replace(/\/+$/, '')
        : base.platformBaseUrl,
    platformPairingCode:
      typeof src.platformPairingCode === 'string'
        ? src.platformPairingCode.trim()
        : typeof src.pairingCode === 'string'
          ? src.pairingCode.trim()
          : base.platformPairingCode,
    autoSyncOnStartup:
      typeof src.autoSyncOnStartup === 'boolean' ? src.autoSyncOnStartup : base.autoSyncOnStartup,
    lastSyncedAt:
      typeof src.lastSyncedAt === 'number' ? src.lastSyncedAt : base.lastSyncedAt ?? null,
    visualMode,
    avatarImageUrl:
      typeof src.avatarImageUrl === 'string'
        ? src.avatarImageUrl
        : typeof src.avatar_image_url === 'string'
          ? src.avatar_image_url
          : base.avatarImageUrl,
    videoUrl:
      typeof src.videoUrl === 'string'
        ? src.videoUrl
        : typeof src.video_url === 'string'
          ? src.video_url
          : base.videoUrl,
    framesConfig:
      src.framesConfig && typeof src.framesConfig === 'object'
        ? { ...base.framesConfig, ...(src.framesConfig as BotFramesConfig) }
        : src.frames_config && typeof src.frames_config === 'object'
          ? { ...base.framesConfig, ...(src.frames_config as BotFramesConfig) }
          : base.framesConfig,
    appearance: {
      ...base.appearance,
      ...(appearanceIn as Partial<BotAppearanceConfig>),
      idleColor:
        (typeof appearanceIn.idleColor === 'string' ? appearanceIn.idleColor : legacyColor) ||
        base.appearance.idleColor,
      glowColor:
        (typeof appearanceIn.glowColor === 'string' ? appearanceIn.glowColor : legacyColor) ||
        base.appearance.glowColor,
      scale: clampedScale,
    },
    personality: {
      ...base.personality,
      ...(personalityIn as Partial<BotPersonalityCustomization>),
      archetype: normalizePlatformArchetypeToCompanion(rawArch),
      platformTone:
        typeof personalityIn.platformTone === 'string'
          ? personalityIn.platformTone
          : typeof personalityIn.archetype === 'string'
            ? personalityIn.archetype
            : base.personality.platformTone,
    },
    angerSettings: {
      ...base.angerSettings,
      ...(angerIn as Partial<BotAngerSettings>),
      enabled: typeof angerIn.enabled === 'boolean' ? angerIn.enabled : base.angerSettings.enabled,
      wallImpactSensitivity: Number.isFinite(sensitivityRaw)
        ? Math.max(0.2, Math.min(3.5, sensitivityRaw))
        : base.angerSettings.wallImpactSensitivity,
      maxPatience: Number.isFinite(maxPatienceRaw)
        ? Math.max(20, Math.min(300, maxPatienceRaw))
        : base.angerSettings.maxPatience,
      angerThreshold: Number.isFinite(angerThreshRaw)
        ? Math.max(5, Math.min(80, angerThreshRaw))
        : base.angerSettings.angerThreshold,
      furiousThreshold: Number.isFinite(furiousThreshRaw)
        ? Math.max(25, Math.min(95, furiousThreshRaw))
        : base.angerSettings.furiousThreshold,
      repairSeconds: Number.isFinite(repairSecRaw)
        ? Math.max(5, Math.min(120, repairSecRaw))
        : base.angerSettings.repairSeconds,
      triggers: {
        ...base.angerSettings.triggers,
        wallImpact:
          typeof triggersIn.wallImpact === 'boolean'
            ? triggersIn.wallImpact
            : base.angerSettings.triggers.wallImpact,
        hostileWords:
          typeof triggersIn.hostileWords === 'boolean'
            ? triggersIn.hostileWords
            : base.angerSettings.triggers.hostileWords,
        rapidShake:
          typeof triggersIn.rapidShake === 'boolean'
            ? triggersIn.rapidShake
            : base.angerSettings.triggers.rapidShake,
        repeatedInterruptions:
          typeof triggersIn.repeatedInterruptions === 'boolean'
            ? triggersIn.repeatedInterruptions
            : base.angerSettings.triggers.repeatedInterruptions,
      },
      hostileKeywords: Array.isArray(angerIn.hostileKeywords)
        ? angerIn.hostileKeywords.map(String).filter(Boolean)
        : base.angerSettings.hostileKeywords,
      customAnnoyedPhrases: Array.isArray(angerIn.customAnnoyedPhrases)
        ? angerIn.customAnnoyedPhrases.map(String).filter(Boolean)
        : base.angerSettings.customAnnoyedPhrases,
      customFuriousPhrases: Array.isArray(angerIn.customFuriousPhrases)
        ? angerIn.customFuriousPhrases.map(String).filter(Boolean)
        : base.angerSettings.customFuriousPhrases,
      customCalmRemarks: Array.isArray(angerIn.customCalmRemarks)
        ? angerIn.customCalmRemarks.map(String).filter(Boolean)
        : base.angerSettings.customCalmRemarks,
    },
    apiConfig: {
      ...base.apiConfig,
      ...(apiIn as Partial<BotApiConfig>),
      requirePreset: false,
    },
    agentPresets: presetsIn && presetsIn.length > 0 ? presetsIn : base.agentPresets,
  };
}

export function parseGitHubRepoSlug(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  // Handle full GitHub URLs or raw.githubusercontent URLs
  const urlMatch = trimmed.match(
    /(?:github\.com|raw\.githubusercontent\.com)\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (urlMatch) {
    const owner = urlMatch[1];
    const repo = urlMatch[2].replace(/\.git$/i, '');
    return `${owner}/${repo}`;
  }

  // Handle owner/repo shorthand
  const slugMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (slugMatch) {
    return `${slugMatch[1]}/${slugMatch[2]}`;
  }

  return null;
}

export function getGitHubManifestRawUrl(repoOrUrl: string, branch = 'main'): string | null {
  const slug = parseGitHubRepoSlug(repoOrUrl);
  if (!slug) return null;
  const cleanBranch = encodeURIComponent((branch || 'main').trim() || 'main');
  return `https://raw.githubusercontent.com/${slug}/${cleanBranch}/luminess.bot.json`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  } else if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return `rgba(56, 189, 248, ${alpha})`;
}

export function applyBotAppearanceCssVars(customization: BotCustomizationManifest): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { appearance } = customization;

  root.style.setProperty('--bot-idle-color', appearance.idleColor);
  root.style.setProperty('--bot-glow-color', appearance.glowColor);
  root.style.setProperty('--bot-joy-color', appearance.joyColor);
  root.style.setProperty('--bot-love-color', appearance.loveColor);
  root.style.setProperty('--bot-thinking-color', appearance.thinkingColor);
  root.style.setProperty('--bot-anger-color', appearance.angerColor);
  root.style.setProperty('--bot-furious-color', appearance.furiousColor);
  root.style.setProperty('--bot-shell-bg', appearance.shellBg);
  root.style.setProperty('--bot-scale', String(appearance.scale));

  root.style.setProperty('--robot-glow-idle', appearance.glowColor || appearance.idleColor);
  root.style.setProperty('--robot-glow-joy', appearance.joyColor);
  root.style.setProperty('--robot-glow-love', appearance.loveColor);
  root.style.setProperty('--robot-glow-curiosity', appearance.thinkingColor);
  root.style.setProperty('--robot-glow-sadness', appearance.idleColor);
  root.style.setProperty('--robot-glow-annoyed', appearance.angerColor);
  root.style.setProperty('--robot-glow-anger', appearance.angerColor);
  root.style.setProperty('--robot-glow-furious', appearance.furiousColor);
  root.style.setProperty('--panel-glow', appearance.glowColor || appearance.idleColor);
}

export function buildAiForkCustomizePrompt(manifest: BotCustomizationManifest): string {
  const repoSlug = parseGitHubRepoSlug(manifest.repo) || 'YOUR_USERNAME/Luminess-Assist';
  return [
    `You are customizing MY forked Luminess-Assist repository (${repoSlug}, branch: ${manifest.branch}).`,
    `Modify only my fork's configuration and UI files (starting with luminess.bot.json and optionally src/components/Robot.tsx / src/components/Robot.css) while preserving Tauri safety and existing tests.`,
    ``,
    `Target Bot Identity: "${manifest.botName}" (${manifest.tagline})`,
    `Target Look: mode=${manifest.visualMode}, model=${manifest.appearance.model}, accessory=${manifest.appearance.accessory}, idleColor=${manifest.appearance.idleColor}, angerColor=${manifest.appearance.angerColor}, furiousColor=${manifest.appearance.furiousColor}`,
    `Anger / Mad Behavior: enabled=${manifest.angerSettings.enabled}, wallImpactSensitivity=${manifest.angerSettings.wallImpactSensitivity}, angerThreshold=${manifest.angerSettings.angerThreshold}, furiousThreshold=${manifest.angerSettings.furiousThreshold}, triggers=${JSON.stringify(manifest.angerSettings.triggers)}`,
    ``,
    `After editing luminess.bot.json in ${repoSlug}, run "npm test && npm run lint && npm run build" and push to ${manifest.branch} so my Luminess-Assist app can pull updates directly from GitHub.`,
  ].join('\n');
}

export interface ForkSyncResult {
  ok: boolean;
  slug: string;
  branch: string;
  source: 'github-fork' | 'platform-pairing';
  rawUrl?: string;
  manifest?: BotCustomizationManifest;
  error?: string;
}

export async function fetchForkManifestFromGitHub(
  repoOrUrl: string,
  branch = 'main',
  current?: BotCustomizationManifest
): Promise<ForkSyncResult> {
  const slug = parseGitHubRepoSlug(repoOrUrl);
  if (!slug) {
    return {
      ok: false,
      slug: repoOrUrl,
      branch,
      source: 'github-fork',
      error: 'Enter a valid GitHub fork like owner/Luminess-Assist or full https://github.com/owner/repo URL.',
    };
  }
  const activeBranch = (branch || 'main').trim() || 'main';
  const base = current || createDefaultBotCustomization();

  try {
    const tauriRes = await invoke<{
      ok: boolean;
      slug: string;
      branch: string;
      raw_url: string;
      manifest: Record<string, unknown>;
    }>('fetch_github_fork_manifest', {
      repoOrUrl: slug,
      branch: activeBranch,
    });
    if (tauriRes?.ok && tauriRes.manifest) {
      const merged = mergeBotCustomization(base, {
        ...tauriRes.manifest,
        repo: tauriRes.slug,
        branch: tauriRes.branch,
        lastSyncedAt: Date.now(),
      });
      return {
        ok: true,
        slug: tauriRes.slug,
        branch: tauriRes.branch,
        source: 'github-fork',
        rawUrl: tauriRes.raw_url,
        manifest: merged,
      };
    }
  } catch (tauriErr) {
    // Fallback to direct fetch in browser/dev mode if Tauri IPC isn't active
    const rawUrl = getGitHubManifestRawUrl(slug, activeBranch);
    if (!rawUrl) {
      return {
        ok: false,
        slug,
        branch: activeBranch,
        source: 'github-fork',
        error: String(tauriErr),
      };
    }
    try {
      const resp = await fetch(`${rawUrl}?t=${Date.now()}`);
      if (!resp.ok) {
        return {
          ok: false,
          slug,
          branch: activeBranch,
          source: 'github-fork',
          rawUrl,
          error:
            tauriErr instanceof Error
              ? tauriErr.message
              : `GitHub returned HTTP ${resp.status} for ${slug}/${activeBranch}/luminess.bot.json.`,
        };
      }
      const parsed = (await resp.json()) as Record<string, unknown>;
      const merged = mergeBotCustomization(base, {
        ...parsed,
        repo: slug,
        branch: activeBranch,
        lastSyncedAt: Date.now(),
      });
      return {
        ok: true,
        slug,
        branch: activeBranch,
        source: 'github-fork',
        rawUrl,
        manifest: merged,
      };
    } catch (fetchErr) {
      return {
        ok: false,
        slug,
        branch: activeBranch,
        source: 'github-fork',
        rawUrl,
        error:
          fetchErr instanceof Error
            ? fetchErr.message
            : typeof tauriErr === 'string'
              ? tauriErr
              : 'Failed to reach GitHub fork.',
      };
    }
  }

  return {
    ok: false,
    slug,
    branch: activeBranch,
    source: 'github-fork',
    error: `Unable to load luminess.bot.json from ${slug} (${activeBranch}).`,
  };
}

export async function fetchBotProfileFromPlatform(
  platformBaseUrl: string,
  pairingCode: string,
  current?: BotCustomizationManifest
): Promise<ForkSyncResult> {
  const cleanBase = (platformBaseUrl || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
  const cleanCode = (pairingCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return {
      ok: false,
      slug: current?.repo || 'jasonhukom/Luminess-Assist',
      branch: current?.branch || 'main',
      source: 'platform-pairing',
      error: 'Enter a Luminess Platform pairing code (for example, LUM-XXXX).',
    };
  }

  const endpoint = `${cleanBase}/api/v1/bot/connect/${encodeURIComponent(cleanCode)}/`;
  const base = current || createDefaultBotCustomization();

  let bodyText = '';
  let ok = false;
  let status = 0;

  try {
    const proxyRes = await invoke<{ ok: boolean; status: number; body: string }>(
      'http_proxy_request',
      {
        url: endpoint,
        method: 'GET',
        timeoutSecs: 20,
      }
    );
    ok = proxyRes.ok;
    status = proxyRes.status;
    bodyText = proxyRes.body;
  } catch {
    try {
      const resp = await fetch(endpoint);
      ok = resp.ok;
      status = resp.status;
      bodyText = await resp.text();
    } catch (err) {
      return {
        ok: false,
        slug: base.repo,
        branch: base.branch,
        source: 'platform-pairing',
        error: err instanceof Error ? err.message : 'Unable to reach Luminess Platform.',
      };
    }
  }

  if (!ok) {
    return {
      ok: false,
      slug: base.repo,
      branch: base.branch,
      source: 'platform-pairing',
      error: `Platform responded HTTP ${status} for pairing code ${cleanCode}.`,
    };
  }

  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    const profileObj =
      parsed.profile && typeof parsed.profile === 'object'
        ? (parsed.profile as Record<string, unknown>)
        : parsed;

    const merged = mergeBotCustomization(base, {
      ...profileObj,
      platformBaseUrl: cleanBase,
      platformPairingCode: cleanCode,
      lastSyncedAt: Date.now(),
    });
    return {
      ok: true,
      slug: merged.repo,
      branch: merged.branch,
      source: 'platform-pairing',
      rawUrl: endpoint,
      manifest: merged,
    };
  } catch (err) {
    return {
      ok: false,
      slug: base.repo,
      branch: base.branch,
      source: 'platform-pairing',
      error: err instanceof Error ? err.message : 'Invalid JSON from Luminess Platform.',
    };
  }
}
