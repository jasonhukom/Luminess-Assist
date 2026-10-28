export interface AppearanceConfig {
  model: 'robot' | 'orb' | 'pixel' | 'vtuber';
  color: string;
  paletteName: string;
  accessory: 'none' | 'wizard_hat' | 'cat_ears' | 'headphones' | 'visor' | 'halo';
  scale: number;
}

export interface PersonalityConfig {
  botName: string;
  userName: string;
  archetype: 'study_buddy' | 'coder' | 'butler' | 'witty_hacker' | 'custom';
  formality: number; // 0 (casual) - 10 (professional)
  humor: number; // 0 (serious) - 10 (sarcastic)
  verbosity: number; // 0 (concise) - 10 (talkative)
  customPrompt: string;
}

export interface VoiceConfig {
  voiceId: string;
  voiceName: string;
  pitch: number;
  speed: number;
}

export interface BotPermissions {
  canOpenApps: boolean;
  canSortFiles: boolean;
  canReadClipboard: boolean;
  canWriteClipboard: boolean;
  canReadSystemStats: boolean;
  canExecuteCommands: boolean;
  canSetTimers: boolean;
}

export interface BotProfile {
  id: string;
  userId: string;
  botName: string;
  isActive: boolean;
  pairingCode: string;
  appearance: AppearanceConfig;
  personality: PersonalityConfig;
  voice: VoiceConfig;
  permissions: BotPermissions;
  createdAt: string;
}

export interface BotMemory {
  id: string;
  botProfileId: string;
  memoryFact: string;
  category: 'preference' | 'project' | 'habit' | 'hardware';
  createdAt: string;
}

export interface AppRelease {
  versionId: string;
  downloadUrl: string;
  releaseNotes: string;
  isMandatoryUpdate: boolean;
  status: 'latest' | 'beta' | 'deprecated';
  releasedAt: string;
}

export interface FeatureFlags {
  voiceModeEnabled: boolean;
  webSearchEnabled: boolean;
  powershellAutomationEnabled: boolean;
  screenOcrEnabled: boolean;
  longTermMemorySyncEnabled: boolean;
  cloudCodeAssistFallback: boolean;
}

export interface GlobalConfigItem {
  key: string;
  value: string;
  description: string;
  lastUpdated: string;
}

export interface PlatformUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

const STORAGE_KEY = 'luminess-platform-v1';

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  model: 'robot',
  color: '#38bdf8',
  paletteName: 'Cyber Cyan',
  accessory: 'headphones',
  scale: 1.0,
};

export const DEFAULT_PERSONALITY: PersonalityConfig = {
  botName: 'Luminess',
  userName: 'Pilot',
  archetype: 'witty_hacker',
  formality: 3,
  humor: 8,
  verbosity: 4,
  customPrompt: 'Focus on snappy desktop automation and friendly productivity reminders.',
};

export const DEFAULT_VOICE: VoiceConfig = {
  voiceId: 'luna-neural',
  voiceName: 'Luna Neural (Playful AI)',
  pitch: 1.05,
  speed: 1.0,
};

export const DEFAULT_PERMISSIONS: BotPermissions = {
  canOpenApps: true,
  canSortFiles: true,
  canReadClipboard: false,
  canWriteClipboard: true,
  canReadSystemStats: true,
  canExecuteCommands: false,
  canSetTimers: true,
};

export const INITIAL_FEATURE_FLAGS: FeatureFlags = {
  voiceModeEnabled: true,
  webSearchEnabled: true,
  powershellAutomationEnabled: true,
  screenOcrEnabled: false,
  longTermMemorySyncEnabled: true,
  cloudCodeAssistFallback: false,
};

export const INITIAL_RELEASES: AppRelease[] = [
  {
    versionId: '1.1.2',
    downloadUrl: 'https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.2/Luminess-Assist_1.1.2_x64_en-US.msi',
    releaseNotes: 'Intelligent AI Authentication with normalized error recovery, Antigravity CLI detection, dock vertical toggle, and interactive companion modes.',
    isMandatoryUpdate: false,
    status: 'latest',
    releasedAt: '2026-10-28',
  },
  {
    versionId: '1.1.3-beta',
    downloadUrl: 'https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.1.3-beta',
    releaseNotes: 'Early testing build for dynamic web customizer deep linking and hardware sensor reaction loop.',
    isMandatoryUpdate: false,
    status: 'beta',
    releasedAt: '2026-10-29',
  },
  {
    versionId: '1.0.8',
    downloadUrl: 'https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.0.8',
    releaseNotes: 'Legacy release without persistent relationships and desktop shortcuts.',
    isMandatoryUpdate: false,
    status: 'deprecated',
    releasedAt: '2026-10-15',
  },
];

