import { useState, useEffect, useRef, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import './App.css';
import { Robot } from './components/Robot.tsx';
import { LuminessBootScreen } from './components/LuminessBootScreen.tsx';
import type { Emotion, VisualEmotion } from './components/Robot.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { FloatingHistoryBox } from './components/FloatingHistoryBox.tsx';
import { FloatingSettingsBox } from './components/FloatingSettingsBox.tsx';
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
  resolveFloatingBoxCollision,
  spawnNonOverlappingBox,
  type BoxRect,
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

  // Two New Independent Floating UI Boxes (History Box & Storage/Settings Box)
  const [historyBoxOpen, setHistoryBoxOpen] = useState<boolean>(false);
  const [settingsBoxOpen, setSettingsBoxOpen] = useState<boolean>(false);
  const [historyBoxPos, setHistoryBoxPos] = useState<FloatingBoxPosition>(() => {
    const cfg = getCachedAppConfig();
    return cfg.floating_positions?.history || { x: 48, y: 80, width: 350, height: 470, visible: false };
  });
  const [settingsBoxPos, setSettingsBoxPos] = useState<FloatingBoxPosition>(() => {
    const cfg = getCachedAppConfig();
    return cfg.floating_positions?.settings || { x: 420, y: 80, width: 380, height: 500, visible: false };
  });

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

  const companionReadyRef = useRef<boolean>(false);
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
      const [creds, cfg] = await Promise.all([
        loadMachineCredentialsOnStartup(),
        loadAppConfigFromMachine(),
        loadDatabaseFromMachine(),
      ]);

      setProviderKeys(creds.keys);
      setSelectedProviderState(getSelectedProvider());
      setAppConfig(cfg);
      if (cfg.floating_positions?.history) {
        setHistoryBoxPos(cfg.floating_positions.history);
      }
      if (cfg.floating_positions?.settings) {
        setSettingsBoxPos(cfg.floating_positions.settings);
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

      const status = await getMachineStorageStatus();
      setStorageStatus(status);
      void refreshLocalAiStatus();
    };

    void initMachineData();
  }, [refreshLocalAiStatus]);

  // Compute current Chatbox bounding box on screen for collision avoidance
  const getCurrentChatBoxScreenRect = useCallback((): BoxRect | null => {
    if (!chatOpen || !chatWrapRef.current) return null;
    const r = chatWrapRef.current.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
      x: r.left,
      y: r.top,
      width: r.width,
      height: r.height,
    };
  }, [chatOpen]);

  // Whenever Chatbox opens/moves/resizes, ensure History Box and Settings Box automatically move away if touching
  useEffect(() => {
    if (!historyBoxOpen && !settingsBoxOpen) return;
    const timer = window.setTimeout(() => {
      const chatRect = getCurrentChatBoxScreenRect();
      if (!chatRect) return;
      const screenBounds = { width: window.innerWidth, height: window.innerHeight };

      setHistoryBoxPos((prevHist) => {
        if (!historyBoxOpen) return prevHist;
        const resolved = resolveFloatingBoxCollision(
          prevHist,
          chatRect,
          settingsBoxOpen ? [settingsBoxPos] : [],
          screenBounds,
          18
        );
        if (resolved.x !== prevHist.x || resolved.y !== prevHist.y) {
          return { ...prevHist, x: resolved.x, y: resolved.y };
        }
        return prevHist;
      });

      setSettingsBoxPos((prevSet) => {
        if (!settingsBoxOpen) return prevSet;
        const resolved = resolveFloatingBoxCollision(
          prevSet,
          chatRect,
          historyBoxOpen ? [historyBoxPos] : [],
          screenBounds,
          18
        );
        if (resolved.x !== prevSet.x || resolved.y !== prevSet.y) {
          return { ...prevSet, x: resolved.x, y: resolved.y };
        }
        return prevSet;
      });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [
    chatOpen,
    chatSide,
    chatVert,
    panelSize,
    companionAnchor,
    historyBoxOpen,
    settingsBoxOpen,
    getCurrentChatBoxScreenRect,
  ]);

  const handleMoveHistoryBox = useCallback(
    (nextPos: FloatingBoxPosition) => {
      const chatRect = getCurrentChatBoxScreenRect();
      const screenBounds = { width: window.innerWidth, height: window.innerHeight };
      const resolved = resolveFloatingBoxCollision(
        nextPos,
        chatRect,
        settingsBoxOpen ? [settingsBoxPos] : [],
        screenBounds,
        18
      );
      const updated: FloatingBoxPosition = { ...nextPos, x: resolved.x, y: resolved.y };
      setHistoryBoxPos(updated);
      setAppConfig((prev) => {
        const nextCfg: AppConfigJson = {
          ...prev,
          floating_positions: {
            ...prev.floating_positions,
            history: updated,
          },
        };
        void saveAppConfigToMachine(nextCfg);
        return nextCfg;
      });
    },
    [getCurrentChatBoxScreenRect, settingsBoxOpen, settingsBoxPos]
  );

  const handleMoveSettingsBox = useCallback(
    (nextPos: FloatingBoxPosition) => {
      const chatRect = getCurrentChatBoxScreenRect();
      const screenBounds = { width: window.innerWidth, height: window.innerHeight };
      const resolved = resolveFloatingBoxCollision(
        nextPos,
        chatRect,
        historyBoxOpen ? [historyBoxPos] : [],
        screenBounds,
        18
      );
      const updated: FloatingBoxPosition = { ...nextPos, x: resolved.x, y: resolved.y };
      setSettingsBoxPos(updated);
      setAppConfig((prev) => {
        const nextCfg: AppConfigJson = {
          ...prev,
          floating_positions: {
            ...prev.floating_positions,
            settings: updated,
          },
        };
        void saveAppConfigToMachine(nextCfg);
        return nextCfg;
      });
    },
    [getCurrentChatBoxScreenRect, historyBoxOpen, historyBoxPos]
  );

  const handleToggleHistoryBox = useCallback(() => {
    setHistoryBoxOpen((prev) => {
      const next = !prev;
      if (next) {
        void refreshMemoryAndStorageData();
        setTimeout(() => {
          const chatRect = getCurrentChatBoxScreenRect();
          const screenBounds = { width: window.innerWidth, height: window.innerHeight };
          setHistoryBoxPos((cur) => {
            const spawned = spawnNonOverlappingBox(
              { width: cur.width, height: cur.height },
              { x: cur.x, y: cur.y },
              chatRect,
              settingsBoxOpen ? [settingsBoxPos] : [],
              screenBounds
            );
            return { ...cur, x: spawned.x, y: spawned.y, visible: true };
          });
        }, 50);
      }
      return next;
    });
  }, [getCurrentChatBoxScreenRect, refreshMemoryAndStorageData, settingsBoxOpen, settingsBoxPos]);

  const handleToggleSettingsBox = useCallback(() => {
    setSettingsBoxOpen((prev) => {
      const next = !prev;
      if (next) {
        void refreshMemoryAndStorageData();
        void refreshLocalAiStatus();
        setTimeout(() => {
          const chatRect = getCurrentChatBoxScreenRect();
          const screenBounds = { width: window.innerWidth, height: window.innerHeight };
          setSettingsBoxPos((cur) => {
            const spawned = spawnNonOverlappingBox(
              { width: cur.width, height: cur.height },
              { x: cur.x, y: cur.y },
              chatRect,
              historyBoxOpen ? [historyBoxPos] : [],
              screenBounds
            );
            return { ...cur, x: spawned.x, y: spawned.y, visible: true };
          });
        }, 50);
      }
      return next;
    });
  }, [
    getCurrentChatBoxScreenRect,
    refreshMemoryAndStorageData,
    refreshLocalAiStatus,
    historyBoxOpen,
    historyBoxPos,
  ]);

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

    void invoke('set_interactive_regions', {
      rects,
      forceInteractive: !bootComplete || showApiModal || isDraggingBot,
      companionActive: bootComplete && !showApiModal && companionReadyRef.current && brokenSeconds <= 0,
      botCenter,
    }).catch(() => {});
  }, [bootComplete, showApiModal, chatOpen, historyBoxOpen, settingsBoxOpen, isDraggingBot, brokenSeconds]);

  useEffect(() => {
    syncInteractiveRegions();
    const timer = window.setInterval(syncInteractiveRegions, 120);
    window.addEventListener('resize', syncInteractiveRegions);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', syncInteractiveRegions);
    };
  }, [syncInteractiveRegions, panelSize, robotSize, chatSide, chatVert, historyBoxPos, settingsBoxPos]);

  const floatingWorkspaceActive = !showApiModal && (historyBoxOpen || settingsBoxOpen);

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
            const relLeft = Math.round((bounds.x - bounds.monitor_x) / dpr);
            const relTop = Math.round((bounds.y - bounds.monitor_y) / dpr);
            setCompanionAnchor({
              left: relLeft,
              top: relTop,
              width: targetCssW,
              height: targetCssH,
            });
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

        if (showApiModal || (prev.showApiModal && !showApiModal)) {
          modalPlacedRef.current = showApiModal;
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
        void invoke('glide_to_cursor');
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

  const handleOpenApiModal = async () => {
    setNormalizedError(null);
    setProviderKeys({
      gemini: getProviderApiKey('gemini'),
      claude: getProviderApiKey('claude'),
      codex: getProviderApiKey('codex'),
      offline: getProviderApiKey('offline'),
    });
    setSelectedProviderState(getSelectedProvider());
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

  const handleUpdateConfig = async (nextCfg: AppConfigJson) => {
    const saved = await saveAppConfigToMachine(nextCfg);
    setAppConfig(saved);
    const st = await getMachineStorageStatus();
    setStorageStatus(st);
  };

  const handleSaveProviderKeysFromVaultBox = async (
    keys: { gemini: string; claude: string; codex: string },
    activeProvider: AIProvider
  ) => {
    await saveAllProviderKeysToMachine(keys);
    setSelectedProvider(activeProvider);
    setProviderKeys({
      gemini: keys.gemini,
      claude: keys.claude,
      codex: keys.codex,
      offline: 'opencode-local',
    });
    setSelectedProviderState(activeProvider);
  };

  const handleVerifyAndConnect = async (providerToVerify?: AIProvider, keyToVerify?: string) => {
    const prov = providerToVerify || selectedProvider;
    const currentKey = (keyToVerify !== undefined ? keyToVerify : providerKeys[prov] || '').trim();

    setIsVerifying(true);
    setNormalizedError(null);
    setEmotion('curiosity');

    await saveAllProviderKeysToMachine({
      gemini: prov === 'gemini' ? currentKey : providerKeys.gemini || '',
      claude: prov === 'claude' ? currentKey : providerKeys.claude || '',
      codex: prov === 'codex' ? currentKey : providerKeys.codex || '',
    });

    (['gemini', 'claude', 'codex', 'offline'] as AIProvider[]).forEach((p) => {
      setProviderApiKey(p, providerKeys[p] || '');
    });
    setSelectedProvider(prov);
    if (prov === 'gemini') {
      setApiKey(currentKey);
    }

    const result = await verifyProviderConnection(prov, currentKey);
    setIsVerifying(false);

    if (result.success) {
      setConnectionState('connected_and_verified');
      setNormalizedError(null);
      localStorage.setItem('LUMINNESS_SETUP_COMPLETED', 'true');
      const nextCfg: AppConfigJson = { ...appConfig, installation_storage_prompted: true };
      void saveAppConfigToMachine(nextCfg);
      setAppConfig(nextCfg);
      setShowApiModal(false);
      setEmotion('joy');
      setChatOpen(false);
    } else if (result.error) {
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
        const order: AIProvider[] = ['gemini', 'claude', 'codex', 'offline'];
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

  const handleRobotClick = () => {
    if (showApiModal) return;
    setChatOpen((prev) => !prev);
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
              {(['gemini', 'claude', 'codex', 'offline'] as AIProvider[]).map((p) => {
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
                    <span>Local AI • Ollama / llama.cpp / OpenCode / Built-in</span>
                  </div>
                  <p className="offline-mode-desc">
                    Luminess Assist connects automatically to local model servers (Ollama on :11434, llama.cpp on :8080, LM Studio on :1234), OpenCode CLI, or its built-in local conversational engine with persistent memory and web search.
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
                  <button
                    type="button"
                    className={`provider-keylink-btn ${PROVIDER_INFO[selectedProvider].colorClass}`}
                    onClick={() =>
                      void invoke('open_item', { target: PROVIDER_INFO[selectedProvider].keyUrl }).catch(() => {
                        window.open(PROVIDER_INFO[selectedProvider].keyUrl, '_blank', 'noopener,noreferrer');
                      })
                    }
                  >
                    <KeyRound size={14} />
                    <span>{PROVIDER_INFO[selectedProvider].btnLabel}</span>
                    <ExternalLink size={13} />
                  </button>

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
            </div>
          </div>
        </div>
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
                />
              </div>
            )}

            <div ref={robotWrapRef} className="robot-wrapper">
              <Robot
                emotion={emotion}
                size={robotSize}
                onResize={handleResizeRobot}
                onClick={handleRobotClick}
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
                onClose={() => setHistoryBoxOpen(false)}
              />
            </div>
          )}

          {/* Floating Box 2: Storage Options / Settings (config.json) */}
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
                hardwareReport={hardwareReport}
                localServers={localServers}
                isScanningLocalAi={isScanningLocalAi}
                onUpdateConfig={handleUpdateConfig}
                onSelectStorageTier={handleSelectStorageTier}
                onSaveProviderKeys={handleSaveProviderKeysFromVaultBox}
                onGoogleLogin={handleGoogleLogin}
                onGoogleLogout={handleGoogleLogout}
                onRefreshLocalAi={refreshLocalAiStatus}
                onClose={() => setSettingsBoxOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
