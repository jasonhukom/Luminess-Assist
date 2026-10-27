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
  Maximize2,
  Minimize2,
  Terminal,
  ArrowLeftRight,
  ArrowUpDown,
} from 'lucide-react';
import type { Message, ToolPermissionRequest, PermissionDecision } from '../lib/gemini.ts';
import type { VisualEmotion } from './Robot.tsx';

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
  onResizeRobot: (size: number) => void;
  chatSide: 'left' | 'right';
  onToggleChatSide: () => void;
  chatVert: 'up' | 'down';
  onToggleChatVert: () => void;
  brokenCountdown?: number;
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
  robotSize,
  onResizeRobot,
  chatSide,
  onToggleChatSide,
  chatVert,
  onToggleChatVert,
  brokenCountdown = 0,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isResizing, setIsResizing] = useState(false);
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

  const toggleQuickSize = () => {
    const isLarge = panelSize.width > 460 || panelSize.height > 580;
    if (isLarge) {
      onResizePanel({ width: 340, height: 440 });
    } else {
      onResizePanel({ width: 540, height: 640 });
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
        <div className="chat-title">
          <Bot size={18} className="text-glow" />
          <span>Luminess Assist</span>
        </div>
        <div className="chat-actions">
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
            onClick={onToggleChatSide}
            title={`Horizontal: ${chatSide === 'left' ? 'Left of Bot' : 'Right of Bot'} (Click to switch left/right)`}
          >
            <ArrowLeftRight size={14} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={onToggleChatVert}
            title={`Vertical: ${chatVert === 'up' ? 'Up from Bot' : 'Down from Bot'} (Click to switch up/down)`}
          >
            <ArrowUpDown size={14} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => onResizeRobot(robotSize >= 240 ? 130 : robotSize + 45)}
            title={`Bot Size: ${robotSize}px (Click to cycle size or scroll on bot)`}
          >
            <span className="size-badge">Bot</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={toggleQuickSize}
            title="Toggle Big / Small Border Size (or drag any edge/corner)"
          >
            {panelSize.width > 460 ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={onOpenApiModal}
            title="Google Account & Sign-In Settings"
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
              Ask me to read/write files, search folders, run PowerShell commands, or open apps. I&apos;ll ask your permission before making changes!
            </p>
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
    </div>
  );
}
