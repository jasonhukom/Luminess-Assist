export interface SpriteFrame {
  id: string;
  name: string;
  url: string;
  state: 'idle' | 'talking' | 'happy' | 'thinking' | 'surprised';
}

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

export interface BotCreator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  githubUsername?: string;
  githubRepoUrl?: string;
}

export interface BotProfile {
  id: string;
  userId: string;
  creator?: BotCreator;
  botName: string;
  tagline: string;
  isActive: boolean;
  isPublic: boolean;
  pairingCode: string;

  // Look & Media
  visualMode: 'robot' | 'sprite_frames' | 'video' | 'image' | 'orb' | 'vtuber';
  avatarImageUrl: string;
  videoUrl: string;
  framesConfig: SpriteFrame[];
  appearance: AppearanceConfig;

  // Chat & Personality
  greetingMessage: string;
  personality: PersonalityConfig;
  voice: VoiceConfig;
  permissions: BotPermissions;

  // GitHub Integration & Fork
  githubRepo: string;
  githubRepoUrl: string;
  forkedFrom: string;
  githubBranch: string;
  githubSyncStatus: 'synced' | 'pending' | 'disconnected';

  // Metrics
  likesCount: number;
  viewsCount: number;
  createdAt: string;
  updatedAt?: string;
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
  perFrameSpriteSupport: boolean;
  githubForkIntegration: boolean;
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
  displayName: string;
  email: string;
  role: 'admin' | 'user';
  bio?: string;
  avatarUrl: string;
  githubUsername?: string;
  githubRepoUrl?: string;
  createdAt: string;
}

export interface PlatformState {
  currentUser: PlatformUser | null;
  currentProfile: BotProfile;
  communityBots: BotProfile[];
  featureFlags: FeatureFlags;
  releases: AppRelease[];
  globalConfig: GlobalConfigItem[];
  users: PlatformUser[];
  memories: BotMemory[];
}

const STORAGE_KEY = 'luminess-platform-v2';
const AUTH_STORAGE_KEY = 'luminess-auth-user';

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  model: 'robot',
  color: '#38bdf8',
  paletteName: 'Cyber Cyan',
  accessory: 'headphones',
  scale: 1.0,
};

export const DEFAULT_PERSONALITY: PersonalityConfig = {
  botName: 'Luminess Prime',
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
  perFrameSpriteSupport: true,
  githubForkIntegration: true,
  longTermMemorySyncEnabled: true,
  cloudCodeAssistFallback: false,
};

export const INITIAL_RELEASES: AppRelease[] = [
  {
    versionId: '1.1.2',
    downloadUrl: 'https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.2/Luminess-Assist_1.1.2_x64_en-US.msi',
    releaseNotes: 'Intelligent AI Authentication with normalized error recovery, MariaDB persistence, Docker Compose stack, and community bot fork integration.',
    isMandatoryUpdate: false,
    status: 'latest',
    releasedAt: '2026-10-28',
  },
  {
    versionId: '1.1.3-beta',
    downloadUrl: 'https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.1.3-beta',
    releaseNotes: 'Early testing build for dynamic web customizer deep linking, frame-by-frame sprites, and video loop companion support.',
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
    releasedAt: '2026-09-15',
  },
];

