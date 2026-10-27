import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { Robot } from './components/Robot.tsx';
import { AuraBootScreen } from './components/AuraBootScreen.tsx';
import { AuraOnboarding } from './components/AuraOnboarding.tsx';
import type { Emotion, VisualEmotion } from './components/Robot.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
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
} from './lib/gemini.ts';
import type {
  Message,
  ToolPermissionRequest,
  PermissionDecision,
  GoogleUserSession,
  AIProvider,
} from './lib/gemini.ts';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [googleUser, setGoogleUser] = useState<GoogleUserSession | null>(() => getGoogleSession());
  const [bootComplete, setBootComplete] = useState<boolean>(false);
  const [selectedProvider, setSelectedProviderState] = useState<AIProvider>(() => getSelectedProvider());
  const [providerKeys, setProviderKeys] = useState<Record<AIProvider, string>>(() => ({
    gemini: getProviderApiKey('gemini'),
    claude: getProviderApiKey('claude'),
    codex: getProviderApiKey('codex'),
  }));
  const [showApiModal, setShowApiModal] = useState<boolean>(() =>
    !localStorage.getItem('LUMINNESS_SETUP_COMPLETED') ||
    (!getGoogleSession() && !hasAnyProviderKey())
  );
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');

  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatSide, setChatSide] = useState<'left' | 'right'>('left');
  const [chatVert, setChatVert] = useState<'up' | 'down'>('up');
  const [emotion, setEmotion] = useState<Emotion>('idle');
  const [visualEmotion, setVisualEmotion] = useState<VisualEmotion>('idle');
  const [brokenSeconds, setBrokenSeconds] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
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

  const chatWrapRef = useRef<HTMLDivElement>(null);
  const robotWrapRef = useRef<HTMLDivElement>(null);

  const companionReadyRef = useRef<boolean>(false);
  const manualSideOverrideRef = useRef<boolean>(false);
  const manualVertOverrideRef = useRef<boolean>(false);
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

  // When the robot finishes gliding or being dragged to any quadrant of the screen:
  // - If bot is left, chat goes right; if bot is right, chat goes left.
  // - If bot is up, chat goes down; if bot is down, chat goes up.
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

  // Report interactive regions to Rust so transparent background is 100% click-through
  const syncInteractiveRegions = useCallback(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    if (!bootComplete || showApiModal) {
      rects.push({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    } else {
      if (chatOpen && chatWrapRef.current) {
        const r = chatWrapRef.current.getBoundingClientRect();
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

    void invoke('set_interactive_regions', {
      rects,
      forceInteractive: !bootComplete || showApiModal || isDraggingBot,
      companionActive: bootComplete && !showApiModal && companionReadyRef.current,
    }).catch(() => {});
  }, [bootComplete, showApiModal, chatOpen, isDraggingBot]);

  useEffect(() => {
    syncInteractiveRegions();
    const timer = window.setInterval(syncInteractiveRegions, 120);
    window.addEventListener('resize', syncInteractiveRegions);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', syncInteractiveRegions);
    };
  }, [syncInteractiveRegions, panelSize, robotSize, chatSide, chatVert]);

  // Dynamically enlarge window when chat/modal is open and shrink to ONLY the bot when closed
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
          ? 620
          : chatOpen
            ? panelSize.width + 12 + robotSize + 144
            : robotSize + 144;

        const targetCssH = showApiModal
          ? 740
          : chatOpen
            ? Math.max(panelSize.height, robotSize) + 144
            : robotSize + 144;

        const targetW = Math.round(targetCssW * dpr);
        const targetH = Math.round(targetCssH * dpr);

        const prev = prevModeRef.current;

        // If showing API modal or just closed API modal -> start centered in the middle of the screen,
        // and then let the Rust companion thread smoothly drag/glide the bot to the side of the app!
        if (showApiModal || (prev.showApiModal && !showApiModal)) {
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

        // Determine the robot's current physical box on screen so the robot stays anchored in place
        // whether chat opens/closes on the left/right or up/down.
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

        let newX = !chatOpen
          ? botBoxLeft
          : effectiveSide === 'left'
            ? botBoxRight - targetW
            : botBoxLeft;

        let newY = !chatOpen
          ? botBoxTop
          : effectiveVert === 'up'
            ? botBoxBottom - targetH
            : botBoxTop;

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
  }, [bootComplete, showApiModal, chatOpen, chatSide, chatVert, panelSize, robotSize, syncInteractiveRegions]);

  // Press Esc to close chat and shrink back to only the bot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showApiModal) {
        setChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showApiModal]);

  // Auto-refresh saved Google login session on startup
  useEffect(() => {
    if (googleUser) {
      void ensureValidGoogleSession().then((refreshed) => {
        if (refreshed) {
          setGoogleUser({ ...refreshed });
        }
      });
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setApiError('');
    setEmotion('curiosity');
    try {
      const session = await loginWithGoogle();
      setGoogleUser(session);
      setEmotion('joy');
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || String(err);
      setApiError(msg);
      setEmotion('confusion');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = () => {
    logoutGoogle();
    setGoogleUser(null);
    setApiError('');
    setEmotion('idle');
  };

  const handleOpenApiModal = async () => {
    setApiError('');
    setProviderKeys({
      gemini: getProviderApiKey('gemini'),
      claude: getProviderApiKey('claude'),
      codex: getProviderApiKey('codex'),
    });
    setSelectedProviderState(getSelectedProvider());
    setChatOpen(false);
    setShowApiModal(true);
    setEmotion('curiosity');
  };

  const handleProviderKeyChange = (provider: AIProvider, key: string) => {
    setProviderKeys((previous) => ({ ...previous, [provider]: key }));
  };

  const handleContinueSetup = () => {
    const currentKey = providerKeys[selectedProvider].trim();
    const canUseGoogleOAuth = selectedProvider === 'gemini' && Boolean(googleUser);

    if (!currentKey && !canUseGoogleOAuth) {
      setApiError(
        selectedProvider === 'gemini'
          ? 'Connect Google or enter a Gemini API key to continue.'
          : `Enter your ${selectedProvider === 'claude' ? 'Claude' : 'OpenAI'} API key to continue.`
      );
      return;
    }

    (['gemini', 'claude', 'codex'] as AIProvider[]).forEach((provider) => {
      setProviderApiKey(provider, providerKeys[provider]);
    });
    setSelectedProvider(selectedProvider);
    localStorage.setItem('LUMINNESS_SETUP_COMPLETED', 'true');
    setApiError('');
    setShowApiModal(false);
    setEmotion('idle');
    setChatOpen(false);
  };

  const handleBootComplete = useCallback(() => setBootComplete(true), []);

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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: Message = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];

    // While the robot is broken, the AI is offline until the repair countdown finishes
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

  if (!bootComplete) {
    return <AuraBootScreen onComplete={handleBootComplete} />;
  }

  return (
    <div
      className={`app-container ${
        showApiModal
          ? 'centered-mode'
          : chatOpen
            ? `companion-chat-open chat-side-${chatSide} chat-vert-${chatVert}`
            : 'companion-bot-only'
      }`}
    >
      {showApiModal ? (
        <AuraOnboarding
          googleUser={googleUser}
          isLoggingIn={isLoggingIn}
          error={apiError}
          selectedProvider={selectedProvider}
          providerKeys={providerKeys}
          onProviderChange={setSelectedProviderState}
          onProviderKeyChange={handleProviderKeyChange}
          onGoogleLogin={handleGoogleLogin}
          onGoogleLogout={handleGoogleLogout}
          onContinue={handleContinueSetup}
        />
      ) : (
        <>
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
                onResizeRobot={setRobotSize}
                chatSide={chatSide}
                onToggleChatSide={handleToggleChatSide}
                chatVert={chatVert}
                onToggleChatVert={handleToggleChatVert}
                brokenCountdown={brokenSeconds}
              />
            </div>
          )}

          <div ref={robotWrapRef} className="robot-wrapper">
            <Robot
              emotion={emotion}
              size={robotSize}
              onResize={setRobotSize}
              onClick={handleRobotClick}
              onVisualEmotionChange={setVisualEmotion}
              onDragStateChange={setIsDraggingBot}
              onScreenSideChange={handleScreenSideChange}
              onBrokenCountdownChange={setBrokenSeconds}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