export const INITIAL_GLOBAL_CONFIG: GlobalConfigItem[] = [
  {
    key: 'active_default_ai_model',
    value: 'gemini-2.5-flash',
    description: 'Primary AI model used for zero-configuration desktop requests',
    lastUpdated: '2026-10-28',
  },
  {
    key: 'master_guardrail_prompt',
    value: 'Always reply in valid JSON { content: string, emotion: Emotion }. Never execute file deletion without explicit approval. Treat system paths respectfully.',
    description: 'Hidden master guardrail wrapped around every custom bot personality',
    lastUpdated: '2026-10-28',
  },
  {
    key: 'maintenance_mode',
    value: 'false',
    description: 'Global maintenance flag for cloud token proxying and telemetry',
    lastUpdated: '2026-10-27',
  },
  {
    key: 'pairing_code_expiry_minutes',
    value: '1440',
    description: 'Lifetime of pairing tokens generated on the Web Studio before desktop claim',
    lastUpdated: '2026-10-28',
  },
];

export const INITIAL_USERS: PlatformUser[] = [
  {
    id: 'usr_01jk984',
    username: 'jasonhukom',
    email: 'jason@luminess.local',
    role: 'admin',
    createdAt: '2026-10-01',
  },
  {
    id: 'usr_02ff712',
    username: 'alex_cyber',
    email: 'alex@luminess.local',
    role: 'user',
    createdAt: '2026-10-20',
  },
];

export const INITIAL_MEMORIES: BotMemory[] = [
  {
    id: 'mem_01',
    botProfileId: 'bot_active',
    memoryFact: 'User prefers dark mode and uses VS Code for frontend development.',
    category: 'preference',
    createdAt: '2026-10-27',
  },
  {
    id: 'mem_02',
    botProfileId: 'bot_active',
    memoryFact: 'Project Luminess-Assist repository is located at ~/Documents/VSCODE/LuminessAssist/Luminess-Assist.',
    category: 'project',
    createdAt: '2026-10-28',
  },
  {
    id: 'mem_03',
    botProfileId: 'bot_active',
    memoryFact: 'User runs Pomodoro sprints in 25-minute intervals.',
    category: 'habit',
    createdAt: '2026-10-28',
  },
];

export interface PlatformState {
  currentProfile: BotProfile;
  featureFlags: FeatureFlags;
  releases: AppRelease[];
  globalConfig: GlobalConfigItem[];
  users: PlatformUser[];
  memories: BotMemory[];
}

export function generatePairingCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `LUMI-${num}`;
}

export function getInitialPlatformState(): PlatformState {
  if (typeof window === 'undefined') {
    return {
      currentProfile: {
        id: 'bot_active',
        userId: 'usr_01jk984',
        botName: DEFAULT_PERSONALITY.botName,
        isActive: true,
        pairingCode: 'LUMI-7489',
        appearance: { ...DEFAULT_APPEARANCE },
        personality: { ...DEFAULT_PERSONALITY },
        voice: { ...DEFAULT_VOICE },
        permissions: { ...DEFAULT_PERMISSIONS },
        createdAt: new Date().toISOString().split('T')[0],
      },
      featureFlags: { ...INITIAL_FEATURE_FLAGS },
      releases: [...INITIAL_RELEASES],
      globalConfig: [...INITIAL_GLOBAL_CONFIG],
      users: [...INITIAL_USERS],
      memories: [...INITIAL_MEMORIES],
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.currentProfile) {
        return parsed as PlatformState;
      }
    }
  } catch {
    // fallback
  }

  const initial: PlatformState = {
    currentProfile: {
      id: 'bot_active',
      userId: 'usr_01jk984',
      botName: DEFAULT_PERSONALITY.botName,
      isActive: true,
      pairingCode: generatePairingCode(),
      appearance: { ...DEFAULT_APPEARANCE },
      personality: { ...DEFAULT_PERSONALITY },
      voice: { ...DEFAULT_VOICE },
      permissions: { ...DEFAULT_PERMISSIONS },
      createdAt: new Date().toISOString().split('T')[0],
    },
    featureFlags: { ...INITIAL_FEATURE_FLAGS },
    releases: [...INITIAL_RELEASES],
    globalConfig: [...INITIAL_GLOBAL_CONFIG],
    users: [...INITIAL_USERS],
    memories: [...INITIAL_MEMORIES],
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // ignore
  }

  return initial;
}

export function savePlatformState(state: PlatformState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
