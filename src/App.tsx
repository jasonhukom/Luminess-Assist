import { useState, useEffect, useRef } from 'react';
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

  // Responsive sizes for Chat Panel border and Robot
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({
    width: 380,
    height: 520,
  });
  const [robotSize, setRobotSize] = useState<number>(190);

  // User permission state for PC & File access
  const [autoApprove, setAutoApprove] = useState<boolean>(false);
  const autoApproveRef = useRef<boolean>(false);
  const [pendingPermission, setPendingPermission] = useState<ToolPermissionRequest | null>(null);
  const permissionResolverRef = useRef<((approved: boolean) => void) | null>(null);

  useEffect(() => {
    autoApproveRef.current = autoApprove;
  }, [autoApprove]);

  // Center window on startup when asking for the AI API key in the middle
  useEffect(() => {
    void invoke('center_window').catch(() => {});
  }, []);

  // Dynamically grow Tauri window if user resizes the border or robot larger than current window
  useEffect(() => {
    const syncWindowSize = async () => {
      try {
        const dpr = window.devicePixelRatio || 1;
        const neededWidthCss = showApiModal
          ? 760
          : chatOpen
            ? panelSize.width + robotSize + 90
            : Math.max(520, robotSize + 140);
        const neededHeightCss = showApiModal
          ? 660
          : chatOpen
            ? Math.max(panelSize.height + 60, robotSize + 120)
            : Math.max(520, robotSize + 140);

        const bounds: any = await invoke('get_window_bounds');
        const targetW = Math.round(Math.max(bounds.width / dpr, neededWidthCss) * dpr);
        const targetH = Math.round(Math.max(bounds.height / dpr, neededHeightCss) * dpr);

        if (Math.abs(targetW - bounds.width) > 10 || Math.abs(targetH - bounds.height) > 10) {
          await invoke('set_window_size', { width: targetW, height: targetH });
        }
      } catch {
        // Ignore outside Tauri runtime
      }
    };
    void syncWindowSize();
  }, [panelSize, robotSize, chatOpen, showApiModal]);

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
      setApiError('Please enter your Gemini API key from Google AI Studio.');
      setEmotion('confusion');
      return;
    }
    setApiKey(trimmed);
    setApiError('');
    setShowApiModal(false);
    setEmotion('joy');
    setChatOpen(true);
    try {
      await invoke('move_to_corner');
    } catch {
      // ignore
    }
  };

  const handleOpenApiModal = async () => {
    setApiKeyInput(getApiKey());
    setApiError('');
    setShowApiModal(true);
    setEmotion('curiosity');
    try {
      await invoke('center_window');
    } catch {
      // ignore
    }
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
    <div className={`app-container ${showApiModal ? 'centered-mode' : 'companion-mode'}`}>
      {showApiModal ? (
        <div className={`api-modal-backdrop emotion-border-${emotion}`}>
          <div className="api-modal-card">
            <div className="api-modal-robot-preview">
              <Robot
                emotion={emotion}
                size={135}
                onResize={setRobotSize}
                onClick={() => setEmotion('joy')}
                onEmotionChange={setEmotion}
              />
            </div>

            <div className="api-modal-badge">
              <Sparkles size={13} />
              <span>Luminess Assist Setup</span>
            </div>

            <h1 className="api-modal-title">Enter Your AI API Key</h1>
            <p className="api-modal-subtitle">
              Connect your Google Gemini API key so Luminess can chat, manage files, and help you with anything on your PC.
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
            <div className="chat-panel-wrapper">
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

          <div className="robot-wrapper">
            <Robot
              emotion={emotion}
              size={robotSize}
              onResize={setRobotSize}
              onClick={handleRobotClick}
              onEmotionChange={setEmotion}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
