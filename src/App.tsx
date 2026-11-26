import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import './App.css';
import { Robot } from './components/Robot.tsx';
import { LuminessBootScreen } from './components/LuminessBootScreen.tsx';
import type { BotAngerTriggerSignal, Emotion, VisualEmotion } from './components/Robot.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { FloatingHistoryBox } from './components/FloatingHistoryBox.tsx';
import { FloatingSettingsBox, type SettingsTabId } from './components/FloatingSettingsBox.tsx';
import { FloatingMusicBox } from './components/FloatingMusicBox.tsx';
import { FloatingWellbeingBox, type WellbeingTabId } from './components/FloatingWellbeingBox.tsx';
import { FloatingTaskManagerBox } from './components/FloatingTaskManagerBox.tsx';
import { StartupCheckinModal } from './components/StartupCheckinModal.tsx';
import {
  buildRecentRealAppsList,
  buildWellbeingRangeReport,
  clearWellbeingHistoryOnMachine,
  createEmptyWellbeingHistory,
  fetchForegroundAppSample,
  fetchInstalledRealAppsFromMachine,
  fetchTaskManagerSnapshot,
  isLuminessSelfApp,
  loadWellbeingHistoryFromMachine,
  recordForegroundUsageSample,
  resolveAppProfile,
  saveWellbeingHistoryToMachine,
  type InstalledRealApp,
  type RecentRealAppItem,
  type TaskManagerSnapshot,
  type WellbeingCommandAction,
  type WellbeingHistoryStore,
  type WellbeingRange,
} from './lib/digitalWellbeing.ts';
import {
  DEFAULT_DRINK_MESSAGE,
  formatCountdownMs,
  getNextDrinkDueMs,
  logDrinkGlass,
  normalizeDrinkReminderConfig,
  playGentleWaterChime,
  shouldTriggerDrinkReminder,
  snoozeDrinkReminder,
  type DrinkReminderConfig,
} from './lib/drinkReminder.ts';
import {
  AmbientSynthController,
  BUILT_IN_AMBIENT_TRACKS,
  buildUrlTrack,
  mergeMusicPlaylist,
  normalizeMusicPlayerConfig,
  pickNextTrackIndex,
  resolveLocalStreamUrl,
  scanLocalMusicFromMachine,
  type MusicCommandAction,
  type MusicLoopMode,
  type MusicPlayerConfig,
  type MusicPlayerTrack,
} from './lib/musicPlayer.ts';
import { registerAssistantRuntimeHandlers } from './lib/assistantRuntime.ts';
import {
  applyBotAppearanceCssVars,
  createDefaultBotCustomization,
  fetchForkManifestFromGitHub,
  type CustomApiFormat,
} from './lib/botCustomization.ts';
import {
  runAgent,
  getGoogleSession,
  loginWithGoogle,
  logoutGoogle,
  ensureValidGoogleSession,
  getProviderApiKey,
  setProviderApiKey,
  getSelectedProvider,
  setSelectedProvider,
  hasAnyProviderKey,
  setApiKey,
  verifyProviderConnection,
  checkAntigravityCliStatus,
  loadMachineCredentialsOnStartup,
  saveAllProviderKeysToMachine,
  type AntigravityCliStatus,
} from './lib/gemini.ts';
import {
  normalizeAIError,
  type NormalizedAIError,
  type AIConnectionState,
} from './lib/aiErrors.ts';
import type {
  Message,
  ToolPermissionRequest,
  PermissionDecision,
  GoogleUserSession,
  AIProvider,
} from './lib/gemini.ts';
import { invoke } from '@tauri-apps/api/core';
import { recordChatInteraction } from './lib/personality.ts';
import { listen } from '@tauri-apps/api/event';
import {
  loadActiveChatMessages,
  saveActiveChatMessages,
  loadAllChatSessions,
  createNewSession,
  deleteChatSession,
  clearAllLocalChatHistory,
  associateSessionsWithGoogleAccount,
  type ChatSession,
} from './lib/chatHistory.ts';
import {
  STORAGE_TIER_OPTIONS,
  STORAGE_RECOMMENDATION_EXPLANATION,
  getCachedAppConfig,
  loadAppConfigFromMachine,
  saveAppConfigToMachine,
  loadDatabaseFromMachine,
  getMachineStorageStatus,
  getUserMemories,
  addExplicitUserMemory,
  deleteUserMemory,
  clearAllUserMemories,
  syncMemoriesWithGoogleAccount,
  getSearchHistory,
  clearSearchHistory,
  type AppConfigJson,
  type StorageStatus,
  type StorageTierId,
  type UserMemoryItem,
  type SearchHistoryEntry,
  type FloatingBoxPosition,
} from './lib/memoryAndStorage.ts';
import {
  inspectLocalAiHardware,
  discoverLocalAiServers,
  type LocalAiHardwareReport,
  type LocalAiServerStatus,
} from './lib/opencode.ts';
import {
  ALL_FLOATING_BOX_IDS,
  BOX_SIZE_CONSTRAINTS,
  botVisualToStagePos,
  computeBotFollowLayout,
  computePresetDashboardViaRust,
  computeStageObstacles,
  DEFAULT_BOX_GAP,
  DEFAULT_SCREEN_MARGIN,
  solveSmartBoxLayout,
  type BoxRect,
  type FloatingBoxId,
} from './lib/floatingWindows.ts';
import {
  Sparkles,
  Loader2,
  LogOut,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
  AlertTriangle,
  TerminalSquare,
  Zap,
  HardDrive,
  Droplets,
  X,
} from 'lucide-react';

const PROVIDER_INFO: Record<
  AIProvider,
  {
    name: string;
    mark: string;
    keyUrl: string;
    btnLabel: string;
    placeholder: string;
    colorClass: string;
  }
> = {
  gemini: {
    name: 'Gemini',
    mark: 'G',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    btnLabel: 'Get Free Gemini API Key (Google AI Studio)',
    placeholder: 'Paste Gemini API Key (AIzaSy...)',
    colorClass: 'gemini',
  },
  claude: {
    name: 'Claude',
    mark: 'C',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    btnLabel: 'Get Anthropic Claude API Key',
    placeholder: 'Paste Claude API Key (sk-ant-...)',
    colorClass: 'claude',
  },
  codex: {
    name: 'Codex',
    mark: '⌘',
    keyUrl: 'https://platform.openai.com/api-keys',
    btnLabel: 'Get OpenAI API Key (Codex)',
    placeholder: 'Paste OpenAI API Key (sk-...)',
    colorClass: 'codex',
  },
  custom: {
    name: 'Custom API',
    mark: '⚙',
    keyUrl: '',
    btnLabel: 'Any Custom API / No Preset (OpenAI / Anthropic / Gemini / Proxy)',
    placeholder: 'Paste Any API Key (optional for local/no-auth endpoints)',
    colorClass: 'custom',
  },
  offline: {
    name: 'Local AI',
    mark: '⚡',
    keyUrl: '',
    btnLabel: '100% Local AI (Ollama / llama.cpp / OpenCode)',
    placeholder: 'Local AI Mode (Ollama / llama.cpp / OpenCode / Built-in)',
    colorClass: 'offline',
  },
};

const CHAT_BOT_GAP = 28;