export const INITIAL_COMMUNITY_BOTS: BotProfile[] = [
  {
    id: 'bot_active',
    userId: 'usr_01jk984',
    creator: {
      id: 'usr_01jk984',
      username: 'jasonhukom',
      displayName: 'Jason Hukom',
      avatarUrl: 'https://avatars.githubusercontent.com/u/104183858?v=4',
      githubUsername: 'jasonhukom',
      githubRepoUrl: 'https://github.com/jasonhukom/Luminess-Assist',
    },
    botName: 'Luminess Prime',
    tagline: 'Official Luminess flagship desktop companion with procedural reactions.',
    isActive: true,
    isPublic: true,
    pairingCode: 'LUMI-7489',
    visualMode: 'robot',
    avatarImageUrl: 'https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/public/robot-icon.svg',
    videoUrl: '',
    framesConfig: [],
    appearance: DEFAULT_APPEARANCE,
    greetingMessage: 'Hello Pilot! Luminess Prime is online and synced with your system dock.',
    personality: DEFAULT_PERSONALITY,
    voice: DEFAULT_VOICE,
    permissions: DEFAULT_PERMISSIONS,
    githubRepo: 'jasonhukom/Luminess-Assist',
    githubRepoUrl: 'https://github.com/jasonhukom/Luminess-Assist',
    forkedFrom: 'jasonhukom/Luminess-Assist',
    githubBranch: 'main',
    githubSyncStatus: 'synced',
    likesCount: 42,
    viewsCount: 380,
    createdAt: '2026-10-28',
  },
  {
    id: 'bot_pixel_kiki',
    userId: 'usr_02ff712',
    creator: {
      id: 'usr_02ff712',
      username: 'aria_cyber',
      displayName: 'Aria Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      githubUsername: 'aria-cyber',
      githubRepoUrl: 'https://github.com/aria-cyber/Luminess-Assist',
    },
    botName: 'Kiki Pixel Sprite',
    tagline: 'Frame-by-frame animated 16-bit retro study buddy with frame cycle emotes.',
    isActive: false,
    isPublic: true,
    pairingCode: 'KIKI-9021',
    visualMode: 'sprite_frames',
    avatarImageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=300&q=80',
    videoUrl: '',
    framesConfig: [
      { id: 'f1', name: 'Idle Frame 1', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', state: 'idle' },
      { id: 'f2', name: 'Idle Frame 2', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', state: 'idle' },
      { id: 'f3', name: 'Speaking Frame', url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=300&q=80', state: 'talking' },
      { id: 'f4', name: 'Joy Emote', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80', state: 'happy' },
    ],
    appearance: {
      model: 'pixel',
      color: '#ec4899',
      paletteName: 'Rose Quartz',
      accessory: 'cat_ears',
      scale: 1.1,
    },
    greetingMessage: 'Beep boop! Ready for another focused sprint together?',
    personality: {
      botName: 'Kiki Pixel Sprite',
      userName: 'Coder',
      archetype: 'study_buddy',
      formality: 2,
      humor: 7,
      verbosity: 5,
      customPrompt: 'Cheer on the user during study intervals, celebrate git commits, and provide gentle rest reminders.',
    },
    voice: {
      voiceId: 'nova-cyber',
      voiceName: 'Nova Synth',
      pitch: 1.25,
      speed: 1.05,
    },
    permissions: DEFAULT_PERMISSIONS,
    githubRepo: 'aria-cyber/Luminess-Assist',
    githubRepoUrl: 'https://github.com/aria-cyber/Luminess-Assist',
    forkedFrom: 'jasonhukom/Luminess-Assist',
    githubBranch: 'main',
    githubSyncStatus: 'synced',
    likesCount: 89,
    viewsCount: 620,
    createdAt: '2026-10-29',
  },
  {
    id: 'bot_nebula_live',
    userId: 'usr_01jk984',
    creator: {
      id: 'usr_01jk984',
      username: 'jasonhukom',
      displayName: 'Jason Hukom',
      avatarUrl: 'https://avatars.githubusercontent.com/u/104183858?v=4',
      githubUsername: 'jasonhukom',
      githubRepoUrl: 'https://github.com/jasonhukom/Luminess-Assist',
    },
    botName: 'Nebula Hologram Loop',
    tagline: 'High-resolution cinematic ambient video loop companion for lofi focus sessions.',
    isActive: false,
    isPublic: true,
    pairingCode: 'NEBU-3342',
    visualMode: 'video',
    avatarImageUrl: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=300&q=80',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1610-large.mp4',
    framesConfig: [],
    appearance: {
      model: 'vtuber',
      color: '#a855f7',
      paletteName: 'Neon Violet',
      accessory: 'halo',
      scale: 1.0,
    },
    greetingMessage: 'Cosmic greetings. I am your calm ambient focus companion.',
    personality: {
      botName: 'Nebula Hologram',
      userName: 'Traveler',
      archetype: 'butler',
      formality: 8,
      humor: 2,
      verbosity: 2,
      customPrompt: 'Deliver calm, concise, and philosophical assistance while maintaining an ambient background presence.',
    },
    voice: {
      voiceId: 'echo-soft',
      voiceName: 'Echo Soft',
      pitch: 0.95,
      speed: 0.9,
    },
    permissions: DEFAULT_PERMISSIONS,
    githubRepo: 'jasonhukom/Luminess-Assist',
    githubRepoUrl: 'https://github.com/jasonhukom/Luminess-Assist',
    forkedFrom: 'jasonhukom/Luminess-Assist',
    githubBranch: 'main',
    githubSyncStatus: 'synced',
    likesCount: 115,
    viewsCount: 940,
    createdAt: '2026-10-29',
  },
];

export const INITIAL_USERS: PlatformUser[] = [
  {
    id: 'usr_01jk984',
    username: 'jasonhukom',
    displayName: 'Jason Hukom',
    email: 'jason@luminess.local',
    role: 'admin',
    bio: 'Creator of Luminess Assist — AI Desktop Companion',
    avatarUrl: 'https://avatars.githubusercontent.com/u/104183858?v=4',
    githubUsername: 'jasonhukom',
    githubRepoUrl: 'https://github.com/jasonhukom/Luminess-Assist',
    createdAt: '2026-10-25',
  },
  {
    id: 'usr_02ff712',
    username: 'aria_cyber',
    displayName: 'Aria Vance',
    email: 'aria@luminess.local',
    role: 'user',
    bio: 'Visual designer & pixel sprite animator. Building custom live bots.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    githubUsername: 'aria-cyber',
    githubRepoUrl: 'https://github.com/aria-cyber/Luminess-Assist',
    createdAt: '2026-10-26',
  },
];

export function getInitialPlatformState(): PlatformState {
  if (typeof window === 'undefined') {
    return {
      currentUser: INITIAL_USERS[0],
      currentProfile: INITIAL_COMMUNITY_BOTS[0],
      communityBots: INITIAL_COMMUNITY_BOTS,
      featureFlags: INITIAL_FEATURE_FLAGS,
      releases: INITIAL_RELEASES,
      globalConfig: [],
      users: INITIAL_USERS,
      memories: [],
    };
  }

  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    const rawAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    const parsedAuth = rawAuth ? JSON.parse(rawAuth) : INITIAL_USERS[0];

    if (rawState) {
      const parsed = JSON.parse(rawState);
      return {
        currentUser: parsedAuth,
        currentProfile: parsed.currentProfile || INITIAL_COMMUNITY_BOTS[0],
        communityBots: parsed.communityBots && parsed.communityBots.length > 0 ? parsed.communityBots : INITIAL_COMMUNITY_BOTS,
        featureFlags: { ...INITIAL_FEATURE_FLAGS, ...(parsed.featureFlags || {}) },
        releases: parsed.releases || INITIAL_RELEASES,
        globalConfig: parsed.globalConfig || [],
        users: parsed.users || INITIAL_USERS,
        memories: parsed.memories || [],
      };
    }
  } catch (e) {
    console.warn('Failed to parse cached platform state:', e);
  }

  return {
    currentUser: INITIAL_USERS[0],
    currentProfile: INITIAL_COMMUNITY_BOTS[0],
    communityBots: INITIAL_COMMUNITY_BOTS,
    featureFlags: INITIAL_FEATURE_FLAGS,
    releases: INITIAL_RELEASES,
    globalConfig: [
      {
        key: 'active_default_ai_model',
        value: 'gemini-2.5-flash',
        description: 'Primary AI model used for zero-configuration desktop requests',
        lastUpdated: '2026-10-29',
      },
      {
        key: 'github_template_repository',
        value: 'jasonhukom/Luminess-Assist',
        description: 'Base template repository forked when users create a new bot creation',
        lastUpdated: '2026-10-29',
      },
      {
        key: 'database_engine',
        value: 'mariadb:11.4',
        description: 'Primary database engine running on Docker Compose port 3306 and Vercel serverless',
        lastUpdated: '2026-10-29',
      },
    ],
    users: INITIAL_USERS,
    memories: [
      {
        id: 'mem_01',
        botProfileId: 'bot_active',
        memoryFact: 'User prefers dark mode and uses VS Code for frontend development.',
        category: 'preference',
        createdAt: '2026-10-28',
      },
      {
        id: 'mem_02',
        botProfileId: 'bot_active',
        memoryFact: 'Project Luminess-Assist repository is forked from jasonhukom/Luminess-Assist.',
        category: 'project',
        createdAt: '2026-10-28',
      },
    ],
  };
}

export function savePlatformState(state: PlatformState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (state.currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state.currentUser));
    }
  } catch (e) {
    console.error('Failed to save platform state to storage:', e);
  }
}

