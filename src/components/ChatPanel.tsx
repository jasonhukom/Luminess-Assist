import { useRef, useEffect, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import './ChatPanel.css';
import {
  Send,
  X,
  Loader2,
  Bot,
  User,
  ShieldAlert,
  ShieldCheck,
  Check,
  Ban,
  Terminal,
  History,
  PlusCircle,
  Trash2,
  Lock,
  Info,
  Zap,
  Settings,
  Disc3,
  Droplets,
  Activity,
} from 'lucide-react';
import type { Message, ToolPermissionRequest, PermissionDecision, AIProvider } from '../lib/gemini.ts';
import type { VisualEmotion } from './Robot.tsx';
import {
  LOCAL_CHAT_PRIVACY_NOTICE,
  type ChatSession,
} from '../lib/chatHistory.ts';

interface ChatPanelProps {
  messages: Message[];
  emotion: VisualEmotion;
  isProcessing: boolean;
  activeTool: string | null;
  pendingPermission: ToolPermissionRequest | null;
  autoApprove: boolean;
  onToggleAutoApprove: () => void;
  onPermissionDecision: (decision: PermissionDecision) => void;
  onSendMessage: (text: string) => void;
  onOpenApiModal: () => void;
  onClose: () => void;
  panelSize: { width: number; height: number };
  onResizePanel: (size: { width: number; height: number }) => void;
  robotSize: number;
  onResizeRobot: (size: number, anchor?: { clientX: number; clientY: number }) => void;
  chatSide: 'left' | 'right';
  onToggleChatSide: () => void;
  chatVert: 'up' | 'down';
  onToggleChatVert: () => void;
  brokenCountdown?: number;
  currentProvider?: AIProvider;
  // Local chat history props
  activeSessionId?: string;
  allSessions?: ChatSession[];
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onDeleteSession?: (sessionId: string) => void;
  onClearAllHistory?: () => void;
  // Floating boxes controls
  isHistoryBoxOpen?: boolean;
  onToggleHistoryBox?: () => void;
  isSettingsBoxOpen?: boolean;
  onToggleSettingsBox?: () => void;
  isMusicBoxOpen?: boolean;
  onToggleMusicBox?: () => void;
  isMusicPlaying?: boolean;
  isWellbeingBoxOpen?: boolean;
  onToggleWellbeingBox?: () => void;
  drinkDailyGlasses?: number;
  drinkGoalGlasses?: number;
  drinkEnabled?: boolean;
  onQuickLogDrink?: () => void;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export function ChatPanel({
  messages,
  emotion,
  isProcessing,
  activeTool,
  pendingPermission,
  autoApprove,
  onToggleAutoApprove,
  onPermissionDecision,
  onSendMessage,
  onOpenApiModal,
  onClose,
  panelSize,
  onResizePanel,
  robotSize: _robotSize,
  onResizeRobot: _onResizeRobot,
  chatSide,
  chatVert,
  brokenCountdown = 0,
  currentProvider,
  activeSessionId,
  allSessions = [],
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAllHistory,
  isHistoryBoxOpen = false,
  onToggleHistoryBox,
  isSettingsBoxOpen = false,
  onToggleSettingsBox,
  isMusicBoxOpen = false,
  onToggleMusicBox,
  isMusicPlaying = false,
  isWellbeingBoxOpen = false,
  onToggleWellbeingBox,
  drinkDailyGlasses = 0,
  drinkGoalGlasses = 8,
  drinkEnabled = true,
  onQuickLogDrink,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const resizeRef = useRef<{
    active: boolean;
    dir: ResizeDir;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  }>({
    active: false,
    dir: 'nw',
    startX: 0,
    startY: 0,
    startW: panelSize.width,
    startH: panelSize.height,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, activeTool, pendingPermission]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input);
      setInput('');
    }
  };

  const startResize = (dir: ResizeDir) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = {
      active: true,
      dir,
      startX: e.screenX,
      startY: e.screenY,
      startW: panelSize.width,
      startH: panelSize.height,
    };
    setIsResizing(true);
  };

  const onResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = resizeRef.current;
    if (!st.active) return;

    const dx = e.screenX - st.startX;
    const dy = e.screenY - st.startY;

    let nextW = st.startW;
    let nextH = st.startH;

    if (st.dir.includes('w')) nextW = st.startW - dx;
    if (st.dir.includes('e')) nextW = st.startW + dx;
    if (st.dir.includes('n')) nextH = st.startH - dy;
    if (st.dir.includes('s')) nextH = st.startH + dy;

    nextW = Math.max(260, Math.min(920, nextW));
    nextH = Math.max(280, Math.min(860, nextH));

    onResizePanel({ width: Math.round(nextW), height: Math.round(nextH) });
  };

  const endResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current.active) return;
    resizeRef.current.active = false;
    setIsResizing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`chat-panel chat-side-${chatSide} chat-vert-${chatVert} emotion-border-${emotion} ${isResizing ? 'is-resizing' : ''}`}
      style={{
        width: `${panelSize.width}px`,
        height: `${panelSize.height}px`,
      }}
    >
      {/* 8-Direction Responsive Resize Border Handles */}
      {(['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as ResizeDir[]).map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-${dir}`}
          onPointerDown={startResize(dir)}
          onPointerMove={onResizeMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          title="Drag border to resize big or small"
        />
      ))}

      <div className="chat-header">
        <div className="chat-title" title="Shortcut: Ctrl+Alt+C to open • Arrow keys to move chat • Ctrl+Arrow to move bot">
          <Bot size={18} className="text-glow" />
          <span>Luminess Assist</span>
          {currentProvider === 'offline' && (
            <span className="offline-chip" title="Running in Local AI Mode (Ollama / llama.cpp / OpenCode / Built-in)">
              <Zap size={10} />
              <span>LOCAL AI</span>
            </span>
          )}
        </div>
        <div className="chat-actions">
          {/* New Chat Button */}
          {onNewChat && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setShowHistoryDrawer(false);
                onNewChat();
              }}
              title="New Chat Session"
            >
              <PlusCircle size={15} />
            </button>
          )}

          {/* Floating History & Memory Box Toggle */}
          <button
            type="button"
            className={`icon-btn ${(onToggleHistoryBox ? isHistoryBoxOpen : showHistoryDrawer) ? 'active' : ''}`}
            onClick={() => {
              if (onToggleHistoryBox) {
                onToggleHistoryBox();
              } else {
                setShowHistoryDrawer((v) => !v);
              }
            }}
            title="Floating History & Memory Box (Draggable • Auto-Avoids Chatbox)"
          >
            <History size={15} />
          </button>

          {/* Floating Digital Wellbeing & Task Manager Viewer Toggle */}
          {onToggleWellbeingBox && (
            <button
              type="button"
              className={`icon-btn ${isWellbeingBoxOpen ? 'active' : ''}`}
              onClick={onToggleWellbeingBox}
              title="Digital Wellbeing (Circle Stats • Week/Month) & Task Manager Viewer"
            >
              <Activity size={15} />
            </button>
          )}

          {/* Floating Music Player Box Toggle */}
          {onToggleMusicBox && (
            <button
              type="button"
              className={`icon-btn ${isMusicBoxOpen || isMusicPlaying ? 'active' : ''}`}
              onClick={onToggleMusicBox}
              title={
                isMusicPlaying
                  ? 'Music Player (Playing) • Click to show/hide player'
                  : 'Open Floating Music Player'
              }
            >
              <Disc3 size={15} className={isMusicPlaying ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Quick Drink Water Logger */}
          {onQuickLogDrink && (
            <button
              type="button"
              className={`icon-btn ${drinkEnabled ? 'active' : ''}`}
              onClick={onQuickLogDrink}
              title={`Log +1 glass of water (${drinkDailyGlasses}/${drinkGoalGlasses} today)`}
              style={{ width: 'auto', padding: '0 6px', gap: 3, display: 'inline-flex', alignItems: 'center' }}
            >
              <Droplets size={14} />
              <span style={{ fontSize: '10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {drinkDailyGlasses}
              </span>
            </button>
          )}

          {/* Floating Storage & Settings (config.json) Box Toggle */}
          {onToggleSettingsBox && (
            <button
              type="button"
              className={`icon-btn ${isSettingsBoxOpen ? 'active' : ''}`}
              onClick={onToggleSettingsBox}
              title="Floating Storage & Settings Box (config.json • API Keys • Local AI)"
            >
              <Settings size={15} />
            </button>
          )}

          {/* 100% Local Privacy Guarantee & License Modal Trigger */}
          <button
            type="button"
            className="icon-btn privacy-shield-btn"
            onClick={() => setShowPrivacyModal(true)}
            title="Local Vault & Privacy Guarantee"
          >
            <ShieldCheck size={15} />
          </button>

          <button
            type="button"
            className={`perm-mode-btn ${autoApprove ? 'auto' : 'ask'}`}
            onClick={onToggleAutoApprove}
            title={
              autoApprove
                ? 'Auto-Approving PC Actions (Click to require permission prompt)'
                : 'Asking Before PC Actions (Click to auto-approve)'
            }
          >
            {autoApprove ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
            <span>{autoApprove ? 'Auto PC' : 'Ask First'}</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={onOpenApiModal}
            title="Connectors, API Keys & Account Setup (Connected with Bot)"
          >
            <User size={15} />
          </button>

          <button type="button" className="icon-btn" onClick={onClose} title="Close chat">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <Bot size={44} className="empty-bot-icon" />
            <p className="empty-title">Hi! I have full access to help with your PC.</p>
            <p className="empty-sub">
              Ask me anything! I remember who you are, search the web with citations, and help with files or PowerShell commands.
            </p>
            <button
              type="button"
              className="local-privacy-pill"
              onClick={() => setShowPrivacyModal(true)}
              title="Click to view Privacy & Memory Architecture"
            >
              <Lock size={12} className="privacy-pill-icon" />
              <span>Machine Vault + Account Memory Sync</span>
              <Info size={12} className="privacy-info-icon" />
            </button>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`message-wrapper ${msg.role}`}>
            <div className="message-bubble">
              {msg.role === 'user' ? (
                <User size={14} className="msg-icon" />
              ) : (
                <Bot size={14} className="msg-icon text-glow" />
              )}
              <div className="message-content">
                <div className="message-text">{msg.content}</div>
                {msg.toolActions && msg.toolActions.length > 0 && (
                  <div className="tool-actions-log">
                    {msg.toolActions.map((act, i) => (
                      <div key={i} className="tool-action-item">
                        <Terminal size={11} />
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.emotion && <span className="emotion-tag">[{msg.emotion}]</span>}
              </div>
            </div>
          </div>
        ))}

        {/* User Permission Prompt when AI wants to access files or control the PC */}
        {pendingPermission && (
          <div className="permission-card">
            <div className="permission-header">
              <ShieldAlert size={16} className="perm-icon" />
              <span>AI Requests PC Access</span>
            </div>
            <div className="permission-desc">{pendingPermission.description}</div>
            <div className="permission-meta">
              <code>{pendingPermission.toolName}</code>
              {pendingPermission.args?.path && (
                <span className="perm-path">{String(pendingPermission.args.path)}</span>
              )}
              {pendingPermission.args?.command && (
                <pre className="perm-cmd">{String(pendingPermission.args.command)}</pre>
              )}
            </div>
            <div className="permission-actions">
              <button
                type="button"
                className="perm-btn allow"
                onClick={() => onPermissionDecision('allow')}
              >
                <Check size={14} />
                <span>Allow</span>
              </button>
              <button
                type="button"
                className="perm-btn always"
                onClick={() => onPermissionDecision('always_allow')}
              >
                <ShieldCheck size={14} />
                <span>Always Allow</span>
              </button>
              <button
                type="button"
                className="perm-btn deny"
                onClick={() => onPermissionDecision('deny')}
              >
                <Ban size={14} />
                <span>Deny</span>
              </button>
            </div>
          </div>
        )}

        {isProcessing && !activeTool && !pendingPermission && (
          <div className="message-wrapper assistant processing">
            <div className="message-bubble">
              <Loader2 size={14} className="msg-icon spin text-glow" />
              <div className="message-content">Thinking...</div>
            </div>
          </div>
        )}

        {activeTool && !pendingPermission && (
          <div className="message-wrapper assistant tool-executing">
            <div className="message-bubble">
              <Loader2 size={14} className="msg-icon spin text-glow" />
              <div className="message-content">{activeTool}</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={brokenCountdown > 0 ? `💥 Broken from wall impacts! Repairing in ${brokenCountdown}s...` : "Ask me to do anything on your PC..."}
          disabled={isProcessing || brokenCountdown > 0}
          autoFocus
        />
        <button type="submit" disabled={!input.trim() || isProcessing || brokenCountdown > 0} className="send-btn">
          <Send size={16} />
        </button>
      </form>

      <div className="chat-privacy-subtext" title="API Keys are encrypted in Windows DPAPI Vault; Memories sync to your account">
        <Lock size={10} />
        <span>DPAPI Encrypted Keys • Persistent Account Memory & Search DB</span>
      </div>

      {/* Fallback Local History Drawer if floating box prop not provided */}
      {showHistoryDrawer && !onToggleHistoryBox && (
        <div className="history-drawer">
          <div className="history-drawer-header">
            <div className="history-drawer-title">
              <History size={14} />
              <span>Local Chat History</span>
            </div>
            <div className="history-drawer-actions">
              {onNewChat && (
                <button
                  type="button"
                  className="history-action-btn"
                  onClick={() => {
                    setShowHistoryDrawer(false);
                    onNewChat();
                  }}
                  title="Start a new local chat session"
                >
                  <PlusCircle size={12} />
                  <span>New</span>
                </button>
              )}
              {onClearAllHistory && (
                <button
                  type="button"
                  className="history-action-btn danger"
                  onClick={() => {
                    if (window.confirm('Clear all local chat history? This cannot be undone.')) {
                      onClearAllHistory();
                      setShowHistoryDrawer(false);
                    }
                  }}
                  title="Wipe all local chat logs from this machine"
                >
                  <Trash2 size={12} />
                  <span>Clear All</span>
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowHistoryDrawer(false)}
                title="Close History"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="history-sessions-list">
            {allSessions.length === 0 ? (
              <div className="empty-state" style={{ height: 'auto', padding: '24px 8px' }}>
                <p className="empty-sub">No previous conversation logs.</p>
              </div>
            ) : (
              allSessions.map((session) => (
                <div
                  key={session.id}
                  className={`history-session-item ${session.id === activeSessionId ? 'active' : ''}`}
                  onClick={() => {
                    onSelectSession?.(session.id);
                    setShowHistoryDrawer(false);
                  }}
                >
                  <div className="history-session-info">
                    <span className="history-session-title">{session.title}</span>
                    <span className="history-session-meta">
                      {session.messages.length} message{session.messages.length === 1 ? '' : 's'} •{' '}
                      {new Date(session.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {onDeleteSession && (
                    <button
                      type="button"
                      className="history-item-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Delete this chat session"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="history-drawer-footer">
            <Lock size={11} />
            <span>Stored locally on this device and synced with your active profile.</span>
          </div>
        </div>
      )}

      {/* Local Privacy & License Guarantee Modal */}
      {showPrivacyModal && (
        <div className="privacy-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="privacy-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <div className="privacy-modal-title">
                <ShieldCheck size={18} />
                <span>{LOCAL_CHAT_PRIVACY_NOTICE.title}</span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPrivacyModal(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="privacy-modal-body">
              <div className="privacy-notice-lead">
                <strong>{LOCAL_CHAT_PRIVACY_NOTICE.badge}:</strong> {LOCAL_CHAT_PRIVACY_NOTICE.summary}
              </div>

              <div className="privacy-principles-list">
                {LOCAL_CHAT_PRIVACY_NOTICE.principles.map((pr, idx) => (
                  <div key={idx} className="privacy-principle-item">
                    <ShieldCheck size={14} className="privacy-principle-icon" />
                    <div>
                      <h4>{pr.title}</h4>
                      <p>{pr.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="privacy-license-tag">
                {LOCAL_CHAT_PRIVACY_NOTICE.license}
              </div>
            </div>

            <div className="privacy-modal-footer">
              <button
                type="button"
                className="privacy-close-btn"
                onClick={() => setShowPrivacyModal(false)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
