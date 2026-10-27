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