function App() {
  const [googleUser, setGoogleUser] = useState<GoogleUserSession | null>(() => getGoogleSession());
  const [bootComplete, setBootComplete] = useState<boolean>(false);
  const [selectedProvider, setSelectedProviderState] = useState<AIProvider>(() => getSelectedProvider());
  const [providerKeys, setProviderKeys] = useState<Record<AIProvider, string>>(() => ({
    gemini: getProviderApiKey('gemini'),
    claude: getProviderApiKey('claude'),
    codex: getProviderApiKey('codex'),
    custom: getProviderApiKey('custom'),
    offline: getProviderApiKey('offline'),
  }));
  const [showKey, setShowKey] = useState<boolean>(false);
  const [showApiModal, setShowApiModal] = useState<boolean>(() =>
    !localStorage.getItem('LUMINNESS_SETUP_COMPLETED') ||
    (!getGoogleSession() && !hasAnyProviderKey())
  );
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [normalizedError, setNormalizedError] = useState<NormalizedAIError | null>(null);
  const [verifiedBanner, setVerifiedBanner] = useState<string | null>(null);
  const [angerTriggerSignal, setAngerTriggerSignal] = useState<BotAngerTriggerSignal | null>(null);
  const [connectionState, setConnectionState] = useState<AIConnectionState>(() => {
    if (!hasAnyProviderKey() && !getGoogleSession()) return 'not_configured';
    return 'ready_to_sign_in';
  });
  const [antigravityStatus, setAntigravityStatus] = useState<AntigravityCliStatus | null>(null);

  // Persistent Config, Storage Quota, User Memories & Search Database State
  const [appConfig, setAppConfig] = useState<AppConfigJson>(() => getCachedAppConfig());
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [memories, setMemories] = useState<UserMemoryItem[]>(() => getUserMemories());
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => getSearchHistory());
  const [hardwareReport, setHardwareReport] = useState<LocalAiHardwareReport | null>(null);
  const [localServers, setLocalServers] = useState<LocalAiServerStatus[]>([]);
  const [isScanningLocalAi, setIsScanningLocalAi] = useState<boolean>(false);

  // Five Independent Floating UI Boxes (History, Settings, Music Player, Digital Wellbeing, Task Manager) + Drink Reminder Alert
  const [historyBoxOpen, setHistoryBoxOpen] = useState<boolean>(false);
  const [settingsBoxOpen, setSettingsBoxOpen] = useState<boolean>(false);
  const [musicBoxOpen, setMusicBoxOpen] = useState<boolean>(false);
  const [wellbeingBoxOpen, setWellbeingBoxOpen] = useState<boolean>(false);
  const [taskManagerBoxOpen, setTaskManagerBoxOpen] = useState<boolean>(false);
  const [compactBoxes, setCompactBoxes] = useState<Record<FloatingBoxId, boolean>>({
    history: false,
    settings: false,
    music: false,
    wellbeing: false,
    taskmanager: false,
  });
  const [boxIdleSeconds, setBoxIdleSeconds] = useState<Partial<Record<FloatingBoxId, number>>>({});
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('connectors');
  const [settingsTabSeq, setSettingsTabSeq] = useState<number>(0);
  const [wellbeingTab, setWellbeingTab] = useState<WellbeingTabId>('wellbeing');
  const [wellbeingTabSeq, setWellbeingTabSeq] = useState<number>(0);
  const [wellbeingRange, setWellbeingRange] = useState<WellbeingRange>('day');
  const [historyBoxPos, setHistoryBoxPos] = useState<FloatingBoxPosition>(() => {
    const cfg = getCachedAppConfig();
    return cfg.floating_positions?.history || { x: 20, y: 20, width: 350, height: 440, visible: false };
  });
  const [settingsBoxPos, setSettingsBoxPos] = useState<FloatingBoxPosition>(() => {
    const cfg = getCachedAppConfig();
    return cfg.floating_positions?.settings || { x: 860, y: 430, width: 430, height: 520, visible: false };
  });
  const [musicBoxPos, setMusicBoxPos] = useState<FloatingBoxPosition>(() => {
    const cfg = getCachedAppConfig();
    return cfg.floating_positions?.music || { x: 450, y: 20, width: 392, height: 420, visible: false };
  });
  const [wellbeingBoxPos, setWellbeingBoxPos] = useState<FloatingBoxPosition>(() => {
    const cfg = getCachedAppConfig();
    return cfg.floating_positions?.wellbeing || { x: 20, y: 430, width: 520, height: 500, visible: false };
  });
  const [taskManagerBoxPos, setTaskManagerBoxPos] = useState<FloatingBoxPosition>(() => {
    const cfg = getCachedAppConfig();
    return cfg.floating_positions?.taskmanager || { x: 860, y: 20, width: 440, height: 420, visible: false };
  });

  const [wellbeingHistory, setWellbeingHistory] = useState<WellbeingHistoryStore>(() =>
    createEmptyWellbeingHistory()
  );
  const [installedRealApps, setInstalledRealApps] = useState<InstalledRealApp[]>([]);
  const [startupCheckinOpen, setStartupCheckinOpen] = useState<boolean>(true);
  const [activeForegroundApp, setActiveForegroundApp] = useState<string | null>(null);
  const [taskSnapshot, setTaskSnapshot] = useState<TaskManagerSnapshot | null>(null);
  const [isPollingTasks, setIsPollingTasks] = useState<boolean>(true);

  const [drinkAlertVisible, setDrinkAlertVisible] = useState<boolean>(false);
  const [drinkCountdownLabel, setDrinkCountdownLabel] = useState<string>('45m 00s');

  const [localMusicTracks, setLocalMusicTracks] = useState<MusicPlayerTrack[]>([]);
  const [resolvedMusicFolder, setResolvedMusicFolder] = useState<string>('');
  const [isScanningMusic, setIsScanningMusic] = useState<boolean>(false);
  const [musicIsPlaying, setMusicIsPlaying] = useState<boolean>(false);
  const [musicCurrentTime, setMusicCurrentTime] = useState<number>(0);
  const [musicDuration, setMusicDuration] = useState<number>(0);
  const [musicPlayerError, setMusicPlayerError] = useState<string | null>(null);

  // Anchor coordinates for the Robot + Chatbox when full-screen floating workspace is active
  const [companionAnchor, setCompanionAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ left: 160, top: 140, width: 732, height: 644 });

  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatSide, setChatSide] = useState<'left' | 'right'>('left');
  const [chatVert, setChatVert] = useState<'up' | 'down'>('up');
  const [emotion, setEmotion] = useState<Emotion>('idle');
  const [visualEmotion, setVisualEmotion] = useState<VisualEmotion>('idle');
  const [brokenSeconds, setBrokenSeconds] = useState<number>(0);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return loadActiveChatMessages().sessionId;
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    return loadActiveChatMessages().messages;
  });
  const [allSessions, setAllSessions] = useState<ChatSession[]>(() => loadAllChatSessions());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isDraggingBot, setIsDraggingBot] = useState<boolean>(false);

  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({
    width: 380,
    height: 500,
  });
  const [robotSize, setRobotSize] = useState<number>(180);

  const [autoApprove, setAutoApprove] = useState<boolean>(false);
  const autoApproveRef = useRef<boolean>(false);
  const [pendingPermission, setPendingPermission] = useState<ToolPermissionRequest | null>(null);
  const permissionResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const modalCardRef = useRef<HTMLDivElement>(null);
  const chatWrapRef = useRef<HTMLDivElement>(null);
  const robotWrapRef = useRef<HTMLDivElement>(null);
  const historyBoxWrapRef = useRef<HTMLDivElement>(null);
  const settingsBoxWrapRef = useRef<HTMLDivElement>(null);
  const musicBoxWrapRef = useRef<HTMLDivElement>(null);
  const wellbeingBoxWrapRef = useRef<HTMLDivElement>(null);
  const taskManagerBoxWrapRef = useRef<HTMLDivElement>(null);
  const drinkAlertWrapRef = useRef<HTMLDivElement>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<AmbientSynthController | null>(null);
  const appConfigRef = useRef<AppConfigJson>(appConfig);
  const drinkAlertVisibleRef = useRef<boolean>(false);
  const wellbeingHistoryRef = useRef<WellbeingHistoryStore>(wellbeingHistory);

  const preferredBoxSizesRef = useRef<Record<FloatingBoxId, { width: number; height: number }>>({
    history: {
      width: historyBoxPos.width || BOX_SIZE_CONSTRAINTS.history.defaultWidth,
      height: historyBoxPos.height || BOX_SIZE_CONSTRAINTS.history.defaultHeight,
    },
    settings: {
      width: settingsBoxPos.width || BOX_SIZE_CONSTRAINTS.settings.defaultWidth,
      height: settingsBoxPos.height || BOX_SIZE_CONSTRAINTS.settings.defaultHeight,
    },
    music: {
      width: musicBoxPos.width || BOX_SIZE_CONSTRAINTS.music.defaultWidth,
      height: musicBoxPos.height || BOX_SIZE_CONSTRAINTS.music.defaultHeight,
    },
    wellbeing: {
      width: wellbeingBoxPos.width || BOX_SIZE_CONSTRAINTS.wellbeing.defaultWidth,
      height: wellbeingBoxPos.height || BOX_SIZE_CONSTRAINTS.wellbeing.defaultHeight,
    },
    taskmanager: {
      width: taskManagerBoxPos.width || BOX_SIZE_CONSTRAINTS.taskmanager.defaultWidth,
      height: taskManagerBoxPos.height || BOX_SIZE_CONSTRAINTS.taskmanager.defaultHeight,
    },
  });
  const botFollowOffsetsRef = useRef<Partial<Record<FloatingBoxId, { dx: number; dy: number }>>>({});
  const boxLastActiveRef = useRef<Record<FloatingBoxId, number>>({
    history: 0,
    settings: 0,
    music: 0,
    wellbeing: 0,
    taskmanager: 0,
  });
  const skipNextWorkspaceAnchorInitRef = useRef<boolean>(false);
  const companionAnchorRef = useRef(companionAnchor);
  const floatingWorkspaceActiveRef = useRef<boolean>(false);

  useEffect(() => {
    companionAnchorRef.current = companionAnchor;
  }, [companionAnchor]);

  const companionReadyRef = useRef<boolean>(false);
  const companionCenteredDoneRef = useRef<boolean>(false);
  const modalPlacedRef = useRef<boolean>(false);
  const manualSideOverrideRef = useRef<boolean>(false);
  const manualVertOverrideRef = useRef<boolean>(false);
  const prevFloatingWorkspaceRef = useRef<boolean>(false);
  const prevModeRef = useRef<{
    showApiModal: boolean;
    chatOpen: boolean;
    chatSide: 'left' | 'right';
    chatVert: 'up' | 'down';
    robotSize: number;
  }>({
    showApiModal: true,
    chatOpen: false,
    chatSide: 'left',
    chatVert: 'up',
    robotSize: 180,
  });

  useEffect(() => {
    autoApproveRef.current = autoApprove;
  }, [autoApprove]);

  const refreshMemoryAndStorageData = useCallback(async (email?: string | null) => {
    setMemories(getUserMemories(email !== undefined ? email : googleUser?.email));
    setSearchHistory(getSearchHistory());
    setAllSessions(loadAllChatSessions());
    const status = await getMachineStorageStatus();
    setStorageStatus(status);
  }, [googleUser?.email]);

  const refreshLocalAiStatus = useCallback(async () => {
    setIsScanningLocalAi(true);
    try {
      const [hw, srvs] = await Promise.all([
        inspectLocalAiHardware(),
        discoverLocalAiServers(),
      ]);
      setHardwareReport(hw);
      setLocalServers(srvs);
    } finally {
      setIsScanningLocalAi(false);
    }
  }, []);

  // Load DPAPI Machine Vault, config.json, database.json, and Local AI status on startup
  useEffect(() => {
    const initMachineData = async () => {
      const [creds, cfg, , installedApps] = await Promise.all([
        loadMachineCredentialsOnStartup(),
        loadAppConfigFromMachine(),
        loadDatabaseFromMachine(),
        fetchInstalledRealAppsFromMachine(),
      ]);

      setInstalledRealApps(installedApps);
      setProviderKeys(creds.keys);
      setSelectedProviderState(getSelectedProvider());
      setAppConfig(cfg);
      if (cfg.floating_positions?.history) {
        setHistoryBoxPos(cfg.floating_positions.history);
        preferredBoxSizesRef.current.history = {
          width: cfg.floating_positions.history.width,
          height: cfg.floating_positions.history.height,
        };
      }
      if (cfg.floating_positions?.settings) {
        setSettingsBoxPos(cfg.floating_positions.settings);
        preferredBoxSizesRef.current.settings = {
          width: cfg.floating_positions.settings.width,
          height: cfg.floating_positions.settings.height,
        };
      }
      if (cfg.floating_positions?.music) {
        setMusicBoxPos(cfg.floating_positions.music);
        preferredBoxSizesRef.current.music = {
          width: cfg.floating_positions.music.width,
          height: cfg.floating_positions.music.height,
        };
      }
      if (cfg.floating_positions?.wellbeing) {
        setWellbeingBoxPos(cfg.floating_positions.wellbeing);
        preferredBoxSizesRef.current.wellbeing = {
          width: cfg.floating_positions.wellbeing.width,
          height: cfg.floating_positions.wellbeing.height,
        };
      }
      if (cfg.floating_positions?.taskmanager) {
        setTaskManagerBoxPos(cfg.floating_positions.taskmanager);
        preferredBoxSizesRef.current.taskmanager = {
          width: cfg.floating_positions.taskmanager.width,
          height: cfg.floating_positions.taskmanager.height,
        };
      }

      if (creds.googleSession) {
        setGoogleUser(creds.googleSession);
        if (creds.googleSession.email) {
          syncMemoriesWithGoogleAccount(creds.googleSession.email);
          associateSessionsWithGoogleAccount(creds.googleSession.email);
        }
      }

      const activeChat = loadActiveChatMessages();
      setActiveSessionId(activeChat.sessionId);
      setMessages(activeChat.messages);
      setAllSessions(loadAllChatSessions());
      setMemories(getUserMemories(creds.googleSession?.email));
      setSearchHistory(getSearchHistory());

      if (
        localStorage.getItem('LUMINNESS_SETUP_COMPLETED') &&
        (creds.googleSession || hasAnyProviderKey())
      ) {
        setShowApiModal(false);
      }

      if (cfg.auto_start_windows ?? true) {
        try {
          const ensured = await invoke<boolean>('ensure_windows_startup');
          if (ensured && !cfg.startup_registered_once) {
            const updatedCfg = await saveAppConfigToMachine({
              ...cfg,
              auto_start_windows: true,
              startup_registered_once: true,
            });
            setAppConfig(updatedCfg);
          }
        } catch {
          // Ignore when outside Windows desktop runtime
        }
      }

      const status = await getMachineStorageStatus();
      setStorageStatus(status);
      void refreshLocalAiStatus();

      const forkCfg = cfg.bot_customization;
      if (
        forkCfg?.autoSyncOnStartup &&
        forkCfg.repo &&
        forkCfg.repo !== 'jasonhukom/Luminess-Assist'
      ) {
        const synced = await fetchForkManifestFromGitHub(
          forkCfg.repo,
          forkCfg.branch || 'main',
          forkCfg
        );
        if (synced.ok && synced.manifest) {
          const updated = await saveAppConfigToMachine({
            ...cfg,
            bot_customization: synced.manifest,
          });
          setAppConfig(updated);
        }
      }
    };

    void initMachineData();
  }, [refreshLocalAiStatus]);

  const floatingBoxesStateRef = useRef({
    open: {
      history: historyBoxOpen,
      settings: settingsBoxOpen,
      music: musicBoxOpen,
      wellbeing: wellbeingBoxOpen,
      taskmanager: taskManagerBoxOpen,
    },
    pos: {
      history: historyBoxPos,
      settings: settingsBoxPos,
      music: musicBoxPos,
      wellbeing: wellbeingBoxPos,
      taskmanager: taskManagerBoxPos,
    },
    compact: compactBoxes,
    chatOpen,
    chatSide,
    chatVert,
    panelSize,
    robotSize,
  });

  useEffect(() => {
    floatingBoxesStateRef.current = {
      open: {
        history: historyBoxOpen,
        settings: settingsBoxOpen,
        music: musicBoxOpen,
        wellbeing: wellbeingBoxOpen,
        taskmanager: taskManagerBoxOpen,
      },
      pos: {
        history: historyBoxPos,
        settings: settingsBoxPos,
        music: musicBoxPos,
        wellbeing: wellbeingBoxPos,
        taskmanager: taskManagerBoxPos,
      },
      compact: compactBoxes,
      chatOpen,
      chatSide,
      chatVert,
      panelSize,
      robotSize,
    };
  }, [
    historyBoxOpen,
    settingsBoxOpen,
    musicBoxOpen,
    wellbeingBoxOpen,
    taskManagerBoxOpen,
    historyBoxPos,
    settingsBoxPos,
    musicBoxPos,
    wellbeingBoxPos,
    taskManagerBoxPos,
    compactBoxes,
    chatOpen,
    chatSide,
    chatVert,
    panelSize,
    robotSize,
  ]);

  const setBoxOpenById = useCallback((id: FloatingBoxId, open: boolean) => {
    if (id === 'history') setHistoryBoxOpen(open);
    else if (id === 'settings') setSettingsBoxOpen(open);
    else if (id === 'music') setMusicBoxOpen(open);
    else if (id === 'wellbeing') setWellbeingBoxOpen(open);
    else setTaskManagerBoxOpen(open);
  }, []);

  const setBoxPosById = useCallback((id: FloatingBoxId, next: FloatingBoxPosition) => {
    const apply = (prev: FloatingBoxPosition) =>
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height &&
      prev.visible === next.visible
        ? prev
        : next;
    if (id === 'history') setHistoryBoxPos(apply);
    else if (id === 'settings') setSettingsBoxPos(apply);
    else if (id === 'music') setMusicBoxPos(apply);
    else if (id === 'wellbeing') setWellbeingBoxPos(apply);
    else setTaskManagerBoxPos(apply);
  }, []);

  const getCurrentObstaclesForAnchor = useCallback(
    (anchorLeft: number, anchorTop: number): { botRect: BoxRect; chatRect: BoxRect | null; obstacles: BoxRect[] } => {
      const snap = floatingBoxesStateRef.current;
      const stage = computeStageObstacles({
        anchorLeft,
        anchorTop,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        chatOpen: snap.chatOpen,
        robotSize: snap.robotSize,
        chatWidth: snap.panelSize.width,
        chatHeight: snap.panelSize.height,
        chatSide: snap.chatSide,
        chatVert: snap.chatVert,
      });

      let { chatRect } = stage;
      if (snap.chatOpen && chatWrapRef.current) {
        const r = chatWrapRef.current.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) {
          chatRect = { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
        }
      }

      const obstacles: BoxRect[] = chatRect ? [stage.botRect, chatRect] : [stage.botRect];
      return { botRect: stage.botRect, chatRect, obstacles };
    },
    []
  );

  const touchBoxActivity = useCallback((id: FloatingBoxId) => {
    boxLastActiveRef.current[id] = Date.now();
    setBoxIdleSeconds((prev) => {
      if (prev[id] === undefined) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const rebalanceOpenBoxes = useCallback(
    (options?: {
      openOverrides?: Partial<Record<FloatingBoxId, boolean>>;
      posOverrides?: Partial<Record<FloatingBoxId, FloatingBoxPosition>>;
      compactOverrides?: Partial<Record<FloatingBoxId, boolean>>;
      priorityId?: FloatingBoxId;
      updateFollowOffsets?: boolean;
      persistMoveId?: FloatingBoxId;
    }) => {
      const snap = floatingBoxesStateRef.current;
      const openMap: Record<FloatingBoxId, boolean> = {
        ...snap.open,
        ...(options?.openOverrides || {}),
      };
      const posMap: Record<FloatingBoxId, FloatingBoxPosition> = {
        ...snap.pos,
        ...(options?.posOverrides || {}),
      };
      const compactMap: Record<FloatingBoxId, boolean> = {
        ...snap.compact,
        ...(options?.compactOverrides || {}),
      };

      const openIds = ALL_FLOATING_BOX_IDS.filter((id) => openMap[id]);
      if (openIds.length === 0) return;

      const anchor = companionAnchorRef.current;
      const { botRect, obstacles } = getCurrentObstaclesForAnchor(anchor.left, anchor.top);

      const priorityOrder: FloatingBoxId[] = options?.priorityId
        ? [options.priorityId, ...ALL_FLOATING_BOX_IDS.filter((id) => id !== options.priorityId)]
        : ALL_FLOATING_BOX_IDS;

      const specs = openIds.map((id) => {
        const limits = BOX_SIZE_CONSTRAINTS[id];
        const cur = posMap[id];
        const pref = preferredBoxSizesRef.current[id] || {
          width: limits.defaultWidth,
          height: limits.defaultHeight,
        };
        const targetW = compactMap[id] ? Math.max(limits.minWidth, Math.round(pref.width * 0.72)) : pref.width;
        const targetH = compactMap[id] ? Math.max(limits.minHeight, Math.round(pref.height * 0.7)) : pref.height;

        return {
          id,
          desiredX: cur.x,
          desiredY: cur.y,
          preferredWidth: targetW,
          preferredHeight: targetH,
          minWidth: limits.minWidth,
          minHeight: limits.minHeight,
          maxWidth: limits.maxWidth,
          maxHeight: limits.maxHeight,
        };
      });

      const solved = solveSmartBoxLayout({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        gap: DEFAULT_BOX_GAP,
        margin: DEFAULT_SCREEN_MARGIN,
        priorityOrder,
        obstacles,
        boxes: specs,
      });

      for (const id of openIds) {
        const s = solved[id];
        if (!s) continue;
        const updatedPos: FloatingBoxPosition = {
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          visible: true,
        };
        setBoxPosById(id, updatedPos);
        if (options?.updateFollowOffsets || !botFollowOffsetsRef.current[id]) {
          botFollowOffsetsRef.current[id] = {
            dx: s.x - botRect.x,
            dy: s.y - botRect.y,
          };
        }
      }

      if (options?.persistMoveId && solved[options.persistMoveId]) {
        const s = solved[options.persistMoveId];
        const persisted: FloatingBoxPosition = {
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          visible: true,
        };
        setAppConfig((prev) => {
          const nextCfg: AppConfigJson = {
            ...prev,
            floating_positions: {
              ...prev.floating_positions,
              [options.persistMoveId!]: persisted,
            },
          };
          void saveAppConfigToMachine(nextCfg);
          return nextCfg;
        });
      }
    },
    [getCurrentObstaclesForAnchor, setBoxPosById]
  );

  // Automatically rebalance open floating boxes whenever Chatbox opens/flips/resizes or boxes change
  useEffect(() => {
    if (
      !historyBoxOpen &&
      !settingsBoxOpen &&
      !musicBoxOpen &&
      !wellbeingBoxOpen &&
      !taskManagerBoxOpen
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      rebalanceOpenBoxes();
    }, 36);
    const onWinResize = () => rebalanceOpenBoxes();
    window.addEventListener('resize', onWinResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onWinResize);
    };
  }, [
    chatOpen,
    chatSide,
    chatVert,
    panelSize,
    historyBoxOpen,
    settingsBoxOpen,
    musicBoxOpen,
    wellbeingBoxOpen,
    taskManagerBoxOpen,
    compactBoxes,
    rebalanceOpenBoxes,
  ]);

  // 1-3 minute auto-close watchdog for unused floating boxes (never auto-closes ChatPanel)
  useEffect(() => {
    if (
      !historyBoxOpen &&
      !settingsBoxOpen &&
      !musicBoxOpen &&
      !wellbeingBoxOpen &&
      !taskManagerBoxOpen
    ) {
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      const timeoutSec = Math.max(
        60,
        Math.min(180, appConfigRef.current.box_auto_close_seconds ?? 120)
      );
      const timeoutMs = timeoutSec * 1000;
      const snap = floatingBoxesStateRef.current;
      const nextIdle: Partial<Record<FloatingBoxId, number>> = {};
      let closedAny = false;

      for (const boxId of ALL_FLOATING_BOX_IDS) {
        if (!snap.open[boxId]) continue;
        const lastActive = boxLastActiveRef.current[boxId] || now;
        const elapsed = now - lastActive;
        const leftSec = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
        if (leftSec <= 0) {
          closedAny = true;
          setBoxOpenById(boxId, false);
        } else {
          nextIdle[boxId] = leftSec;
        }
      }

      setBoxIdleSeconds(nextIdle);
      if (closedAny) {
        window.setTimeout(() => rebalanceOpenBoxes(), 30);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [
    historyBoxOpen,
    settingsBoxOpen,
    musicBoxOpen,
    wellbeingBoxOpen,
    taskManagerBoxOpen,
    rebalanceOpenBoxes,
    setBoxOpenById,
  ]);

  const handleMoveFloatingBox = useCallback(
    (id: FloatingBoxId, nextPos: FloatingBoxPosition, isUserResize?: boolean) => {
      touchBoxActivity(id);
      if (isUserResize) {
        preferredBoxSizesRef.current[id] = {
          width: nextPos.width,
          height: nextPos.height,
        };
        setCompactBoxes((prev) => (prev[id] ? { ...prev, [id]: false } : prev));
      }
      rebalanceOpenBoxes({
        posOverrides: { [id]: nextPos },
        compactOverrides: isUserResize ? { [id]: false } : undefined,
        priorityId: id,
        updateFollowOffsets: true,
        persistMoveId: id,
      });
    },
    [rebalanceOpenBoxes, touchBoxActivity]
  );

  const handleMoveHistoryBox = useCallback(
    (nextPos: FloatingBoxPosition, isUserResize?: boolean) =>
      handleMoveFloatingBox('history', nextPos, isUserResize),
    [handleMoveFloatingBox]
  );
  const handleMoveSettingsBox = useCallback(
    (nextPos: FloatingBoxPosition, isUserResize?: boolean) =>
      handleMoveFloatingBox('settings', nextPos, isUserResize),
    [handleMoveFloatingBox]
  );
  const handleMoveMusicBox = useCallback(
    (nextPos: FloatingBoxPosition, isUserResize?: boolean) =>
      handleMoveFloatingBox('music', nextPos, isUserResize),
    [handleMoveFloatingBox]
  );
  const handleMoveWellbeingBox = useCallback(
    (nextPos: FloatingBoxPosition, isUserResize?: boolean) =>
      handleMoveFloatingBox('wellbeing', nextPos, isUserResize),
    [handleMoveFloatingBox]
  );
  const handleMoveTaskManagerBox = useCallback(
    (nextPos: FloatingBoxPosition, isUserResize?: boolean) =>
      handleMoveFloatingBox('taskmanager', nextPos, isUserResize),
    [handleMoveFloatingBox]
  );

  const handleToggleCompactBox = useCallback(
    (id: FloatingBoxId) => {
      touchBoxActivity(id);
      const nextCompact = !floatingBoxesStateRef.current.compact[id];
      setCompactBoxes((prev) => ({ ...prev, [id]: nextCompact }));
      window.setTimeout(() => {
        rebalanceOpenBoxes({ compactOverrides: { [id]: nextCompact }, priorityId: id });
      }, 20);
    },
    [rebalanceOpenBoxes, touchBoxActivity]
  );

  const handleMoveCompanionInWorkspace = useCallback(
    (nextLeft: number, nextTop: number) => {
      setCompanionAnchor((prev) => {
        const updated = { ...prev, left: nextLeft, top: nextTop };
        companionAnchorRef.current = updated;
        return updated;
      });

      const snap = floatingBoxesStateRef.current;
      const openIds = ALL_FLOATING_BOX_IDS.filter((id) => snap.open[id]);
      if (openIds.length === 0) return;

      const { botRect, chatRect } = getCurrentObstaclesForAnchor(nextLeft, nextTop);
      const effectivePrefs = {} as Record<FloatingBoxId, { width: number; height: number }>;
      for (const id of ALL_FLOATING_BOX_IDS) {
        const limits = BOX_SIZE_CONSTRAINTS[id];
        const base = preferredBoxSizesRef.current[id] || {
          width: limits.defaultWidth,
          height: limits.defaultHeight,
        };
        effectivePrefs[id] = snap.compact[id]
          ? {
              width: Math.max(limits.minWidth, Math.round(base.width * 0.72)),
              height: Math.max(limits.minHeight, Math.round(base.height * 0.7)),
            }
          : base;
      }

      const solved = computeBotFollowLayout({
        openBoxIds: openIds,
        currentBoxes: snap.pos,
        preferredSizes: effectivePrefs,
        followOffsets: botFollowOffsetsRef.current,
        botRect,
        chatRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });

      for (const id of openIds) {
        const s = solved[id];
        if (!s) continue;
        setBoxPosById(id, {
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          visible: true,
        });
      }
    },
    [getCurrentObstaclesForAnchor, setBoxPosById]
  );

  const handleMoveCompanionRef = useRef(handleMoveCompanionInWorkspace);
  useEffect(() => {
    handleMoveCompanionRef.current = handleMoveCompanionInWorkspace;
  }, [handleMoveCompanionInWorkspace]);

  const toggleBoxById = useCallback(
    (id: FloatingBoxId, extraOnOpen?: () => void) => {
      const currentlyOpen = floatingBoxesStateRef.current.open[id];
      const next = !currentlyOpen;
      setBoxOpenById(id, next);
      if (next) {
        touchBoxActivity(id);
        extraOnOpen?.();
        window.setTimeout(() => {
          rebalanceOpenBoxes({
            openOverrides: { [id]: true },
            priorityId: id,
            updateFollowOffsets: true,
          });
        }, 40);
      } else {
        window.setTimeout(() => {
          rebalanceOpenBoxes({ openOverrides: { [id]: false } });
        }, 40);
      }
    },
    [rebalanceOpenBoxes, setBoxOpenById, touchBoxActivity]
  );

  const handleToggleHistoryBox = useCallback(
    () => toggleBoxById('history', () => void refreshMemoryAndStorageData()),
    [toggleBoxById, refreshMemoryAndStorageData]
  );

  const handleToggleSettingsBox = useCallback(
    () =>
      toggleBoxById('settings', () => {
        void refreshMemoryAndStorageData();
        void refreshLocalAiStatus();
      }),
    [toggleBoxById, refreshMemoryAndStorageData, refreshLocalAiStatus]
  );

  const handleToggleMusicBox = useCallback(() => toggleBoxById('music'), [toggleBoxById]);
  const handleToggleWellbeingBox = useCallback(() => toggleBoxById('wellbeing'), [toggleBoxById]);
  const handleToggleTaskManagerBox = useCallback(
    () => toggleBoxById('taskmanager', () => void fetchTaskManagerSnapshot().then((s) => s && setTaskSnapshot(s))),
    [toggleBoxById]
  );

  const handleScreenSideChange = useCallback(
    (botScreenSide: 'left' | 'right', botScreenVert: 'up' | 'down') => {
      manualSideOverrideRef.current = false;
      manualVertOverrideRef.current = false;
      setChatSide(botScreenSide === 'left' ? 'right' : 'left');
      setChatVert(botScreenVert === 'up' ? 'down' : 'up');
    },
    []
  );

  const handleToggleChatSide = useCallback(() => {
    manualSideOverrideRef.current = true;
    setChatSide((prev) => (prev === 'left' ? 'right' : 'left'));
  }, []);

  const handleToggleChatVert = useCallback(() => {
    manualVertOverrideRef.current = true;
    setChatVert((prev) => (prev === 'up' ? 'down' : 'up'));
  }, []);

  const chatSideRef = useRef(chatSide);
  chatSideRef.current = chatSide;
  const chatVertRef = useRef(chatVert);
  chatVertRef.current = chatVert;
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const panelSizeRef = useRef(panelSize);
  panelSizeRef.current = panelSize;
  const robotSizeRef = useRef(robotSize);
  robotSizeRef.current = robotSize;

  const resizeAnchorRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const handleResizeRobot = useCallback(
    (size: number, anchor?: { clientX: number; clientY: number }) => {
      resizeAnchorRef.current = anchor || null;
      setRobotSize(size);
    },
    []
  );

  const syncInteractiveRegions = useCallback(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    if (!bootComplete) {
      rects.push({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    } else if (showApiModal) {
      const el = modalCardRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      } else {
        rects.push({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
      }
    } else if (startupCheckinOpen) {
      rects.push({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    } else {
      if (chatOpen && chatWrapRef.current) {
        const r = chatWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (historyBoxOpen && historyBoxWrapRef.current) {
        const r = historyBoxWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (settingsBoxOpen && settingsBoxWrapRef.current) {
        const r = settingsBoxWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (musicBoxOpen && musicBoxWrapRef.current) {
        const r = musicBoxWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (wellbeingBoxOpen && wellbeingBoxWrapRef.current) {
        const r = wellbeingBoxWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (taskManagerBoxOpen && taskManagerBoxWrapRef.current) {
        const r = taskManagerBoxWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (drinkAlertVisible && drinkAlertWrapRef.current) {
        const r = drinkAlertWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (robotWrapRef.current) {
        const r = robotWrapRef.current.getBoundingClientRect();
        const insetX = r.width * 0.12;
        const insetTop = r.height * 0.06;
        const insetBottom = r.height * 0.16;
        rects.push({
          x: r.left + insetX,
          y: r.top + insetTop,
          width: Math.max(40, r.width - insetX * 2),
          height: Math.max(40, r.height - insetTop - insetBottom),
        });
      }
    }

    let botCenter: { x: number; y: number } | null = null;
    if (robotWrapRef.current) {
      const r = robotWrapRef.current.getBoundingClientRect();
      botCenter = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      };
    }

    const wsActive =
      !showApiModal &&
      ((bootComplete && !showApiModal && startupCheckinOpen) ||
        historyBoxOpen ||
        settingsBoxOpen ||
        musicBoxOpen ||
        wellbeingBoxOpen ||
        taskManagerBoxOpen ||
        drinkAlertVisible);

    void invoke('set_interactive_regions', {
      rects,
      forceInteractive:
        !bootComplete || showApiModal || startupCheckinOpen || isDraggingBot,
      companionActive:
        bootComplete &&
        !showApiModal &&
        !startupCheckinOpen &&
        !wsActive &&
        companionReadyRef.current &&
        brokenSeconds <= 0,
      botCenter,
    }).catch(() => {});
  }, [
    bootComplete,
    showApiModal,
    startupCheckinOpen,
    chatOpen,
    historyBoxOpen,
    settingsBoxOpen,
    musicBoxOpen,
    wellbeingBoxOpen,
    taskManagerBoxOpen,
    drinkAlertVisible,
    isDraggingBot,
    brokenSeconds,
  ]);

  useEffect(() => {
    syncInteractiveRegions();
    const timer = window.setInterval(syncInteractiveRegions, 120);
    window.addEventListener('resize', syncInteractiveRegions);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', syncInteractiveRegions);
    };
  }, [
    syncInteractiveRegions,
    panelSize,
    robotSize,
    chatSide,
    chatVert,
    historyBoxPos,
    settingsBoxPos,
    musicBoxPos,
    wellbeingBoxPos,
    taskManagerBoxPos,
  ]);

  const startupCheckinActive = bootComplete && !showApiModal && startupCheckinOpen;

  const floatingWorkspaceActive =
    !showApiModal &&
    (startupCheckinActive ||
      historyBoxOpen ||
      settingsBoxOpen ||
      musicBoxOpen ||
      wellbeingBoxOpen ||
      taskManagerBoxOpen ||
      drinkAlertVisible);

  useEffect(() => {
    floatingWorkspaceActiveRef.current = floatingWorkspaceActive;
  }, [floatingWorkspaceActive]);

  const recentRealApps = useMemo<RecentRealAppItem[]>(
    () => buildRecentRealAppsList(wellbeingHistory, installedRealApps, 5),
    [wellbeingHistory, installedRealApps]
  );

  useEffect(() => {
    const updateWindowGeometry = async () => {
      try {
        const bounds: any = await invoke('get_window_bounds');
        const dpr = bounds.scale_factor || window.devicePixelRatio || 1;

        if (!bootComplete) {
          companionReadyRef.current = false;
          await invoke('set_window_rect', {
            x: bounds.monitor_x,
            y: bounds.monitor_y,
            width: bounds.monitor_width,
            height: bounds.monitor_height,
          });
          setTimeout(syncInteractiveRegions, 60);
          return;
        }

        const targetCssW = showApiModal
          ? 520
          : chatOpen
            ? panelSize.width + CHAT_BOT_GAP + robotSize + 144
            : robotSize + 144;

        const targetCssH = showApiModal
          ? 760
          : chatOpen
            ? Math.max(panelSize.height, robotSize) + 144
            : robotSize + 144;

        const targetW = Math.round(targetCssW * dpr);
        const targetH = Math.round(targetCssH * dpr);

        // When either Floating History Box or Floating Settings Box is open, expand transparent click-through overlay
        // to the full monitor while anchoring the Robot + Chatbox at their exact screen coordinates
        if (floatingWorkspaceActive) {
          if (!prevFloatingWorkspaceRef.current) {
            const shouldCenterCompanion = !companionCenteredDoneRef.current;
            const relLeft = shouldCenterCompanion
              ? Math.max(0, Math.round((bounds.monitor_width / dpr - targetCssW) / 2))
              : Math.round((bounds.x - bounds.monitor_x) / dpr);
            const relTop = shouldCenterCompanion
              ? Math.max(0, Math.round((bounds.monitor_height / dpr - targetCssH) / 2))
              : Math.round((bounds.y - bounds.monitor_y) / dpr);
            companionCenteredDoneRef.current = true;
            if (skipNextWorkspaceAnchorInitRef.current) {
              skipNextWorkspaceAnchorInitRef.current = false;
              setCompanionAnchor((prev) => ({
                ...prev,
                width: targetCssW,
                height: targetCssH,
              }));
            } else {
              setCompanionAnchor({
                left: relLeft,
                top: relTop,
                width: targetCssW,
                height: targetCssH,
              });
            }
            prevFloatingWorkspaceRef.current = true;
            await invoke('set_window_rect', {
              x: bounds.monitor_x,
              y: bounds.monitor_y,
              width: bounds.monitor_width,
              height: bounds.monitor_height,
            });
          } else {
            setCompanionAnchor((prev) => ({
              ...prev,
              width: targetCssW,
              height: targetCssH,
            }));
          }
          companionReadyRef.current = true;
          setTimeout(syncInteractiveRegions, 50);
          return;
        }

        if (prevFloatingWorkspaceRef.current && !floatingWorkspaceActive && !showApiModal) {
          prevFloatingWorkspaceRef.current = false;
          const restoreX = bounds.monitor_x + Math.round(companionAnchor.left * dpr);
          const restoreY = bounds.monitor_y + Math.round(companionAnchor.top * dpr);
          await invoke('set_window_rect', {
            x: restoreX,
            y: restoreY,
            width: targetW,
            height: targetH,
          });
          setTimeout(syncInteractiveRegions, 50);
          return;
        }

        const prev = prevModeRef.current;

        // Login card is user-movable: once it has been placed, never snap it back to center
        if (showApiModal && modalPlacedRef.current) {
          prevModeRef.current = { showApiModal, chatOpen, chatSide, chatVert, robotSize };
          setTimeout(syncInteractiveRegions, 40);
          return;
        }

        if (showApiModal || (prev.showApiModal && !showApiModal) || !companionCenteredDoneRef.current) {
          modalPlacedRef.current = showApiModal;
          if (!showApiModal) {
            companionCenteredDoneRef.current = true;
          }
          prevModeRef.current = { showApiModal, chatOpen, chatSide, chatVert, robotSize };
          companionReadyRef.current = false;
          const centerX = bounds.monitor_x + Math.round((bounds.monitor_width - targetW) / 2);
          const centerY = bounds.monitor_y + Math.round((bounds.monitor_height - targetH) / 2);
          await invoke('set_window_rect', {
            x: centerX,
            y: centerY,
            width: targetW,
            height: targetH,
          });
          companionReadyRef.current = !showApiModal;
          setTimeout(syncInteractiveRegions, 40);
          return;
        }

        const newBotBoxW = Math.round((robotSize + 144) * dpr);
        const newBotBoxH = Math.round((robotSize + 144) * dpr);
        let botBoxLeft: number;
        let botBoxRight: number;
        let botBoxTop: number;
        let botBoxBottom: number;

        if (!prev.chatOpen) {
          botBoxRight = bounds.x + bounds.width;
          botBoxLeft = botBoxRight - newBotBoxW;
          botBoxBottom = bounds.y + bounds.height;
          botBoxTop = botBoxBottom - newBotBoxH;
        } else {
          if (prev.chatSide === 'left') {
            botBoxRight = bounds.x + bounds.width;
            botBoxLeft = botBoxRight - newBotBoxW;
          } else {
            botBoxLeft = bounds.x;
            botBoxRight = botBoxLeft + newBotBoxW;
          }

          if (prev.chatVert === 'up') {
            botBoxBottom = bounds.y + bounds.height;
            botBoxTop = botBoxBottom - newBotBoxH;
          } else {
            botBoxTop = bounds.y;
            botBoxBottom = botBoxTop + newBotBoxH;
          }
        }

        let effectiveSide = chatSide;
        let effectiveVert = chatVert;
        if (!prev.chatOpen && chatOpen) {
          const botCenterX = (botBoxLeft + botBoxRight) / 2;
          const botCenterY = (botBoxTop + botBoxBottom) / 2;
          const monitorCenterX = bounds.monitor_x + bounds.monitor_width / 2;
          const monitorCenterY = bounds.monitor_y + bounds.monitor_height / 2;

          if (!manualSideOverrideRef.current) {
            effectiveSide = botCenterX < monitorCenterX ? 'right' : 'left';
            if (effectiveSide !== chatSide) {
              setChatSide(effectiveSide);
            }
          }
          if (!manualVertOverrideRef.current) {
            effectiveVert = botCenterY < monitorCenterY ? 'down' : 'up';
            if (effectiveVert !== chatVert) {
              setChatVert(effectiveVert);
            }
          }
        }

        prevModeRef.current = {
          showApiModal,
          chatOpen,
          chatSide: effectiveSide,
          chatVert: effectiveVert,
          robotSize,
        };

        const anchor = resizeAnchorRef.current;
        resizeAnchorRef.current = null;

        let newX: number;
        let newY: number;

        if (anchor && prev.robotSize && prev.robotSize !== robotSize) {
          const oldRobotSize = prev.robotSize;
          let oldRobotLeft = 72;
          let oldRobotTop = 72;
          if (prev.chatOpen) {
            if (prev.chatSide === 'left') {
              oldRobotLeft = 72 + panelSize.width + CHAT_BOT_GAP;
            }
            if (prev.chatVert === 'up') {
              const oldTargetH = Math.max(panelSize.height, oldRobotSize) + 144;
              oldRobotTop = oldTargetH - 72 - oldRobotSize;
            }
          }

          const relX = Math.max(0, Math.min(oldRobotSize, anchor.clientX - oldRobotLeft));
          const relY = Math.max(0, Math.min(oldRobotSize, anchor.clientY - oldRobotTop));
          const fx = oldRobotSize > 0 ? relX / oldRobotSize : 0.5;
          const fy = oldRobotSize > 0 ? relY / oldRobotSize : 0.5;

          const mouseScreenX = bounds.x + anchor.clientX * dpr;
          const mouseScreenY = bounds.y + anchor.clientY * dpr;

          let newRobotLeft = 72;
          let newRobotTop = 72;
          if (chatOpen) {
            if (effectiveSide === 'left') {
              newRobotLeft = 72 + panelSize.width + CHAT_BOT_GAP;
            }
            if (effectiveVert === 'up') {
              newRobotTop = targetCssH - 72 - robotSize;
            }
          }

          const newClientX = newRobotLeft + fx * robotSize;
          const newClientY = newRobotTop + fy * robotSize;

          newX = mouseScreenX - newClientX * dpr;
          newY = mouseScreenY - newClientY * dpr;
        } else if (
          prev.robotSize &&
          prev.robotSize !== robotSize &&
          prev.chatOpen === chatOpen &&
          prev.chatSide === effectiveSide &&
          prev.chatVert === effectiveVert
        ) {
          const oldRobotSize = prev.robotSize;
          let oldRobotLeft = 72;
          let oldRobotTop = 72;
          if (prev.chatOpen) {
            if (prev.chatSide === 'left') {
              oldRobotLeft = 72 + panelSize.width + CHAT_BOT_GAP;
            }
            if (prev.chatVert === 'up') {
              const oldTargetH = Math.max(panelSize.height, oldRobotSize) + 144;
              oldRobotTop = oldTargetH - 72 - oldRobotSize;
            }
          }
          const oldCenterScreenX = bounds.x + (oldRobotLeft + oldRobotSize / 2) * dpr;
          const oldCenterScreenY = bounds.y + (oldRobotTop + oldRobotSize / 2) * dpr;

          let newRobotLeft = 72;
          let newRobotTop = 72;
          if (chatOpen) {
            if (effectiveSide === 'left') {
              newRobotLeft = 72 + panelSize.width + CHAT_BOT_GAP;
            }
            if (effectiveVert === 'up') {
              newRobotTop = targetCssH - 72 - robotSize;
            }
          }
          const newCenterClientX = (newRobotLeft + robotSize / 2) * dpr;
          const newCenterClientY = (newRobotTop + robotSize / 2) * dpr;

          newX = oldCenterScreenX - newCenterClientX;
          newY = oldCenterScreenY - newCenterClientY;
        } else {
          newX = !chatOpen
            ? botBoxLeft
            : effectiveSide === 'left'
              ? botBoxRight - targetW
              : botBoxLeft;

          newY = !chatOpen
            ? botBoxTop
            : effectiveVert === 'up'
              ? botBoxBottom - targetH
              : botBoxTop;
        }

        const glowAllowance = Math.round(56 * dpr);
        const minX = bounds.monitor_x - glowAllowance;
        const maxX = bounds.monitor_x + bounds.monitor_width - targetW + glowAllowance;
        const minY = bounds.monitor_y - glowAllowance;
        const maxY = bounds.monitor_y + bounds.monitor_height - targetH - Math.round(24 * dpr) + glowAllowance;

        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        if (
          Math.abs(targetW - bounds.width) > 4 ||
          Math.abs(targetH - bounds.height) > 4 ||
          prev.chatOpen !== chatOpen ||
          prev.chatSide !== effectiveSide ||
          prev.chatVert !== effectiveVert
        ) {
          await invoke('set_window_rect', {
            x: Math.round(newX),
            y: Math.round(newY),
            width: targetW,
            height: targetH,
          });
          setTimeout(syncInteractiveRegions, 40);
        }
      } catch {
        // Ignore outside Tauri runtime
      }
    };

    void updateWindowGeometry();
  }, [
    bootComplete,
    showApiModal,
    chatOpen,
    chatSide,
    chatVert,
    panelSize,
    robotSize,
    floatingWorkspaceActive,
    companionAnchor.left,
    companionAnchor.top,
    syncInteractiveRegions,
  ]);

  useEffect(() => {
    let unlistenChat: (() => void) | undefined;
    let unlistenDock: (() => void) | undefined;

    void listen('open-chat', () => {
      setChatOpen((prev) => !prev);
    }).then((fn) => {
      unlistenChat = fn;
    });

    void listen<string>('dock-vert-changed', (event) => {
      manualVertOverrideRef.current = true;
      if (event.payload === 'up') {
        setChatVert('down');
      } else {
        setChatVert('up');
      }
    }).then((fn) => {
      unlistenDock = fn;
    });

    return () => {
      unlistenChat?.();
      unlistenDock?.();
    };
  }, []);

  // Alt + Left Click anywhere on the window: glide bot to cursor location
  useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent) => {
      if (e.altKey && e.button === 0) {
        if (floatingWorkspaceActiveRef.current) {
          const snap = floatingBoxesStateRef.current;
          const stage = botVisualToStagePos(
            e.clientX - Math.round(snap.robotSize * 0.5),
            e.clientY - Math.round(snap.robotSize * 0.5),
            {
              chatOpen: snap.chatOpen,
              robotSize: snap.robotSize,
              chatWidth: snap.panelSize.width,
              chatHeight: snap.panelSize.height,
              chatSide: snap.chatSide,
              chatVert: snap.chatVert,
            }
          );
          handleMoveCompanionRef.current(stage.x, stage.y);
        } else {
          void invoke('glide_to_cursor');
        }
      }
    };
    window.addEventListener('mousedown', handleGlobalPointerDown, true);
    return () => window.removeEventListener('mousedown', handleGlobalPointerDown, true);
  }, []);

  // When broken, mascot cannot be refreshed and cannot be right clicked
  useEffect(() => {
    const handleBrokenKeys = (e: KeyboardEvent) => {
      if (brokenSeconds > 0) {
        if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      if (brokenSeconds > 0) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleBrokenKeys, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      window.removeEventListener('keydown', handleBrokenKeys, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [brokenSeconds]);

  // Shortcuts: Windows+Shift+C (or Ctrl+Alt+C / Alt+Shift+C) to toggle chat, Win+Esc to terminate, PageUp/PageDown for dock orientation, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || (e as any).getModifierState?.('Meta');

      // Windows + Escape: Terminate Luminess
      if (e.key === 'Escape' && isMeta) {
        e.preventDefault();
        void invoke('terminate_app');
        return;
      }

      // Windows + Shift + C (or Ctrl+Alt+C / Alt+Shift+C): Toggle/open chat
      if (
        ((e.key === 'c' || e.key === 'C') && e.shiftKey && isMeta) ||
        (e.ctrlKey && e.altKey && (e.key === 'c' || e.key === 'C')) ||
        (e.altKey && e.shiftKey && (e.key === 'c' || e.key === 'C'))
      ) {
        e.preventDefault();
        setChatOpen((prev) => !prev);
        return;
      }

      // Page Up: bot docks up when a tab/app is clicked
      if (e.key === 'PageUp') {
        e.preventDefault();
        manualVertOverrideRef.current = true;
        setChatVert('down');
        void invoke('set_dock_vert_preference', { vert: 'up' });
        return;
      }

      // Page Down: bot docks down when a tab/app is clicked
      if (e.key === 'PageDown') {
        e.preventDefault();
        manualVertOverrideRef.current = true;
        setChatVert('up');
        void invoke('set_dock_vert_preference', { vert: 'down' });
        return;
      }

      if (e.key === 'Escape' && !showApiModal) {
        setChatOpen(false);
        setHistoryBoxOpen(false);
        setSettingsBoxOpen(false);
        setMusicBoxOpen(false);
        setWellbeingBoxOpen(false);
        setTaskManagerBoxOpen(false);
        setDrinkAlertVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showApiModal]);

  // Ctrl + Arrow moves the bot smoothly on screen (diagonals, contradiction last-pressed priority, auto-flip chat).
  // Plain Arrow moves the chat position relative to the bot.
  useEffect(() => {
    const horizontalKeysRef: { current: ('ArrowLeft' | 'ArrowRight')[] } = { current: [] };
    const verticalKeysRef: { current: ('ArrowUp' | 'ArrowDown')[] } = { current: [] };
    const ctrlPressedRef = { current: false };
    const loopActiveRef = { current: false };
    let rafId: number | null = null;
    let lastTime = 0;
    let botFloatPos: { x: number; y: number } | null = null;
    let cachedBounds: any = null;

    const stopMovementLoop = () => {
      loopActiveRef.current = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const tick = (now: number) => {
      if (!loopActiveRef.current || !ctrlPressedRef.current) {
        stopMovementLoop();
        return;
      }

      const hKeys = horizontalKeysRef.current;
      const vKeys = verticalKeysRef.current;
      if (hKeys.length === 0 && vKeys.length === 0) {
        stopMovementLoop();
        return;
      }

      const dt = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Contradicting key resolution: whoever clicks last wins!
      const activeH = hKeys.length > 0 ? hKeys[hKeys.length - 1] : null;
      const activeV = vKeys.length > 0 ? vKeys[vKeys.length - 1] : null;

      let dirX = 0;
      let dirY = 0;
      if (activeH === 'ArrowLeft') dirX = -1;
      else if (activeH === 'ArrowRight') dirX = 1;

      if (activeV === 'ArrowUp') dirY = -1;
      else if (activeV === 'ArrowDown') dirY = 1;

      // 2 keys simultaneously (e.g. right and up) -> diagonal movement!
      if (dirX !== 0 && dirY !== 0) {
        dirX *= 0.7071;
        dirY *= 0.7071;
      }

      const bounds = cachedBounds;
      if (!bounds || !botFloatPos) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (floatingWorkspaceActiveRef.current) {
        const snap = floatingBoxesStateRef.current;
        const vw = window.innerWidth || 1920;
        const vh = window.innerHeight || 1080;
        const speedCss = 560;
        const curAnchor = companionAnchorRef.current;
        const nextLeft = Math.max(
          -56,
          Math.min(vw - snap.robotSize - 86, curAnchor.left + dirX * speedCss * dt)
        );
        const nextTop = Math.max(
          -56,
          Math.min(vh - snap.robotSize - 86, curAnchor.top + dirY * speedCss * dt)
        );
        handleMoveCompanionRef.current(Math.round(nextLeft), Math.round(nextTop));
        rafId = requestAnimationFrame(tick);
        return;
      }

      const dpr = bounds.scale_factor || window.devicePixelRatio || 1;
      const speed = 560; // Smooth 560 px/s glide
      const moveX = dirX * speed * dt * dpr;
      const moveY = dirY * speed * dt * dpr;

      botFloatPos.x += moveX;
      botFloatPos.y += moveY;

      const glowAllowance = Math.round(56 * dpr);
      const isChat = chatOpenRef.current;
      const currentSide = chatSideRef.current;
      const currentVert = chatVertRef.current;
      const curRobotSize = robotSizeRef.current;
      const curPanel = panelSizeRef.current;

      const targetCssW = isChat
        ? curPanel.width + CHAT_BOT_GAP + curRobotSize + 144
        : curRobotSize + 144;
      const targetCssH = isChat
        ? Math.max(curPanel.height, curRobotSize) + 144
        : curRobotSize + 144;
      const targetW = Math.round(targetCssW * dpr);
      const targetH = Math.round(targetCssH * dpr);

      // Boundaries for THE BOT ITSELF: It won't stop until the bot itself hits a wall!
      const minBotX = bounds.monitor_x - glowAllowance;
      const maxBotX = bounds.monitor_x + bounds.monitor_width - Math.round(curRobotSize * dpr) + glowAllowance;
      const minBotY = bounds.monitor_y - glowAllowance;
      const maxBotY = bounds.monitor_y + bounds.monitor_height - Math.round(curRobotSize * dpr) - Math.round(24 * dpr) + glowAllowance;

      botFloatPos.x = Math.max(minBotX, Math.min(maxBotX, botFloatPos.x));
      botFloatPos.y = Math.max(minBotY, Math.min(maxBotY, botFloatPos.y));

      let nextSide = currentSide;
      let nextVert = currentVert;

      if (isChat) {
        // Horizontal wall check:
        if (currentSide === 'right') {
          const chatScreenRight = botFloatPos.x + Math.round((curRobotSize + CHAT_BOT_GAP + curPanel.width) * dpr);
          const rightWall = bounds.monitor_x + bounds.monitor_width;
          if (chatScreenRight >= rightWall) {
            nextSide = 'left';
            manualSideOverrideRef.current = true;
            setChatSide('left');
          }
        } else {
          const chatScreenLeft = botFloatPos.x - Math.round((CHAT_BOT_GAP + curPanel.width) * dpr);
          const leftWall = bounds.monitor_x;
          if (chatScreenLeft <= leftWall) {
            nextSide = 'right';
            manualSideOverrideRef.current = true;
            setChatSide('right');
          }
        }

        // Vertical wall check:
        if (currentVert === 'up') {
          const chatScreenTop = botFloatPos.y + Math.round(curRobotSize * dpr) - Math.round(curPanel.height * dpr);
          const topWall = bounds.monitor_y;
          if (chatScreenTop <= topWall) {
            nextVert = 'down';
            manualVertOverrideRef.current = true;
            setChatVert('down');
          }
        } else {
          const chatScreenBottom = botFloatPos.y + Math.round(curPanel.height * dpr);
          const bottomWall = bounds.monitor_y + bounds.monitor_height - Math.round(24 * dpr);
          if (chatScreenBottom >= bottomWall) {
            nextVert = 'up';
            manualVertOverrideRef.current = true;
            setChatVert('up');
          }
        }
      }

      let newWinBotCssLeft = 72;
      let newWinBotCssTop = 72;
      if (isChat) {
        if (nextSide === 'left') {
          newWinBotCssLeft = 72 + curPanel.width + CHAT_BOT_GAP;
        }
        if (nextVert === 'up') {
          newWinBotCssTop = targetCssH - 72 - curRobotSize;
        }
      }

      const nextWinX = Math.round(botFloatPos.x - newWinBotCssLeft * dpr);
      const nextWinY = Math.round(botFloatPos.y - newWinBotCssTop * dpr);

      if (nextSide !== currentSide || nextVert !== currentVert) {
        prevModeRef.current = {
          showApiModal,
          chatOpen: isChat,
          chatSide: nextSide,
          chatVert: nextVert,
          robotSize: curRobotSize,
        };
        void invoke('set_window_rect', {
          x: nextWinX,
          y: nextWinY,
          width: targetW,
          height: targetH,
        });
        setTimeout(syncInteractiveRegions, 40);
      } else {
        void invoke('set_window_pos', {
          x: nextWinX,
          y: nextWinY,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    const startMovementLoop = async () => {
      if (loopActiveRef.current) return;
      loopActiveRef.current = true;
      lastTime = performance.now();

      try {
        const bounds: any = await invoke('get_window_bounds');
        cachedBounds = bounds;
        const dpr = bounds.scale_factor || window.devicePixelRatio || 1;

        const isChat = chatOpenRef.current;
        const currentSide = chatSideRef.current;
        const currentVert = chatVertRef.current;
        const curRobotSize = robotSizeRef.current;
        const curPanel = panelSizeRef.current;
        const targetCssH = isChat
          ? Math.max(curPanel.height, curRobotSize) + 144
          : curRobotSize + 144;

        let botCssOffsetLeft = 72;
        let botCssOffsetTop = 72;
        if (isChat) {
          if (currentSide === 'left') {
            botCssOffsetLeft = 72 + curPanel.width + CHAT_BOT_GAP;
          }
          if (currentVert === 'up') {
            botCssOffsetTop = targetCssH - 72 - curRobotSize;
          }
        }

        botFloatPos = {
          x: bounds.x + Math.round(botCssOffsetLeft * dpr),
          y: bounds.y + Math.round(botCssOffsetTop * dpr),
        };

        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      } catch {
        loopActiveRef.current = false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showApiModal) return;

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!arrowKeys.includes(e.key)) return;

      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      if (e.ctrlKey) {
        if (isInput && (activeEl as HTMLInputElement).value && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          return;
        }

        e.preventDefault();
        ctrlPressedRef.current = true;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          horizontalKeysRef.current = horizontalKeysRef.current
            .filter((k) => k !== e.key)
            .concat(e.key as 'ArrowLeft' | 'ArrowRight');
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          verticalKeysRef.current = verticalKeysRef.current
            .filter((k) => k !== e.key)
            .concat(e.key as 'ArrowUp' | 'ArrowDown');
        }

        void startMovementLoop();
        return;
      }

      if (!chatOpen) return;
      if (isInput && (activeEl as HTMLInputElement).value && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return;
      }

      e.preventDefault();
      if (e.key === 'ArrowUp') {
        manualVertOverrideRef.current = true;
        setChatVert('up');
      } else if (e.key === 'ArrowDown') {
        manualVertOverrideRef.current = true;
        setChatVert('down');
      } else if (e.key === 'ArrowLeft') {
        manualSideOverrideRef.current = true;
        setChatSide('left');
      } else if (e.key === 'ArrowRight') {
        manualSideOverrideRef.current = true;
        setChatSide('right');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        ctrlPressedRef.current = false;
        horizontalKeysRef.current = [];
        verticalKeysRef.current = [];
        stopMovementLoop();
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        horizontalKeysRef.current = horizontalKeysRef.current.filter((k) => k !== e.key);
        if (horizontalKeysRef.current.length === 0 && verticalKeysRef.current.length === 0) {
          stopMovementLoop();
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        verticalKeysRef.current = verticalKeysRef.current.filter((k) => k !== e.key);
        if (horizontalKeysRef.current.length === 0 && verticalKeysRef.current.length === 0) {
          stopMovementLoop();
        }
      }
    };

    const handleBlur = () => {
      ctrlPressedRef.current = false;
      horizontalKeysRef.current = [];
      verticalKeysRef.current = [];
      stopMovementLoop();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      stopMovementLoop();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [chatOpen, showApiModal, syncInteractiveRegions]);

  useEffect(() => {
    void checkAntigravityCliStatus().then((status) => {
      setAntigravityStatus(status);
    });
    if (googleUser) {
      void ensureValidGoogleSession().then((refreshed) => {
        if (refreshed) {
          setGoogleUser({ ...refreshed });
          if (refreshed.email) {
            syncMemoriesWithGoogleAccount(refreshed.email);
            associateSessionsWithGoogleAccount(refreshed.email);
            setMemories(getUserMemories(refreshed.email));
          }
        }
      });
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setNormalizedError(null);
    setConnectionState('signing_in');
    setEmotion('curiosity');
    try {
      const session = await loginWithGoogle();
      setGoogleUser(session);
      setEmotion('joy');
      if (session.email) {
        syncMemoriesWithGoogleAccount(session.email);
        associateSessionsWithGoogleAccount(session.email);
        setMemories(getUserMemories(session.email));
      }
      const geminiKey = (providerKeys.gemini || '').trim();
      await handleVerifyAndConnect('gemini', geminiKey);
    } catch (err: any) {
      const norm = normalizeAIError(err, 'gemini');
      setNormalizedError(norm);
      setConnectionState('connection_needs_attention');
      setEmotion('confusion');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = () => {
    logoutGoogle();
    setGoogleUser(null);
    setNormalizedError(null);
    setConnectionState('not_configured');
    setEmotion('idle');
  };

  // Apply live customized bot appearance CSS variables whenever config updates
  useEffect(() => {
    applyBotAppearanceCssVars(appConfig.bot_customization || createDefaultBotCustomization());
  }, [appConfig]);

  const handleOpenApiModal = async () => {
    setNormalizedError(null);
    setVerifiedBanner(null);
    setProviderKeys({
      gemini: getProviderApiKey('gemini'),
      claude: getProviderApiKey('claude'),
      codex: getProviderApiKey('codex'),
      custom: getProviderApiKey('custom'),
      offline: getProviderApiKey('offline'),
    });
    setSelectedProviderState(getSelectedProvider());
    // Keep desktop bot & chat connected inline by opening Floating Settings & Connectors on the Connectors tab
    setSettingsTab('connectors');
    setSettingsTabSeq((s) => s + 1);
    setSettingsBoxOpen(true);
    setShowApiModal(false);
    setEmotion('curiosity');
  };

  const handleOpenSetupWizard = () => {
    setNormalizedError(null);
    setVerifiedBanner(null);
    setChatOpen(false);
    setHistoryBoxOpen(false);
    setSettingsBoxOpen(false);
    setShowApiModal(true);
    setEmotion('curiosity');
  };

  const handleProviderKeyChange = (provider: AIProvider, key: string) => {
    setProviderKeys((prev) => ({ ...prev, [provider]: key }));
    setNormalizedError(null);
  };

  const handleSelectStorageTier = async (tierId: StorageTierId) => {
    const opt = STORAGE_TIER_OPTIONS.find((o) => o.id === tierId);
    const updated: AppConfigJson = {
      ...appConfig,
      storage_tier: tierId,
      storage_limit_bytes: opt ? opt.bytes : 5 * 1024 * 1024 * 1024,
      installation_storage_prompted: true,
    };
    const saved = await saveAppConfigToMachine(updated);
    setAppConfig(saved);
    const st = await getMachineStorageStatus();
    setStorageStatus(st);
  };

  useEffect(() => {
    appConfigRef.current = appConfig;
  }, [appConfig]);

  useEffect(() => {
    drinkAlertVisibleRef.current = drinkAlertVisible;
  }, [drinkAlertVisible]);

  useEffect(() => {
    wellbeingHistoryRef.current = wellbeingHistory;
  }, [wellbeingHistory]);

  // Background Digital Wellbeing tracker (5s foreground window sampler with idle pause & 90-day auto-prune)
  useEffect(() => {
    let mounted = true;
    let lastSampleAt = Date.now();
    let ticksSinceSave = 0;

    void loadWellbeingHistoryFromMachine().then((loaded) => {
      if (!mounted) return;
      wellbeingHistoryRef.current = loaded;
      setWellbeingHistory(loaded);
    });

    const sampleOnce = async () => {
      const sample = await fetchForegroundAppSample();
      if (!mounted || !sample) return;
      if (isLuminessSelfApp(sample.exe_name, sample.exe_path, sample.process_name)) {
        return;
      }
      const nowMs = Date.now();
      const elapsedSec = Math.max(1, Math.min(15, Math.round((nowMs - lastSampleAt) / 1000)));
      lastSampleAt = nowMs;

      if (sample.is_idle) {
        setActiveForegroundApp('Idle (> 5m pause)');
      } else {
        setActiveForegroundApp(resolveAppProfile(sample.exe_name, sample.process_name).displayName);
      }

      const nextStore = recordForegroundUsageSample(
        wellbeingHistoryRef.current,
        sample,
        elapsedSec,
        nowMs
      );
      wellbeingHistoryRef.current = nextStore;
      setWellbeingHistory(nextStore);

      ticksSinceSave += 1;
      if (ticksSinceSave >= 6) {
        ticksSinceSave = 0;
        void saveWellbeingHistoryToMachine(nextStore);
      }
    };

    const timer = window.setInterval(() => {
      void sampleOnce();
    }, 5_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      void saveWellbeingHistoryToMachine(wellbeingHistoryRef.current);
    };
  }, []);

  const refreshTaskSnapshotNow = useCallback(async () => {
    const snap = await fetchTaskManagerSnapshot();
    if (snap) setTaskSnapshot(snap);
  }, []);

  // Poll read-only Windows Task Manager snapshot only when standalone Task Manager window is open and unpaused
  useEffect(() => {
    if (!taskManagerBoxOpen) return;
    let cancelled = false;
    void fetchTaskManagerSnapshot().then((first) => {
      if (cancelled || !first) return;
      setTaskSnapshot(first);
    });
    const warmup = window.setTimeout(() => {
      if (!cancelled) {
        void fetchTaskManagerSnapshot().then((second) => {
          if (!cancelled && second) setTaskSnapshot(second);
        });
      }
    }, 550);

    if (!isPollingTasks) {
      return () => {
        cancelled = true;
        window.clearTimeout(warmup);
      };
    }

    const intervalId = window.setInterval(() => {
      void fetchTaskManagerSnapshot().then((snap) => {
        if (!cancelled && snap) setTaskSnapshot(snap);
      });
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearTimeout(warmup);
      window.clearInterval(intervalId);
    };
  }, [taskManagerBoxOpen, isPollingTasks]);

  const musicConfig = useMemo(
    () => normalizeMusicPlayerConfig(appConfig.music_player),
    [appConfig.music_player]
  );

  const musicPlaylist = useMemo(
    () => mergeMusicPlaylist(localMusicTracks, musicConfig.custom_tracks),
    [localMusicTracks, musicConfig.custom_tracks]
  );

  const activeMusicTrack = useMemo(
    () =>
      musicPlaylist.find((t) => t.id === musicConfig.active_track_id) ||
      musicPlaylist[0] ||
      BUILT_IN_AMBIENT_TRACKS[0],
    [musicPlaylist, musicConfig.active_track_id]
  );

  const updateMusicConfigState = useCallback(
    async (partial: Partial<MusicPlayerConfig>) => {
      const merged = normalizeMusicPlayerConfig({
        ...normalizeMusicPlayerConfig(appConfigRef.current.music_player),
        ...partial,
      });
      const saved = await saveAppConfigToMachine({ music_player: merged });
      setAppConfig(saved);
      return saved.music_player;
    },
    []
  );

  const musicNextRef = useRef<() => void>(() => {});

  const startPlayingTrack = useCallback(
    async (track: MusicPlayerTrack, cfgOverride?: MusicPlayerConfig) => {
      const cfg = cfgOverride || normalizeMusicPlayerConfig(appConfigRef.current.music_player);
      setMusicPlayerError(null);
      await updateMusicConfigState({ active_track_id: track.id });

      if (track.source === 'ambient') {
        if (audioElRef.current) {
          audioElRef.current.pause();
        }
        if (!synthRef.current) {
          synthRef.current = new AmbientSynthController();
        }
        synthRef.current.start(track.ambientPreset || 'lofi', cfg.volume, cfg.muted);
        setMusicDuration(0);
        setMusicCurrentTime(0);
        setMusicIsPlaying(true);
        return;
      }

      synthRef.current?.stop();
      try {
        const streamUrl =
          track.source === 'local' ? await resolveLocalStreamUrl(track.uri) : track.uri;
        if (!audioElRef.current) {
          const el = new Audio();
          el.preload = 'metadata';
          el.ontimeupdate = () => setMusicCurrentTime(el.currentTime || 0);
          el.onloadedmetadata = () =>
            setMusicDuration(Number.isFinite(el.duration) ? el.duration : 0);
          el.onended = () => {
            const curCfg = normalizeMusicPlayerConfig(appConfigRef.current.music_player);
            if (curCfg.loop_mode === 'one') {
              el.currentTime = 0;
              void el.play().catch(() => {});
              return;
            }
            musicNextRef.current();
          };
          el.onerror = () => {
            setMusicIsPlaying(false);
            setMusicPlayerError(`Could not play "${track.title}". Check file path or stream URL.`);
          };
          audioElRef.current = el;
        }
        const el = audioElRef.current;
        el.volume = cfg.muted ? 0 : cfg.volume;
        el.src = streamUrl;
        el.currentTime = 0;
        await el.play();
        setMusicIsPlaying(true);
      } catch (err: unknown) {
        setMusicIsPlaying(false);
        setMusicPlayerError(err instanceof Error ? err.message : 'Unable to start audio playback.');
      }
    },
    [updateMusicConfigState]
  );

  const handlePauseMusic = useCallback(() => {
    audioElRef.current?.pause();
    synthRef.current?.stop();
    setMusicIsPlaying(false);
  }, []);

  const handlePlayPauseMusic = useCallback(() => {
    if (musicIsPlaying) {
      handlePauseMusic();
      return;
    }
    if (
      activeMusicTrack.source !== 'ambient' &&
      audioElRef.current &&
      audioElRef.current.src &&
      audioElRef.current.paused
    ) {
      audioElRef.current.volume = musicConfig.muted ? 0 : musicConfig.volume;
      void audioElRef.current
        .play()
        .then(() => setMusicIsPlaying(true))
        .catch(() => {
          void startPlayingTrack(activeMusicTrack, musicConfig);
        });
      return;
    }
    void startPlayingTrack(activeMusicTrack, musicConfig);
  }, [
    musicIsPlaying,
    handlePauseMusic,
    activeMusicTrack,
    musicConfig,
    startPlayingTrack,
  ]);

  const handleMusicNext = useCallback(() => {
    const idx = pickNextTrackIndex(
      musicPlaylist,
      activeMusicTrack?.id || null,
      1,
      musicConfig.shuffle,
      musicConfig.loop_mode === 'off' ? 'off' : 'all'
    );
    if (idx < 0 || !musicPlaylist[idx]) {
      handlePauseMusic();
      return;
    }
    void startPlayingTrack(musicPlaylist[idx], musicConfig);
  }, [musicPlaylist, activeMusicTrack, musicConfig, handlePauseMusic, startPlayingTrack]);

  useEffect(() => {
    musicNextRef.current = handleMusicNext;
  }, [handleMusicNext]);

  const handleMusicPrev = useCallback(() => {
    if (
      activeMusicTrack.source !== 'ambient' &&
      audioElRef.current &&
      audioElRef.current.currentTime > 4
    ) {
      audioElRef.current.currentTime = 0;
      setMusicCurrentTime(0);
      return;
    }
    const idx = pickNextTrackIndex(
      musicPlaylist,
      activeMusicTrack?.id || null,
      -1,
      musicConfig.shuffle,
      'all'
    );
    if (idx >= 0 && musicPlaylist[idx]) {
      void startPlayingTrack(musicPlaylist[idx], musicConfig);
    }
  }, [musicPlaylist, activeMusicTrack, musicConfig, startPlayingTrack]);

  const handleSeekMusic = useCallback((seconds: number) => {
    if (audioElRef.current && Number.isFinite(seconds)) {
      audioElRef.current.currentTime = seconds;
      setMusicCurrentTime(seconds);
    }
  }, []);

  const handleSetMusicVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      const muted = clamped <= 0.005;
      if (audioElRef.current) {
        audioElRef.current.volume = muted ? 0 : clamped;
      }
      synthRef.current?.setVolume(clamped, muted);
      void updateMusicConfigState({ volume: clamped, muted });
    },
    [updateMusicConfigState]
  );

  const handleToggleMusicMute = useCallback(() => {
    const nextMuted = !musicConfig.muted;
    if (audioElRef.current) {
      audioElRef.current.volume = nextMuted ? 0 : musicConfig.volume;
    }
    synthRef.current?.setVolume(musicConfig.volume, nextMuted);
    void updateMusicConfigState({ muted: nextMuted });
  }, [musicConfig.muted, musicConfig.volume, updateMusicConfigState]);

  const handleToggleMusicShuffle = useCallback(() => {
    void updateMusicConfigState({ shuffle: !musicConfig.shuffle });
  }, [musicConfig.shuffle, updateMusicConfigState]);

  const handleCycleMusicLoop = useCallback(() => {
    const order: MusicLoopMode[] = ['all', 'one', 'off'];
    const next = order[(order.indexOf(musicConfig.loop_mode) + 1) % order.length];
    void updateMusicConfigState({ loop_mode: next });
  }, [musicConfig.loop_mode, updateMusicConfigState]);

  const handleScanMusicFolder = useCallback(
    async (folderOverride?: string) => {
      setIsScanningMusic(true);
      setMusicPlayerError(null);
      try {
        const res = await scanLocalMusicFromMachine(
          folderOverride !== undefined ? folderOverride : musicConfig.music_folder || undefined
        );
        setLocalMusicTracks(res.tracks);
        if (res.folder) setResolvedMusicFolder(res.folder);
        if (folderOverride !== undefined) {
          await updateMusicConfigState({ music_folder: folderOverride.trim() });
        }
        return res;
      } finally {
        setIsScanningMusic(false);
      }
    },
    [musicConfig.music_folder, updateMusicConfigState]
  );

  const handleAddUrlMusicTrack = useCallback(
    (url: string, title?: string): string | null => {
      const built = buildUrlTrack(url, title);
      if (!built) {
        return 'Enter a valid http:// or https:// audio/stream URL.';
      }
      const nextCustom = [
        built,
        ...musicConfig.custom_tracks.filter((t) => t.id !== built.id),
      ];
      void updateMusicConfigState({ custom_tracks: nextCustom, active_track_id: built.id });
      return null;
    },
    [musicConfig.custom_tracks, updateMusicConfigState]
  );

  const handleRemoveCustomMusicTrack = useCallback(
    (trackId: string) => {
      const nextCustom = musicConfig.custom_tracks.filter((t) => t.id !== trackId);
      void updateMusicConfigState({ custom_tracks: nextCustom });
    },
    [musicConfig.custom_tracks, updateMusicConfigState]
  );

  const handleQuickLogDrink = useCallback(async () => {
    const nowMs = Date.now();
    const curDrink = normalizeDrinkReminderConfig(appConfigRef.current.drink_reminder, nowMs);
    const updatedDrink = logDrinkGlass(curDrink, 1, nowMs);
    if (updatedDrink.sound_enabled) {
      playGentleWaterChime();
    }
    setDrinkAlertVisible(false);
    setDrinkCountdownLabel(formatCountdownMs(getNextDrinkDueMs(updatedDrink, nowMs) - nowMs));
    const saved = await saveAppConfigToMachine({ drink_reminder: updatedDrink });
    setAppConfig(saved);
    setEmotion('joy');
  }, []);

  const handleSnoozeDrink = useCallback(async () => {
    const nowMs = Date.now();
    const curDrink = normalizeDrinkReminderConfig(appConfigRef.current.drink_reminder, nowMs);
    const snoozed = snoozeDrinkReminder(curDrink, curDrink.snooze_minutes, nowMs);
    setDrinkAlertVisible(false);
    setDrinkCountdownLabel(formatCountdownMs(getNextDrinkDueMs(snoozed, nowMs) - nowMs));
    const saved = await saveAppConfigToMachine({ drink_reminder: snoozed });
    setAppConfig(saved);
  }, []);

  const handleDismissDrinkAlert = useCallback(async () => {
    const nowMs = Date.now();
    const curDrink = normalizeDrinkReminderConfig(appConfigRef.current.drink_reminder, nowMs);
    const resetTimer: DrinkReminderConfig = {
      ...curDrink,
      last_reminded_at: nowMs,
      snoozed_until: 0,
    };
    setDrinkAlertVisible(false);
    setDrinkCountdownLabel(formatCountdownMs(getNextDrinkDueMs(resetTimer, nowMs) - nowMs));
    const saved = await saveAppConfigToMachine({ drink_reminder: resetTimer });
    setAppConfig(saved);
  }, []);

  useEffect(() => {
    void scanLocalMusicFromMachine(getCachedAppConfig().music_player?.music_folder).then((res) => {
      if (res.folder) setResolvedMusicFolder(res.folder);
      if (res.tracks.length > 0) setLocalMusicTracks(res.tracks);
    });
    return () => {
      audioElRef.current?.pause();
      synthRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const tickHydration = () => {
      const nowMs = Date.now();
      const drinkCfg = normalizeDrinkReminderConfig(appConfigRef.current.drink_reminder, nowMs);
      if (!drinkCfg.enabled) {
        setDrinkCountdownLabel('Paused');
        return;
      }
      const remaining = getNextDrinkDueMs(drinkCfg, nowMs) - nowMs;
      setDrinkCountdownLabel(formatCountdownMs(remaining));
      if (shouldTriggerDrinkReminder(drinkCfg, nowMs) && !drinkAlertVisibleRef.current) {
        if (drinkCfg.sound_enabled) {
          playGentleWaterChime();
        }
        setDrinkAlertVisible(true);
        setEmotion('joy');
      }
    };
    tickHydration();
    const intervalId = window.setInterval(tickHydration, 15_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return registerAssistantRuntimeHandlers({
      onDrinkConfigUpdated: (nextDrink) => {
        const nowMs = Date.now();
        setAppConfig((prev) => ({ ...prev, drink_reminder: nextDrink }));
        setDrinkCountdownLabel(
          nextDrink.enabled ? formatCountdownMs(getNextDrinkDueMs(nextDrink, nowMs) - nowMs) : 'Paused'
        );
      },
      onMusicCommand: async (action: MusicCommandAction) => {
        if (action.type === 'open') {
          if (!musicBoxOpen) handleToggleMusicBox();
          return { ok: true, summary: 'Opened the Luminess Music Player window.' };
        }
        if (action.type === 'close') {
          setMusicBoxOpen(false);
          return { ok: true, summary: 'Minimized the Music Player window (playback state kept).' };
        }
        if (action.type === 'scan') {
          const res = await handleScanMusicFolder();
          return {
            ok: true,
            folder: res.folder,
            count: res.tracks.length,
            summary: `Scanned ${res.folder || 'Music folder'}: found ${res.tracks.length} audio file(s).`,
          };
        }
        if (action.type === 'pause') {
          handlePauseMusic();
          return { ok: true, isPlaying: false, summary: 'Paused music playback.' };
        }
        if (action.type === 'resume') {
          if (!musicIsPlaying) {
            await startPlayingTrack(activeMusicTrack, musicConfig);
          }
          return {
            ok: true,
            isPlaying: true,
            track: activeMusicTrack.title,
            summary: `Resumed "${activeMusicTrack.title}".`,
          };
        }
        if (action.type === 'next') {
          handleMusicNext();
          return { ok: true, summary: 'Skipped to next track.' };
        }
        if (action.type === 'prev') {
          handleMusicPrev();
          return { ok: true, summary: 'Switched to previous track.' };
        }
        if (action.type === 'volume') {
          handleSetMusicVolume(action.volume);
          return {
            ok: true,
            volume: action.volume,
            summary: `Music volume set to ${Math.round(action.volume * 100)}%.`,
          };
        }
        if (action.type === 'play') {
          let chosen = activeMusicTrack;
          if (action.query) {
            const q = action.query.toLowerCase();
            const match = musicPlaylist.find(
              (t) =>
                t.title.toLowerCase().includes(q) ||
                t.artist.toLowerCase().includes(q) ||
                t.source.toLowerCase().includes(q)
            );
            if (match) chosen = match;
          }
          await startPlayingTrack(chosen, musicConfig);
          return {
            ok: true,
            track: chosen.title,
            artist: chosen.artist,
            summary: `Now playing "${chosen.title}" (${chosen.artist}).`,
          };
        }
        return {
          ok: true,
          isPlaying: musicIsPlaying,
          track: activeMusicTrack.title,
          artist: activeMusicTrack.artist,
          summary: `${musicIsPlaying ? 'Playing' : 'Paused'}: "${activeMusicTrack.title}" by ${activeMusicTrack.artist}.`,
        };
      },
      onWellbeingCommand: async (action: WellbeingCommandAction) => {
        if (action.type === 'open') {
          if (action.tab === 'taskmanager') {
            if (!taskManagerBoxOpen) handleToggleTaskManagerBox();
            else touchBoxActivity('taskmanager');
            return {
              ok: true,
              tab: 'taskmanager',
              summary: 'Opened the standalone read-only Windows Task Manager viewer.',
            };
          }
          if (action.tab === 'wellbeing' || action.tab === 'recent') {
            setWellbeingTab(action.tab);
          }
          if (action.range) setWellbeingRange(action.range);
          setWellbeingTabSeq((s) => s + 1);
          if (!wellbeingBoxOpen) handleToggleWellbeingBox();
          else touchBoxActivity('wellbeing');
          return {
            ok: true,
            tab: action.tab || 'wellbeing',
            summary:
              action.tab === 'recent'
                ? 'Opened your 5 recent apps tab in Digital Wellbeing.'
                : 'Opened the Digital Wellbeing circle view & usage explainer.',
          };
        }

        const report = buildWellbeingRangeReport(
          wellbeingHistoryRef.current,
          action.range || 'day'
        );
        return {
          ok: true,
          range: report.range,
          total_seconds: report.total_seconds,
          top_apps: report.all_apps.slice(0, 5).map((a) => ({
            name: a.display_name,
            category: a.category,
            seconds: a.seconds,
            percentage: Number(a.percentage.toFixed(1)),
          })),
          summary: report.overall_explanation,
        };
      },
    });
  }, [
    activeMusicTrack,
    handleMusicNext,
    handleMusicPrev,
    handlePauseMusic,
    handleScanMusicFolder,
    handleSetMusicVolume,
    handleToggleMusicBox,
    handleToggleTaskManagerBox,
    handleToggleWellbeingBox,
    musicBoxOpen,
    musicConfig,
    musicIsPlaying,
    musicPlaylist,
    startPlayingTrack,
    taskManagerBoxOpen,
    touchBoxActivity,
    wellbeingBoxOpen,
  ]);

  const handleUpdateConfig = async (nextCfg: AppConfigJson) => {
    const saved = await saveAppConfigToMachine(nextCfg);
    setAppConfig(saved);
    const st = await getMachineStorageStatus();
    setStorageStatus(st);
  };

  const handleSaveProviderKeysFromVaultBox = async (
    keys: { gemini: string; claude: string; codex: string; custom?: string },
    activeProvider: AIProvider
  ) => {
    const cleanKeys = {
      gemini: keys.gemini.trim(),
      claude: keys.claude.trim(),
      codex: keys.codex.trim(),
      custom: (keys.custom ?? providerKeys.custom ?? '').trim(),
    };
    await saveAllProviderKeysToMachine(cleanKeys);
    setSelectedProvider(activeProvider);
    setProviderKeys({
      ...cleanKeys,
      offline: 'offline-local',
    });
    setSelectedProviderState(activeProvider);
  };

  const handleVerifyAndConnect = async (
    providerToVerify?: AIProvider,
    keyToVerify?: string
  ) => {
    const prov = providerToVerify || selectedProvider;
    const currentKey = (keyToVerify !== undefined ? keyToVerify : providerKeys[prov] || '').trim();

    setIsVerifying(true);
    setNormalizedError(null);
    setEmotion('curiosity');

    const updatedKeys = {
      gemini: prov === 'gemini' ? currentKey : (providerKeys.gemini || '').trim(),
      claude: prov === 'claude' ? currentKey : (providerKeys.claude || '').trim(),
      codex: prov === 'codex' ? currentKey : (providerKeys.codex || '').trim(),
      custom: prov === 'custom' ? currentKey : (providerKeys.custom || '').trim(),
    };

    // Persist exact updated keys (fix stale state overwrite bug)
    await saveAllProviderKeysToMachine(updatedKeys);
    setProviderKeys({
      ...updatedKeys,
      offline: 'offline-local',
    });

    (['gemini', 'claude', 'codex', 'custom'] as const).forEach((p) => {
      setProviderApiKey(p, updatedKeys[p]);
    });
    setSelectedProvider(prov);
    setSelectedProviderState(prov);
    if (prov === 'gemini') {
      setApiKey(currentKey);
    }

    const result = await verifyProviderConnection(prov, currentKey, {
      baseUrl: appConfig.custom_api_endpoint,
      apiFormat: appConfig.custom_api_format,
      model:
        prov === 'custom'
          ? appConfig.custom_api_model
          : prov === 'gemini'
            ? appConfig.gemini_model
            : prov === 'claude'
              ? appConfig.claude_model
              : appConfig.codex_model,
      customHeadersJson: appConfig.custom_api_headers,
    });
    setIsVerifying(false);

    if (result.success) {
      setConnectionState('connected_and_verified');
      setNormalizedError(null);
      setVerifiedBanner(result.resolvedInfo || `${prov.toUpperCase()} verified & ready!`);
      localStorage.setItem('LUMINNESS_SETUP_COMPLETED', 'true');
      const nextCfg: AppConfigJson = { ...appConfig, installation_storage_prompted: true };
      void saveAppConfigToMachine(nextCfg);
      setAppConfig(nextCfg);
      setShowApiModal(false);
      setEmotion('joy');
    } else if (result.error) {
      setVerifiedBanner(null);
      setNormalizedError(result.error);
      if (result.error.kind === 'account_ineligible') {
        setConnectionState('account_ineligible');
      } else if (result.error.kind === 'unsupported_credentials') {
        setConnectionState('connection_needs_attention');
      } else if (result.error.kind === 'auth_required') {
        setConnectionState('ready_to_sign_in');
      } else if (result.error.kind === 'invalid_api_key') {
        setConnectionState('setup_required');
      } else if (result.error.kind === 'network_or_provider_failure') {
        setConnectionState('provider_unavailable');
      } else {
        setConnectionState('connection_needs_attention');
      }
      setEmotion('confusion');
    }
  };

  const handleErrorAction = (err: NormalizedAIError) => {
    switch (err.actionCode) {
      case 'sign_in_again':
        void handleGoogleLogin();
        break;
      case 'choose_another_provider': {
        const order: AIProvider[] = ['gemini', 'claude', 'codex', 'custom', 'offline'];
        const next = order[(order.indexOf(selectedProvider) + 1) % order.length];
        setSelectedProviderState(next);
        setNormalizedError(null);
        break;
      }
      case 'fix_connection':
      case 'update_configuration':
        setNormalizedError(null);
        break;
      case 'retry':
        void handleVerifyAndConnect();
        break;
      case 'dismiss':
        setNormalizedError(null);
        break;
    }
  };

  const handleBootComplete = useCallback(() => setBootComplete(true), []);

  const handleModalDragStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a, label, .api-modal-robot-preview, .lum-error-card')) {
      return;
    }
    e.preventDefault();
    void invoke('start_drag').catch(() => {});
  };

  const handleRobotDoubleClick = useCallback(async () => {
    if (showApiModal) return;
    const vw = window.innerWidth || 1920;
    const vh = window.innerHeight || 1080;
    const preset = await computePresetDashboardViaRust(vw, vh);

    const nextSide = chatOpen ? 'left' : chatSide;
    const nextVert = chatOpen ? 'down' : chatVert;
    if (chatOpen) {
      manualSideOverrideRef.current = true;
      manualVertOverrideRef.current = true;
      setChatSide('left');
      setChatVert('down');
    }

    const botStagePos = botVisualToStagePos(
      preset.botObstacleRect.x,
      preset.botObstacleRect.y,
      {
        chatOpen,
        robotSize,
        chatWidth: panelSize.width,
        chatHeight: panelSize.height,
        chatSide: nextSide,
        chatVert: nextVert,
      }
    );

    skipNextWorkspaceAnchorInitRef.current = true;
    companionCenteredDoneRef.current = true;
    setCompanionAnchor((prev) => {
      const updated = { ...prev, left: botStagePos.x, top: botStagePos.y };
      companionAnchorRef.current = updated;
      return updated;
    });

    const now = Date.now();
    for (const id of ALL_FLOATING_BOX_IDS) {
      const solved = preset.boxes[id];
      if (!solved) continue;
      preferredBoxSizesRef.current[id] = { width: solved.width, height: solved.height };
      botFollowOffsetsRef.current[id] = {
        dx: solved.x - preset.botObstacleRect.x,
        dy: solved.y - preset.botObstacleRect.y,
      };
      boxLastActiveRef.current[id] = now;
      setBoxPosById(id, {
        x: solved.x,
        y: solved.y,
        width: solved.width,
        height: solved.height,
        visible: true,
      });
    }

    setCompactBoxes({
      history: false,
      settings: false,
      music: false,
      wellbeing: false,
      taskmanager: false,
    });
    void refreshMemoryAndStorageData();
    void refreshLocalAiStatus();
    void refreshTaskSnapshotNow();
    setHistoryBoxOpen(true);
    setSettingsBoxOpen(true);
    setMusicBoxOpen(true);
    setWellbeingBoxOpen(true);
    setTaskManagerBoxOpen(true);
  }, [
    showApiModal,
    chatOpen,
    chatSide,
    chatVert,
    robotSize,
    panelSize.width,
    panelSize.height,
    setBoxPosById,
    refreshMemoryAndStorageData,
    refreshLocalAiStatus,
    refreshTaskSnapshotNow,
  ]);

  const handleRobotClick = () => {
    if (showApiModal) return;
    const action = appConfig.bot_single_click_action || 'chat';
    switch (action) {
      case 'dashboard':
        void handleRobotDoubleClick();
        break;
      case 'settings':
        handleToggleSettingsBox();
        break;
      case 'music':
        handleToggleMusicBox();
        break;
      case 'wellbeing':
        handleToggleWellbeingBox();
        break;
      case 'taskmanager':
        handleToggleTaskManagerBox();
        break;
      case 'chat':
      default:
        setChatOpen((prev) => !prev);
        break;
    }
  };

  const requestUserPermission = (req: ToolPermissionRequest): Promise<boolean> => {
    if (autoApproveRef.current) {
      return Promise.resolve(true);
    }
    setChatOpen(true);
    setPendingPermission(req);
    return new Promise<boolean>((resolve) => {
      permissionResolverRef.current = resolve;
    });
  };

  const handlePermissionDecision = (decision: PermissionDecision) => {
    const resolver = permissionResolverRef.current;
    permissionResolverRef.current = null;
    setPendingPermission(null);

    if (decision === 'always_allow') {
      setAutoApprove(true);
      autoApproveRef.current = true;
      resolver?.(true);
    } else if (decision === 'allow') {
      resolver?.(true);
    } else {
      resolver?.(false);
    }
  };

  const handleAutonomousRemark = useCallback((remark: string) => {
    if (!chatOpen || isProcessing) return;
    setMessages((previous) => {
      const last = previous[previous.length - 1];
      if (last?.role === 'assistant' && last.content === remark) return previous;
      return [...previous, { role: 'assistant', content: remark, emotion: 'idle' }];
    });
  }, [chatOpen, isProcessing]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: Message = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];

    if (brokenSeconds > 0) {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: `💥 I'm broken from being thrown into the walls! Repairing... I'll be back in ${brokenSeconds}s.`,
          emotion: 'idle',
        },
      ]);
      return;
    }

    recordChatInteraction(text);

    const angerCfg = appConfig.bot_customization?.angerSettings;
    if (angerCfg?.enabled && angerCfg.triggers?.hostileWords && angerCfg.hostileKeywords.length > 0) {
      const lowerText = text.toLowerCase();
      const matched = angerCfg.hostileKeywords.some(
        (kw) => kw.trim().length >= 2 && lowerText.includes(kw.trim().toLowerCase())
      );
      if (matched) {
        const picked =
          angerCfg.customAnnoyedPhrases[
            Math.floor(Math.random() * Math.max(1, angerCfg.customAnnoyedPhrases.length))
          ] || '😠 Hey, watch your words!';
        setAngerTriggerSignal({ seq: Date.now(), amount: 28, reason: picked });
      }
    }

    setMessages(newHistory);
    setIsProcessing(true);
    setEmotion('curiosity');

    try {
      const responseMsg = await runAgent(
        newHistory,
        (toolName) => setActiveTool(toolName),
        (emo) => setEmotion(emo),
        requestUserPermission,
        (label) => {
          setEmotion('surprise');
          setChatOpen(true);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `⏰ Timer finished: ${label}!`,
              emotion: 'joy',
            },
          ]);
        }
      );
      setMessages([...newHistory, responseMsg]);
      if (responseMsg.emotion) {
        setEmotion(responseMsg.emotion);
      }
      void refreshMemoryAndStorageData();
    } catch (e: any) {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: `Error: ${e?.message || String(e)}`,
          emotion: 'confusion',
        },
      ]);
      setEmotion('confusion');
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
      setPendingPermission(null);
    }
  };

  // Sync active chat session messages to local storage and machine database whenever they change
  useEffect(() => {
    if (activeSessionId) {
      saveActiveChatMessages(activeSessionId, messages, googleUser?.email);
      setAllSessions(loadAllChatSessions());
    }
  }, [activeSessionId, messages, googleUser?.email]);

  const handleSelectSession = useCallback((sessionId: string) => {
    const sessions = loadAllChatSessions();
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setActiveSessionId(target.id);
      setMessages(target.messages);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    const { sessionId, messages: newMsgs } = createNewSession();
    setActiveSessionId(sessionId);
    setMessages(newMsgs);
    setAllSessions(loadAllChatSessions());
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    const result = deleteChatSession(sessionId);
    setActiveSessionId(result.activeSessionId);
    setMessages(result.messages);
    setAllSessions(loadAllChatSessions());
  }, []);

  const handleClearAllHistory = useCallback(() => {
    const result = clearAllLocalChatHistory();
    setActiveSessionId(result.sessionId);
    setMessages(result.messages);
    setAllSessions(loadAllChatSessions());
  }, []);

  const handleAddMemory = useCallback(
    (category: UserMemoryItem['category'], key: string, value: string) => {
      addExplicitUserMemory(category, key, value, googleUser?.email);
      setMemories(getUserMemories(googleUser?.email));
    },
    [googleUser?.email]
  );

  const handleDeleteMemory = useCallback(
    (memoryId: string) => {
      deleteUserMemory(memoryId);
      setMemories(getUserMemories(googleUser?.email));
    },
    [googleUser?.email]
  );

  const handleClearMemories = useCallback(() => {
    clearAllUserMemories(googleUser?.email);
    setMemories(getUserMemories(googleUser?.email));
  }, [googleUser?.email]);

  const handleClearSearchHistory = useCallback(() => {
    clearSearchHistory();
    setSearchHistory([]);
  }, []);

  const handleLaunchRecentApp = useCallback((app: RecentRealAppItem) => {
    void invoke('open_item', { target: app.launch_target || app.display_name }).catch(() => {});
  }, []);

  const handleToggleWindowsStartup = useCallback(async (enabled: boolean) => {
    try {
      await invoke('set_windows_startup_enabled', { enabled });
    } catch {
      // Ignore if outside Windows runtime
    }
    const saved = await saveAppConfigToMachine({
      ...appConfigRef.current,
      auto_start_windows: enabled,
      startup_registered_once: enabled ? true : appConfigRef.current.startup_registered_once,
    });
    setAppConfig(saved);
  }, []);

  const handleOpenExternalUrl = useCallback((url: string) => {
    void invoke('open_item', { target: url }).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }, []);

  if (!bootComplete) {
    return <LuminessBootScreen onComplete={handleBootComplete} />;
  }

  return (
    <div
      className={`app-container ${
        showApiModal
          ? 'centered-mode'
          : floatingWorkspaceActive
            ? 'floating-workspace-active'
            : chatOpen
              ? `companion-chat-open chat-side-${chatSide} chat-vert-${chatVert}`
              : 'companion-bot-only'
      }`}
    >
      {showApiModal ? (
        <div className={`api-modal-backdrop emotion-border-${visualEmotion}`}>
          <div ref={modalCardRef} className="api-modal-card" onMouseDown={handleModalDragStart}>
            <div className="api-modal-drag-handle" title="Drag to move">
              <span />
            </div>
            <div className="api-modal-robot-preview">
              <Robot
                emotion={emotion}
                size={118}
                customization={appConfig.bot_customization}
                onResize={setRobotSize}
                onClick={() => setEmotion('joy')}
                onVisualEmotionChange={setVisualEmotion}
                onDragStateChange={setIsDraggingBot}
              />
            </div>

            <div className={`api-modal-badge status-${connectionState}`}>
              <Sparkles size={13} />
              <span>Luminess Assist • {connectionState.replace(/_/g, ' ').toUpperCase()}</span>
            </div>

            <h1 className="api-modal-title">
              {selectedProvider === 'gemini' && googleUser
                ? 'Connected with Google'
                : 'Configure AI Provider & Storage'}
            </h1>
            <p className="api-modal-subtitle">
              Choose your AI model provider, sign in with Google to sync your personal memory, and select how much database storage Luminess may use.
            </p>

            {/* Installation / Setup Database Storage Allocation Selector */}
            <div className="setup-storage-card">
              <div className="setup-storage-header">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={13} />
                  <span>Database Storage Allocation</span>
                </span>
                <span style={{ fontSize: '10px', color: '#34d399' }}>5 GB Recommended</span>
              </div>
              <select
                className="setup-storage-select"
                value={appConfig.storage_tier}
                onChange={(e) => void handleSelectStorageTier(e.target.value as StorageTierId)}
              >
                {STORAGE_TIER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({opt.allocationLabel}){opt.recommended ? ' ★ Recommended' : ''}
                  </option>
                ))}
              </select>
              <div className="setup-storage-hint">
                {STORAGE_RECOMMENDATION_EXPLANATION}
              </div>
            </div>

            {/* Provider Selection Tabs */}
            <div className="provider-tabs">
              {(['custom', 'gemini', 'claude', 'codex', 'offline'] as AIProvider[]).map((p) => {
                const info = PROVIDER_INFO[p];
                const isActive = selectedProvider === p;
                return (
                  <button
                    key={p}
                    type="button"
                    className={`provider-tab ${isActive ? `active ${info.colorClass}` : ''}`}
                    onClick={() => {
                      setSelectedProviderState(p);
                      setNormalizedError(null);
                      setConnectionState('setup_required');
                    }}
                  >
                    <span className="provider-tab-mark">{info.mark}</span>
                    <span>{info.name}</span>
                  </button>
                );
              })}
            </div>

            {antigravityStatus && (
              <div className="antigravity-status-banner">
                <div className="antigravity-status-left">
                  <TerminalSquare size={13} />
                  <span>
                    CLI: {antigravityStatus.installed ? (antigravityStatus.version || 'Detected') : 'Not on PATH'}
                  </span>
                </div>
                <span className="antigravity-mode-badge">Windows DPAPI Vault Active</span>
              </div>
            )}

            {selectedProvider === 'gemini' && googleUser && (
              <div className="google-account-card">
                {googleUser.picture ? (
                  <img
                    src={googleUser.picture}
                    alt={googleUser.name || 'Google User'}
                    className="google-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="google-avatar-fallback">
                    {(googleUser.name || googleUser.email || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="google-account-info">
                  <div className="google-account-name">
                    <span>{googleUser.name || 'Google Account'}</span>
                    <CheckCircle2 size={14} className="verified-icon" />
                  </div>
                  {googleUser.email && (
                    <div className="google-account-email">{googleUser.email} (Memory Synced)</div>
                  )}
                </div>
              </div>
            )}

            {normalizedError && (
              <div className={`lum-error-card kind-${normalizedError.kind}`} role="alert">
                <div className="lum-error-header">
                  <AlertTriangle size={15} />
                  <strong className="lum-error-title">{normalizedError.title}</strong>
                  <span className="lum-error-ref">{normalizedError.diagnosticRef}</span>
                </div>
                <p className="lum-error-desc">{normalizedError.message}</p>
                <div className="lum-error-actions">
                  <button
                    type="button"
                    className="lum-error-action-btn"
                    onClick={() => handleErrorAction(normalizedError)}
                  >
                    <span>{normalizedError.actionLabel}</span>
                    <ArrowRight size={13} />
                  </button>
                  {normalizedError.kind !== 'unknown' && (
                    <button
                      type="button"
                      className="lum-error-dismiss-btn"
                      onClick={() => setNormalizedError(null)}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="api-modal-form">
              {selectedProvider === 'gemini' && (
                <>
                  {googleUser ? (
                    <div className="google-secondary-actions">
                      <button
                        type="button"
                        className="google-secondary-btn"
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn || isVerifying}
                      >
                        {isLoggingIn ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                        <span>Switch Account</span>
                      </button>
                      <button
                        type="button"
                        className="google-secondary-btn danger"
                        onClick={handleGoogleLogout}
                        disabled={isLoggingIn || isVerifying}
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="google-login-btn"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn || isVerifying}
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 size={18} className="spin" />
                          <span>Waiting for Google Sign-In in browser...</span>
                        </>
                      ) : (
                        <>
                          <svg className="google-g-icon" viewBox="0 0 24 24" width="18" height="18">
                            <path
                              fill="#4285F4"
                              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                            />
                          </svg>
                          <span>Sign in with Google</span>
                        </>
                      )}
                    </button>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      margin: '2px 0',
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span>OR API KEY (SAVED TO MACHINE VAULT)</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                </>
              )}

              {selectedProvider === 'offline' ? (
                <div className="offline-mode-card">
                  <div className="offline-mode-badge">
                    <Zap size={14} />
                    <span>Local AI • OpenCode / KiloCode / Ollama / Built-in</span>
                  </div>
                  <p className="offline-mode-desc">
                    Luminess Assist connects directly to bundled CLI agents (OpenCode &amp; KiloCode), local model servers (Ollama :11434, llama.cpp :8080, LM Studio :1234), or its built-in conversational engine.
                  </p>
                  <button
                    type="button"
                    className="api-submit-btn offline"
                    onClick={() => void handleVerifyAndConnect()}
                    disabled={isVerifying}
                  >
                    <Zap size={16} />
                    <span>Activate Local AI Assistant</span>
                  </button>
                </div>
              ) : (
                <>
                  {PROVIDER_INFO[selectedProvider].keyUrl && (
                    <button
                      type="button"
                      className={`provider-keylink-btn ${PROVIDER_INFO[selectedProvider].colorClass}`}
                      onClick={() =>
                        void invoke('open_item', {
                          target: PROVIDER_INFO[selectedProvider].keyUrl,
                        }).catch(() => {
                          window.open(
                            PROVIDER_INFO[selectedProvider].keyUrl,
                            '_blank',
                            'noopener,noreferrer'
                          );
                        })
                      }
                    >
                      <KeyRound size={14} />
                      <span>{PROVIDER_INFO[selectedProvider].btnLabel}</span>
                      <ExternalLink size={13} />
                    </button>
                  )}

                  {selectedProvider === 'custom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '6px' }}>
                      <select
                        className="setup-storage-select"
                        value={appConfig.custom_api_format || 'openai-chat'}
                        onChange={(e) =>
                          void handleUpdateConfig({
                            ...appConfig,
                            custom_api_format: e.target.value as CustomApiFormat,
                          })
                        }
                      >
                        <option value="openai-chat">Format: OpenAI Chat Completions (/chat/completions)</option>
                        <option value="openai-responses">Format: OpenAI Responses (/responses)</option>
                        <option value="anthropic">Format: Anthropic Messages (/messages)</option>
                        <option value="gemini">Format: Gemini REST (:generateContent)</option>
                      </select>
                      <input
                        type="text"
                        className="floating-input"
                        placeholder="Base URL (e.g. https://openrouter.ai/api/v1 or http://127.0.0.1:4000/v1)"
                        value={appConfig.custom_api_endpoint || ''}
                        onChange={(e) =>
                          setAppConfig((prev) => ({ ...prev, custom_api_endpoint: e.target.value }))
                        }
                      />
                    </div>
                  )}

                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginBottom: '6px' }}
                    placeholder={
                      selectedProvider === 'gemini'
                        ? 'Model ID (default: gemini-2.5-flash)'
                        : selectedProvider === 'claude'
                          ? 'Model ID (default: claude-sonnet-4-20250514)'
                          : selectedProvider === 'codex'
                            ? 'Model ID (default: gpt-4o)'
                            : 'Model ID (any string, e.g. deepseek-chat)'
                    }
                    value={
                      selectedProvider === 'gemini'
                        ? appConfig.gemini_model
                        : selectedProvider === 'claude'
                          ? appConfig.claude_model
                          : selectedProvider === 'codex'
                            ? appConfig.codex_model
                            : appConfig.custom_api_model
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setAppConfig((prev) => ({
                        ...prev,
                        ...(selectedProvider === 'gemini'
                          ? { gemini_model: val }
                          : selectedProvider === 'claude'
                            ? { claude_model: val }
                            : selectedProvider === 'codex'
                              ? { codex_model: val }
                              : { custom_api_model: val }),
                      }));
                    }}
                  />

                  <div className="api-input-group">
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder={PROVIDER_INFO[selectedProvider].placeholder}
                      value={providerKeys[selectedProvider] || ''}
                      onChange={(e) => handleProviderKeyChange(selectedProvider, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleVerifyAndConnect();
                      }}
                    />
                    <button
                      type="button"
                      className="toggle-key-btn"
                      onClick={() => setShowKey((s) => !s)}
                      title={showKey ? 'Hide API Key' : 'Show API Key'}
                    >
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="api-submit-btn"
                    onClick={() => void handleVerifyAndConnect()}
                    disabled={isVerifying}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        <span>Verifying & Saving to Machine Vault...</span>
                      </>
                    ) : (
                      <>
                        <span>Save to Machine & Activate</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                className="floating-btn-secondary"
                style={{ width: '100%', marginTop: '6px' }}
                onClick={() => {
                  localStorage.setItem('LUMINNESS_SETUP_COMPLETED', 'true');
                  void handleUpdateConfig({ ...appConfig, installation_storage_prompted: true });
                  setShowApiModal(false);
                  setSettingsTab('look');
                  setSettingsTabSeq((s) => s + 1);
                  setSettingsBoxOpen(true);
                }}
              >
                <Sparkles size={13} />
                <span>Customize Bot Look, Anger Rules & Connectors Next to Live Bot</span>
              </button>
            </div>
          </div>
        </div>
      ) : startupCheckinActive ? (
        <StartupCheckinModal
          botName={appConfig.bot_customization?.botName || 'Luminess'}
          userName={appConfig.bot_customization?.userName || googleUser?.name || ''}
          emotion={emotion}
          visualEmotion={visualEmotion}
          customization={appConfig.bot_customization}
          drinkDailyGlasses={appConfig.drink_reminder?.daily_glasses ?? 0}
          drinkGoalGlasses={appConfig.drink_reminder?.daily_goal_glasses ?? 8}
          recentApps={recentRealApps}
          onLogDrink={() => void handleQuickLogDrink()}
          onLaunchApp={handleLaunchRecentApp}
          onSubmitActivity={(activityText) => {
            setStartupCheckinOpen(false);
            setChatOpen(true);
            void handleSendMessage(activityText);
          }}
          onOpenRecentTabInWellbeing={() => {
            setStartupCheckinOpen(false);
            setWellbeingTab('recent');
            setWellbeingTabSeq((s) => s + 1);
            if (!wellbeingBoxOpen) handleToggleWellbeingBox();
          }}
          onSkip={() => setStartupCheckinOpen(false)}
        />
      ) : (
        <>
          <div
            className={
              floatingWorkspaceActive
                ? `companion-anchor-stage ${
                    chatOpen
                      ? `companion-chat-open chat-side-${chatSide} chat-vert-${chatVert}`
                      : 'companion-bot-only'
                  }`
                : undefined
            }
            style={
              floatingWorkspaceActive
                ? {
                    left: `${companionAnchor.left}px`,
                    top: `${companionAnchor.top}px`,
                    width: `${companionAnchor.width}px`,
                    height: `${companionAnchor.height}px`,
                  }
                : { display: 'contents' }
            }
          >
            {chatOpen && (
              <div ref={chatWrapRef} className={`chat-panel-wrapper side-${chatSide} vert-${chatVert}`}>
                <ChatPanel
                  messages={messages}
                  emotion={visualEmotion}
                  isProcessing={isProcessing}
                  activeTool={activeTool}
                  pendingPermission={pendingPermission}
                  autoApprove={autoApprove}
                  onToggleAutoApprove={() => setAutoApprove((value) => !value)}
                  onPermissionDecision={handlePermissionDecision}
                  onSendMessage={handleSendMessage}
                  onOpenApiModal={handleOpenApiModal}
                  onClose={() => setChatOpen(false)}
                  panelSize={panelSize}
                  onResizePanel={setPanelSize}
                  robotSize={robotSize}
                  onResizeRobot={handleResizeRobot}
                  chatSide={chatSide}
                  onToggleChatSide={handleToggleChatSide}
                  chatVert={chatVert}
                  onToggleChatVert={handleToggleChatVert}
                  currentProvider={selectedProvider}
                  brokenCountdown={brokenSeconds}
                  activeSessionId={activeSessionId}
                  allSessions={allSessions}
                  onSelectSession={handleSelectSession}
                  onNewChat={handleNewChat}
                  onDeleteSession={handleDeleteSession}
                  onClearAllHistory={handleClearAllHistory}
                  isHistoryBoxOpen={historyBoxOpen}
                  onToggleHistoryBox={handleToggleHistoryBox}
                  isSettingsBoxOpen={settingsBoxOpen}
                  onToggleSettingsBox={handleToggleSettingsBox}
                  isMusicBoxOpen={musicBoxOpen}
                  onToggleMusicBox={handleToggleMusicBox}
                  isMusicPlaying={musicIsPlaying}
                  isWellbeingBoxOpen={wellbeingBoxOpen}
                  onToggleWellbeingBox={handleToggleWellbeingBox}
                  isTaskManagerBoxOpen={taskManagerBoxOpen}
                  onToggleTaskManagerBox={handleToggleTaskManagerBox}
                  drinkDailyGlasses={appConfig.drink_reminder?.daily_glasses ?? 0}
                  drinkGoalGlasses={appConfig.drink_reminder?.daily_goal_glasses ?? 8}
                  drinkEnabled={appConfig.drink_reminder?.enabled ?? true}
                  onQuickLogDrink={() => void handleQuickLogDrink()}
                />
              </div>
            )}

            <div ref={robotWrapRef} className="robot-wrapper">
              <Robot
                emotion={emotion}
                size={robotSize}
                customization={appConfig.bot_customization}
                angerTriggerSignal={angerTriggerSignal}
                onResize={handleResizeRobot}
                onClick={handleRobotClick}
                onDoubleClick={() => void handleRobotDoubleClick()}
                workspaceMode={floatingWorkspaceActive}
                workspacePos={{ x: companionAnchor.left, y: companionAnchor.top }}
                onMoveWorkspacePos={handleMoveCompanionInWorkspace}
                onVisualEmotionChange={setVisualEmotion}
                onDragStateChange={setIsDraggingBot}
                onScreenSideChange={handleScreenSideChange}
                onBrokenCountdownChange={setBrokenSeconds}
                onAutonomousRemark={handleAutonomousRemark}
              />
            </div>
          </div>

          {/* Floating Box 1: History, User Memories & Search Database */}
          {historyBoxOpen && (
            <div ref={historyBoxWrapRef} style={{ display: 'contents' }}>
              <FloatingHistoryBox
                position={historyBoxPos}
                onChangePosition={handleMoveHistoryBox}
                emotion={visualEmotion}
                activeSessionId={activeSessionId}
                allSessions={allSessions}
                memories={memories}
                searchHistory={searchHistory}
                googleEmail={googleUser?.email}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onDeleteSession={handleDeleteSession}
                onClearAllHistory={handleClearAllHistory}
                onAddMemory={handleAddMemory}
                onDeleteMemory={handleDeleteMemory}
                onClearMemories={handleClearMemories}
                onClearSearchHistory={handleClearSearchHistory}
                onOpenExternalUrl={handleOpenExternalUrl}
                isCompact={compactBoxes.history}
                onToggleCompact={() => handleToggleCompactBox('history')}
                idleSecondsLeft={boxIdleSeconds.history}
                onActivity={() => touchBoxActivity('history')}
                onClose={() => setHistoryBoxOpen(false)}
              />
            </div>
          )}

          {/* Floating Box 2: Unified Settings, Connectors & Live Bot Customizer */}
          {settingsBoxOpen && (
            <div ref={settingsBoxWrapRef} style={{ display: 'contents' }}>
              <FloatingSettingsBox
                position={settingsBoxPos}
                onChangePosition={handleMoveSettingsBox}
                emotion={visualEmotion}
                config={appConfig}
                storageStatus={storageStatus}
                selectedProvider={selectedProvider}
                providerKeys={providerKeys}
                googleUser={googleUser}
                isLoggingIn={isLoggingIn}
                isVerifying={isVerifying}
                connectionError={normalizedError}
                verifiedBanner={verifiedBanner}
                hardwareReport={hardwareReport}
                localServers={localServers}
                isScanningLocalAi={isScanningLocalAi}
                robotSize={robotSize}
                initialTab={settingsTab}
                externalTabSeq={settingsTabSeq}
                onUpdateConfig={handleUpdateConfig}
                onSelectStorageTier={handleSelectStorageTier}
                onSaveProviderKeys={handleSaveProviderKeysFromVaultBox}
                onVerifyConnection={handleVerifyAndConnect}
                onGoogleLogin={handleGoogleLogin}
                onGoogleLogout={handleGoogleLogout}
                onRefreshLocalAi={refreshLocalAiStatus}
                onResizeRobot={(next) => handleResizeRobot(next)}
                onTriggerBotAnger={(amount, reason, calm) =>
                  setAngerTriggerSignal({ seq: Date.now(), amount, reason, calm })
                }
                onOpenExternalUrl={handleOpenExternalUrl}
                onOpenSetupWizard={handleOpenSetupWizard}
                onRunAiForkCustomize={(prompt) => {
                  setChatOpen(true);
                  void handleSendMessage(prompt);
                }}
                drinkCountdownLabel={drinkCountdownLabel}
                onOpenMusicPlayer={() => {
                  if (!musicBoxOpen) handleToggleMusicBox();
                }}
                onOpenWellbeingBox={() => {
                  if (!wellbeingBoxOpen) handleToggleWellbeingBox();
                }}
                onOpenTaskManager={() => {
                  if (!taskManagerBoxOpen) handleToggleTaskManagerBox();
                }}
                onTriggerDrinkAlert={() => setDrinkAlertVisible(true)}
                onLogDrink={() => void handleQuickLogDrink()}
                memories={memories}
                onAddMemory={handleAddMemory}
                onDeleteMemory={handleDeleteMemory}
                onClearMemories={handleClearMemories}
                onToggleWindowsStartup={handleToggleWindowsStartup}
                isCompact={compactBoxes.settings}
                onToggleCompact={() => handleToggleCompactBox('settings')}
                idleSecondsLeft={boxIdleSeconds.settings}
                onActivity={() => touchBoxActivity('settings')}
                onClose={() => setSettingsBoxOpen(false)}
              />
            </div>
          )}

          {/* Floating Box 3: Built-In Music Player */}
          {musicBoxOpen && (
            <div ref={musicBoxWrapRef} style={{ display: 'contents' }}>
              <FloatingMusicBox
                position={musicBoxPos}
                onChangePosition={handleMoveMusicBox}
                emotion={visualEmotion}
                config={musicConfig}
                playlist={musicPlaylist}
                activeTrack={activeMusicTrack}
                isPlaying={musicIsPlaying}
                currentTime={musicCurrentTime}
                duration={musicDuration}
                isScanning={isScanningMusic}
                resolvedMusicFolder={resolvedMusicFolder}
                playerError={musicPlayerError}
                onPlayPause={handlePlayPauseMusic}
                onSelectTrack={(track) => void startPlayingTrack(track, musicConfig)}
                onNext={handleMusicNext}
                onPrev={handleMusicPrev}
                onSeek={handleSeekMusic}
                onToggleShuffle={handleToggleMusicShuffle}
                onCycleLoop={handleCycleMusicLoop}
                onSetVolume={handleSetMusicVolume}
                onToggleMute={handleToggleMusicMute}
                onScanFolder={(folder) => void handleScanMusicFolder(folder)}
                onAddUrlTrack={handleAddUrlMusicTrack}
                onRemoveCustomTrack={handleRemoveCustomMusicTrack}
                isCompact={compactBoxes.music}
                onToggleCompact={() => handleToggleCompactBox('music')}
                idleSecondsLeft={boxIdleSeconds.music}
                onActivity={() => touchBoxActivity('music')}
                onClose={() => setMusicBoxOpen(false)}
              />
            </div>
          )}

          {/* Floating Box 4: Digital Wellbeing (Circle View + Week/Month + 90d Retention + Recent Apps) */}
          {wellbeingBoxOpen && (
            <div ref={wellbeingBoxWrapRef} style={{ display: 'contents' }}>
              <FloatingWellbeingBox
                position={wellbeingBoxPos}
                onChangePosition={handleMoveWellbeingBox}
                emotion={visualEmotion}
                initialTab={wellbeingTab}
                externalTabSeq={wellbeingTabSeq}
                initialRange={wellbeingRange}
                historyStore={wellbeingHistory}
                activeForegroundApp={activeForegroundApp}
                onClearHistory={() => {
                  void clearWellbeingHistoryOnMachine().then((cleared) => {
                    wellbeingHistoryRef.current = cleared;
                    setWellbeingHistory(cleared);
                  });
                }}
                onOpenTaskManager={() => {
                  if (!taskManagerBoxOpen) handleToggleTaskManagerBox();
                }}
                recentApps={recentRealApps}
                onLaunchApp={handleLaunchRecentApp}
                isCompact={compactBoxes.wellbeing}
                onToggleCompact={() => handleToggleCompactBox('wellbeing')}
                idleSecondsLeft={boxIdleSeconds.wellbeing}
                onActivity={() => touchBoxActivity('wellbeing')}
                onClose={() => setWellbeingBoxOpen(false)}
              />
            </div>
          )}

          {/* Floating Box 5: Standalone Read-Only Task Manager Viewer */}
          {taskManagerBoxOpen && (
            <div ref={taskManagerBoxWrapRef} style={{ display: 'contents' }}>
              <FloatingTaskManagerBox
                position={taskManagerBoxPos}
                onChangePosition={handleMoveTaskManagerBox}
                emotion={visualEmotion}
                taskSnapshot={taskSnapshot}
                isPollingTasks={isPollingTasks}
                onTogglePollingTasks={() => setIsPollingTasks((p) => !p)}
                onRefreshTasksNow={() => void refreshTaskSnapshotNow()}
                isCompact={compactBoxes.taskmanager}
                onToggleCompact={() => handleToggleCompactBox('taskmanager')}
                idleSecondsLeft={boxIdleSeconds.taskmanager}
                onActivity={() => touchBoxActivity('taskmanager')}
                onClose={() => setTaskManagerBoxOpen(false)}
              />
            </div>
          )}

          {/* Floating Hydration / Drink Water Reminder Pill */}
          {drinkAlertVisible && (
            <div ref={drinkAlertWrapRef} style={{ display: 'contents' }}>
              <div
                className="drink-reminder-pill"
                style={{
                  left: `${Math.max(16, Math.min(window.innerWidth - 310, companionAnchor.left + 20))}px`,
                  top: `${Math.max(16, companionAnchor.top - 120)}px`,
                }}
              >
                <div className="floating-card-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Droplets size={16} style={{ color: '#38bdf8' }} />
                    <span className="floating-card-title" style={{ fontSize: 13 }}>
                      Drink Water Reminder
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => void handleDismissDrinkAlert()}
                    title="Dismiss reminder"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="floating-card-sub" style={{ color: '#e2e8f0', fontSize: 12 }}>
                  {appConfig.drink_reminder?.custom_message || DEFAULT_DRINK_MESSAGE}
                </div>
                <div className="floating-card-row" style={{ marginTop: 2 }}>
                  <span style={{ fontSize: 10.5, color: '#7dd3fc', fontWeight: 600 }}>
                    Today: {appConfig.drink_reminder?.daily_glasses ?? 0}/
                    {appConfig.drink_reminder?.daily_goal_glasses ?? 8} glasses
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="floating-btn-secondary"
                      onClick={() => void handleSnoozeDrink()}
                      style={{ padding: '5px 8px', fontSize: 11 }}
                    >
                      Snooze {appConfig.drink_reminder?.snooze_minutes ?? 10}m
                    </button>
                    <button
                      type="button"
                      className="floating-btn-primary"
                      onClick={() => void handleQuickLogDrink()}
                      style={{ padding: '5px 10px', fontSize: 11 }}
                    >
                      <Droplets size={12} />
                      <span>I drank (+1)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
