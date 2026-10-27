import { useState, useEffect, useRef, useCallback } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import { Robot } from './components/Robot.tsx';
import type { Emotion } from './components/Robot.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import {
  runAgent,
  getApiKey,
  setApiKey,
} from './lib/gemini.ts';
import type {
  Message,
  ToolPermissionRequest,
  PermissionDecision,
} from './lib/gemini.ts';
import { invoke } from '@tauri-apps/api/core';
import { KeyRound, ExternalLink, Sparkles, Eye, EyeOff, ArrowRight } from 'lucide-react';

const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

function App() {
  const [showApiModal, setShowApiModal] = useState<boolean>(true);
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getApiKey());
  const [showKeyText, setShowKeyText] = useState<boolean>(false);
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

  const handleOpenAiStudio = async () => {
    try {
      await invoke('open_item', { target: AI_STUDIO_URL });
    } catch {
      window.open(AI_STUDIO_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleApiSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setApiError('Please enter your API key from Google AI Studio.');
      setEmotion('confusion');
      return;
    }
    setApiKey(trimmed);
    setApiError('');
    setShowApiModal(false);
    setEmotion('joy');
    setChatOpen(false);
  };

  const handleOpenApiModal = async () => {
    setApiKeyInput(getApiKey());
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
              <span>Luminess Assist Setup</span>
            </div>

            <h1 className="api-modal-title">Enter Your AI API Key</h1>
            <p className="api-modal-subtitle">
              Connect your Google AI Studio or Vertex AI Express key so Luminess can chat, manage files, and help you on your PC.
            </p>

            <button
              type="button"
              className="aistudio-link-btn"
              onClick={handleOpenAiStudio}
            >
              <KeyRound size={15} />
              <span>Get Free API Key on Google AI Studio</span>
              <ExternalLink size={14} />
            </button>

            <form className="api-modal-form" onSubmit={handleApiSubmit}>
              <div className="api-input-group">
                <input
                  type={showKeyText ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    if (apiError) setApiError('');
                  }}
                  placeholder="Paste your API key (AQ... or AIza...)"
                  autoFocus
                />
                <button
                  type="button"
                  className="toggle-key-btn"
                  onClick={() => setShowKeyText((v) => !v)}
                  title={showKeyText ? 'Hide API Key' : 'Show API Key'}
                >
                  {showKeyText ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {apiError && <div className="api-error-msg">{apiError}</div>}

              <div className="api-modal-actions">
                <button type="submit" className="api-submit-btn">
                  <span>Start Luminess</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
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