export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LUMI-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ========================================================
// API Client Functions (Django MariaDB Backend)
// ========================================================

export async function fetchPlatformStateFromBackend(): Promise<PlatformState | null> {
  try {
    const res = await fetch('/api/state/');
    if (!res.ok) return null;
    const data = await res.json();

    const localState = getInitialPlatformState();
    return {
      currentUser: localState.currentUser,
      currentProfile: data.currentProfile || localState.currentProfile,
      communityBots: data.communityBots && data.communityBots.length > 0 ? data.communityBots : localState.communityBots,
      featureFlags: data.featureFlags || localState.featureFlags,
      releases: data.releases || localState.releases,
      globalConfig: data.globalConfig || localState.globalConfig,
      users: data.users || localState.users,
      memories: data.memories || localState.memories,
    };
  } catch {
    return null;
  }
}

export async function registerUserAccount(payload: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  bio?: string;
  githubUsername?: string;
}): Promise<{ user: PlatformUser } | { error: string }> {
  try {
    const res = await fetch('/api/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Failed to register account.' };
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
    }
    return { user: data.user };
  } catch (e) {
    // Offline / demo fallback
    const mockUser: PlatformUser = {
      id: `usr_${Date.now().toString(36)}`,
      username: payload.username.toLowerCase(),
      displayName: payload.displayName || payload.username,
      email: payload.email,
      role: 'user',
      bio: payload.bio || '',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${payload.username}`,
      githubUsername: payload.githubUsername || '',
      githubRepoUrl: payload.githubUsername ? `https://github.com/${payload.githubUsername}/Luminess-Assist` : '',
      createdAt: new Date().toISOString().split('T')[0],
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
    }
    return { user: mockUser };
  }
}

