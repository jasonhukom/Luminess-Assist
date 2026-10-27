import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { Robot } from './components/Robot.tsx';
import type { Emotion } from './components/Robot.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import {
  runAgent,
  getGoogleSession,
  loginWithGoogle,
  logoutGoogle,
  ensureValidGoogleSession,
} from './lib/gemini.ts';
import type {
  Message,
  ToolPermissionRequest,
  PermissionDecision,
  GoogleUserSession,
} from './lib/gemini.ts';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, Loader2, LogOut, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';

function App() {
  const [googleUser, setGoogleUser] = useState<GoogleUserSession | null>(() => getGoogleSession());
  const [showApiModal, setShowApiModal] = useState<boolean>(() => !getGoogleSession());
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');

  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [emotion, setEmotion] = useState<Emotion>('idle');
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

  const modalCardRef = useRef<HTMLDivElement>(null);
  const chatWrapRef = useRef<HTMLDivElement>(null);
  const robotWrapRef = useRef<HTMLDivElement>(null);

  const prevModeRef = useRef<{ showApiModal: boolean; chatOpen: boolean }>({
    showApiModal: true,
    chatOpen: false,
  });

  useEffect(() => {
    autoApproveRef.current = autoApprove;
  }, [autoApprove]);

  // Report interactive regions to Rust so transparent background is 100% click-through
  const syncInteractiveRegions = useCallback(() => {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    if (showApiModal) {
      const el = modalCardRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
    } else {
      if (chatOpen && chatWrapRef.current) {
        const r = chatWrapRef.current.getBoundingClientRect();
        rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      if (robotWrapRef.current) {
        const r = robotWrapRef.current.getBoundingClientRect();
        // Tighten hit box to the character model part itself
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
      forceInteractive: isDraggingBot,
      companionActive: !showApiModal,
    }).catch(() => {});
  }, [showApiModal, chatOpen, isDraggingBot]);

  useEffect(() => {
    syncInteractiveRegions();
    const timer = window.setInterval(syncInteractiveRegions, 120);
    window.addEventListener('resize', syncInteractiveRegions);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', syncInteractiveRegions);
    };
  }, [syncInteractiveRegions, panelSize, robotSize]);

  // Dynamically enlarge window when chat/modal is open and shrink to ONLY the bot when closed
  useEffect(() => {
    const updateWindowGeometry = async () => {
      try {
        const bounds: any = await invoke('get_window_bounds');
        const dpr = bounds.scale_factor || window.devicePixelRatio || 1;

        const targetCssW = showApiModal
          ? 620
          : chatOpen
            ? panelSize.width + robotSize + 160
            : robotSize + 160;

        const targetCssH = showApiModal
          ? 740
          : chatOpen
            ? Math.max(panelSize.height + 144, robotSize + 144)
            : robotSize + 160;

        const targetW = Math.round(targetCssW * dpr);
        const targetH = Math.round(targetCssH * dpr);

        const prev = prevModeRef.current;
        prevModeRef.current = { showApiModal, chatOpen };

        // If showing API modal or just closed API modal -> keep centered in the middle of the screen
        if (showApiModal || (prev.showApiModal && !showApiModal)) {
          const centerX = bounds.monitor_x + Math.round((bounds.monitor_width - targetW) / 2);
          const centerY = bounds.monitor_y + Math.round((bounds.monitor_height - targetH) / 2);
          await invoke('set_window_rect', {
            x: centerX,
            y: centerY,
            width: targetW,
            height: targetH,
          });
          setTimeout(syncInteractiveRegions, 40);
          return;
        }

        // When toggling chatOpen (or resizing while in companion mode), anchor the bot's bottom-right corner
        // so the bot stays in place while the window largens for chat or smallens back to only the bot
        const botRightX = bounds.x + bounds.width;
        const botBottomY = bounds.y + bounds.height;

        let newX = botRightX - targetW;
        let newY = botBottomY - targetH;

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
          prev.chatOpen !== chatOpen
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
  }, [showApiModal, chatOpen, panelSize, robotSize, syncInteractiveRegions]);

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
      setShowApiModal(false);
      setEmotion('joy');
      setChatOpen(false);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || String(err);
      setApiError(msg);
      setEmotion('sadness');
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
    setChatOpen(false);
    setShowApiModal(true);
    setEmotion('curiosity');
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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: Message = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
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
      if (responseMsg.emotion) setEmotion(responseMsg.emotion);
      else setEmotion('joy');
    } catch (e: any) {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: `Error: ${e?.message || String(e)}`,
          emotion: 'sadness',
        },
      ]);
      setEmotion('sadness');
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
      setPendingPermission(null);
    }
  };

  return (
    <div
      className={`app-container ${
        showApiModal ? 'centered-mode' : chatOpen ? 'companion-chat-open' : 'companion-bot-only'
      }`}
    >
      {showApiModal ? (
        <div className={`api-modal-backdrop emotion-border-${emotion}`}>
          <div ref={modalCardRef} className="api-modal-card">
            <div className="api-modal-robot-preview">
              <Robot
                emotion={emotion}
                size={130}
                onResize={setRobotSize}
                onClick={() => setEmotion('joy')}
                onEmotionChange={setEmotion}
                onDragStateChange={setIsDraggingBot}
              />
            </div>

            <div className="api-modal-badge">
              <Sparkles size={13} />
              <span>Luminess Assist • Google Auth</span>
            </div>

            <h1 className="api-modal-title">
              {googleUser ? 'Connected with Google' : 'Sign in with Google'}
            </h1>
            <p className="api-modal-subtitle">
              {googleUser
                ? 'Your Google account is linked for automatic login. Luminess is ready to assist you on your PC.'
                : 'Sign in with your Google account in one click—just like Antigravity. Luminess will automatically keep you signed in.'}
            </p>

            {googleUser && (
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
                    <div className="google-account-email">{googleUser.email}</div>
                  )}
                </div>
              </div>
            )}

            {apiError && <div className="api-error-msg">{apiError}</div>}

            <div className="api-modal-form">
              {googleUser ? (
                <>
                  <button
                    type="button"
                    className="api-submit-btn"
                    onClick={() => {
                      setShowApiModal(false);
                      setEmotion('joy');
                    }}
                  >
                    <span>Continue as {googleUser.name || googleUser.email || 'User'}</span>
                    <ArrowRight size={16} />
                  </button>

                  <div className="google-secondary-actions">
                    <button
                      type="button"
                      className="google-secondary-btn"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                      <span>Switch Account</span>
                    </button>
                    <button
                      type="button"
                      className="google-secondary-btn danger"
                      onClick={handleGoogleLogout}
                      disabled={isLoggingIn}
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="google-login-btn"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      <span>Waiting for Google Sign-In in browser...</span>
                    </>
                  ) : (
                    <>
                      <svg className="google-g-icon" viewBox="0 0 24 24" width="19" height="19">
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
            </div>
          </div>
        </div>
      ) : (
        <>
          {chatOpen && (
            <div ref={chatWrapRef} className="chat-panel-wrapper">
              <ChatPanel
                messages={messages}
                emotion={emotion}
                isProcessing={isProcessing}
                activeTool={activeTool}
                pendingPermission={pendingPermission}
                autoApprove={autoApprove}
                onToggleAutoApprove={() => setAutoApprove((v) => !v)}
                onPermissionDecision={handlePermissionDecision}
                onSendMessage={handleSendMessage}
                onOpenApiModal={handleOpenApiModal}
                onClose={() => setChatOpen(false)}
                panelSize={panelSize}
                onResizePanel={setPanelSize}
                robotSize={robotSize}
                onResizeRobot={setRobotSize}
              />
            </div>
          )}

          <div ref={robotWrapRef} className="robot-wrapper">
            <Robot
              emotion={emotion}
              size={robotSize}
              onResize={setRobotSize}
              onClick={handleRobotClick}
              onEmotionChange={setEmotion}
              onDragStateChange={setIsDraggingBot}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