export async function loginUserAccount(payload: {
  username: string;
  password: string;
}): Promise<{ user: PlatformUser } | { error: string }> {
  try {
    const res = await fetch('/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || 'Invalid username or password.' };
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
    }
    return { user: data.user };
  } catch {
    // Demo fallback for existing accounts
    const match = INITIAL_USERS.find(
      (u) => u.username === payload.username.toLowerCase() || u.email === payload.username.toLowerCase()
    );
    if (match) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(match));
      }
      return { user: match };
    }
    return { error: 'Invalid login credentials.' };
  }
}

export async function saveBotCreationToBackend(bot: Partial<BotProfile>): Promise<BotProfile> {
  try {
    const res = await fetch('/api/bots/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bot),
    });
    if (res.ok) {
      const data = await res.json();
      return data.bot;
    }
  } catch {
    // Fallback if backend is not currently running
  }

  // Construct local fallback
  return {
    id: bot.id || `bot_${Date.now().toString(36)}`,
    userId: bot.userId || 'usr_01jk984',
    creator: bot.creator,
    botName: bot.botName || 'Custom Bot',
    tagline: bot.tagline || 'Created with Luminess Studio',
    isActive: bot.isActive ?? false,
    isPublic: bot.isPublic ?? true,
    pairingCode: bot.pairingCode || generatePairingCode(),
    visualMode: bot.visualMode || 'robot',
    avatarImageUrl: bot.avatarImageUrl || '',
    videoUrl: bot.videoUrl || '',
    framesConfig: bot.framesConfig || [],
    appearance: bot.appearance || DEFAULT_APPEARANCE,
    greetingMessage: bot.greetingMessage || 'Hello Pilot! I am ready to assist.',
    personality: bot.personality || DEFAULT_PERSONALITY,
    voice: bot.voice || DEFAULT_VOICE,
    permissions: bot.permissions || DEFAULT_PERMISSIONS,
    githubRepo: bot.githubRepo || 'jasonhukom/Luminess-Assist',
    githubRepoUrl: bot.githubRepoUrl || 'https://github.com/jasonhukom/Luminess-Assist',
    forkedFrom: bot.forkedFrom || 'jasonhukom/Luminess-Assist',
    githubBranch: bot.githubBranch || 'main',
    githubSyncStatus: 'synced',
    likesCount: 0,
    viewsCount: 1,
    createdAt: new Date().toISOString().split('T')[0],
  };
}

export async function testBotChat(botId: string, message: string, botMeta?: Partial<BotProfile>): Promise<{ reply: string; emotion: string }> {
  try {
    const res = await fetch(`/api/bots/${botId}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, ...botMeta }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback
  }

  const botName = botMeta?.botName || 'Luminess';
  const archetype = botMeta?.personality?.archetype || 'witty_hacker';
  const replies: Record<string, string[]> = {
    study_buddy: [
      `[${botName}]: That was an awesome 25-minute sprint! Don't forget to grab some water, Pilot!`,
      `[${botName}]: Added to your study checklist. What's our next topic?`,
    ],
    coder: [
      `[${botName}]: Code synchronized with your GitHub fork! Ready to compile on MariaDB.`,
      `[${botName}]: Remember to handle edge cases and check async exceptions!`,
    ],
    butler: [
      `[${botName}]: Right away, sir. Desktop automation and system parameters are monitored.`,
      `[${botName}]: I have logged this request in your persistent MariaDB memory records.`,
    ],
    witty_hacker: [
      `[${botName}]: Beep boop! Automated that in 0.04 seconds. You owe me a virtual battery!`,
      `[${botName}]: Connected and verified! If bugs sneak into your code, I'll laser them!`,
    ],
  };

  const pool = replies[archetype] || replies.witty_hacker;
  return {
    reply: pool[Math.floor(Math.random() * pool.length)],
    emotion: 'speaking',
  };
}

export async function likeBotCreation(botId: string): Promise<number> {
  try {
    const res = await fetch(`/api/bots/${botId}/like/`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return data.likesCount;
    }
  } catch {
    // Fallback
  }
  return 1;
}

export async function connectGithubForkAction(githubUsername: string): Promise<{
  forkUrl: string;
  forkedRepository: string;
}> {
  try {
    const res = await fetch('/api/github/fork/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubUsername }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        forkUrl: data.forkUrl,
        forkedRepository: data.forkedRepository,
      };
    }
  } catch {
    // Fallback
  }

  const cleanUser = githubUsername.trim() || 'my-account';
  return {
    forkUrl: `https://github.com/${cleanUser}/Luminess-Assist`,
    forkedRepository: `${cleanUser}/Luminess-Assist`,
  };
}
