import { useState, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, FormEvent } from 'react';
import './FloatingBoxes.css';
import {
  History,
  Search,
  PlusCircle,
  Trash2,
  X,
  Brain,
  Globe,
  Download,
  ExternalLink,
  MessageSquare,
  Move,
  UserCheck,
} from 'lucide-react';
import type { VisualEmotion } from './Robot.tsx';
import type { ChatSession } from '../lib/chatHistory.ts';
import type {
  FloatingBoxPosition,
  SearchHistoryEntry,
  UserMemoryItem,
} from '../lib/memoryAndStorage.ts';

interface FloatingHistoryBoxProps {
  position: FloatingBoxPosition;
  onChangePosition: (next: FloatingBoxPosition) => void;
  emotion: VisualEmotion;
  activeSessionId: string;
  allSessions: ChatSession[];
  memories: UserMemoryItem[];
  searchHistory: SearchHistoryEntry[];
  googleEmail?: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAllHistory: () => void;
  onAddMemory: (category: UserMemoryItem['category'], key: string, value: string) => void;
  onDeleteMemory: (memoryId: string) => void;
  onClearMemories: () => void;
  onClearSearchHistory: () => void;
  onOpenExternalUrl: (url: string) => void;
  onClose: () => void;
}

export function FloatingHistoryBox({
  position,
  onChangePosition,
  emotion,
  activeSessionId,
  allSessions,
  memories,
  searchHistory,
  googleEmail,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAllHistory,
  onAddMemory,
  onDeleteMemory,
  onClearMemories,
  onClearSearchHistory,
  onOpenExternalUrl,
  onClose,
}: FloatingHistoryBoxProps) {
  const [activeTab, setActiveTab] = useState<'chats' | 'memories' | 'searches'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [newMemCategory, setNewMemCategory] = useState<UserMemoryItem['category']>('identity');
  const [newMemKey, setNewMemKey] = useState('');
  const [newMemVal, setNewMemVal] = useState('');

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: position.x,
    origY: position.y,
  });

  const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    setIsDragging(true);
  };

  const handleHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    onChangePosition({
      ...position,
      x: dragRef.current.origX + dx,
      y: dragRef.current.origY + dy,
    });
  };

  const handleHeaderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const q = searchQuery.trim().toLowerCase();

  const filteredSessions = allSessions.filter((s) => {
    if (!q) return true;
    if (s.title.toLowerCase().includes(q)) return true;
    return s.messages.some((m) => m.content.toLowerCase().includes(q));
  });

  const filteredMemories = memories.filter((m) => {
    if (!q) return true;
    return (
      m.key.toLowerCase().includes(q) ||
      m.value.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  const filteredSearches = searchHistory.filter((s) => {
    if (!q) return true;
    if (s.query.toLowerCase().includes(q)) return true;
    return s.results.some(
      (r) => r.title.toLowerCase().includes(q) || r.snippet.toLowerCase().includes(q)
    );
  });

  const handleAddMemorySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newMemKey.trim() || !newMemVal.trim()) return;
    onAddMemory(newMemCategory, newMemKey.trim(), newMemVal.trim());
    setNewMemKey('');
    setNewMemVal('');
  };

  const handleExportDatabaseJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      googleAccount: googleEmail || 'local_user',
      sessions: allSessions,
      memories,
      searchHistory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luminess-history-memory-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`floating-ui-box emotion-border-${emotion} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
      }}
    >
      <div
        className="floating-box-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        title="Drag anywhere on screen • Automatically moves away when touching Chatbox"
      >
        <div className="floating-box-title">
          <History size={16} className="text-glow" />
          <span>History & Memory</span>
          <span className="floating-avoid-pill" title="Moves away automatically if touching Chatbox">
            <Move size={10} />
            <span>Auto-Dodge</span>
          </span>
        </div>
        <div className="chat-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={handleExportDatabaseJson}
            title="Export History, Memories & Searches as JSON"
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onNewChat}
            title="Start New Conversation"
          >
            <PlusCircle size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={onClose} title="Close History Box">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="floating-box-tabs">
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          <MessageSquare size={12} />
          <span>Chats ({allSessions.length})</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'memories' ? 'active' : ''}`}
          onClick={() => setActiveTab('memories')}
        >
          <Brain size={12} />
          <span>Who You Are ({memories.length})</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'searches' ? 'active' : ''}`}
          onClick={() => setActiveTab('searches')}
        >
          <Globe size={12} />
          <span>Searches ({searchHistory.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="floating-box-search">
        <Search size={13} className="text-glow" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            activeTab === 'chats'
              ? 'Search conversations & messages...'
              : activeTab === 'memories'
                ? 'Search remembered user facts...'
                : 'Search stored web queries & links...'
          }
        />
        {searchQuery && (
          <button type="button" className="icon-btn" onClick={() => setSearchQuery('')}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="floating-box-body">
        {activeTab === 'chats' && (
          <>
            {filteredSessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 10px' }}>
                <MessageSquare size={32} className="empty-bot-icon" />
                <p className="empty-sub">No matching conversations found.</p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`floating-card-item ${session.id === activeSessionId ? 'active' : ''}`}
                  onClick={() => onSelectSession(session.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="floating-card-row">
                    <span className="floating-card-title">{session.title}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Delete conversation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="floating-card-sub">
                    {session.messages.length} msg{session.messages.length === 1 ? '' : 's'} •{' '}
                    {new Date(session.updatedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {session.accountEmail ? ` • ${session.accountEmail}` : ''}
                  </div>
                </div>
              ))
            )}

            {allSessions.length > 0 && (
              <button
                type="button"
                className="floating-btn-secondary danger"
                onClick={onClearAllHistory}
              >
                <Trash2 size={12} />
                <span>Clear All Conversation History</span>
              </button>
            )}
          </>
        )}

        {activeTab === 'memories' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={13} className="text-glow" />
                  <span>Account Memory Profile</span>
                </span>
                <span style={{ fontSize: '10.5px', color: '#38bdf8' }}>
                  {googleEmail || 'Local Profile'}
                </span>
              </div>
              <div className="floating-card-sub">
                Luminess automatically remembers facts you share in chat (your name, role, preferences, and projects) and links them to your Google account.
              </div>
            </div>

            <form onSubmit={handleAddMemorySubmit} className="floating-card-item" style={{ gap: '6px' }}>
              <div className="floating-card-row">
                <select
                  className="floating-input"
                  style={{ width: '110px' }}
                  value={newMemCategory}
                  onChange={(e) => setNewMemCategory(e.target.value as UserMemoryItem['category'])}
                >
                  <option value="identity">Identity</option>
                  <option value="preference">Preference</option>
                  <option value="project">Project</option>
                  <option value="fact">Fact</option>
                </select>
                <input
                  type="text"
                  className="floating-input"
                  placeholder="Key (e.g. user_name)"
                  value={newMemKey}
                  onChange={(e) => setNewMemKey(e.target.value)}
                />
              </div>
              <div className="floating-card-row">
                <input
                  type="text"
                  className="floating-input"
                  placeholder="Value to remember (e.g. Jason, prefers dark UI)"
                  value={newMemVal}
                  onChange={(e) => setNewMemVal(e.target.value)}
                />
                <button type="submit" className="floating-btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  Save
                </button>
              </div>
            </form>

            {filteredMemories.length === 0 ? (
              <div className="empty-state" style={{ padding: '18px 8px' }}>
                <Brain size={28} className="empty-bot-icon" />
                <p className="empty-sub">
                  No user memories stored yet. Say <em>&quot;My name is ...&quot;</em> or <em>&quot;I prefer ...&quot;</em> in chat!
                </p>
              </div>
            ) : (
              filteredMemories.map((mem) => (
                <div key={mem.id} className="floating-card-item">
                  <div className="floating-card-row">
                    <span className="floating-card-title">
                      [{mem.category.toUpperCase()}] {mem.key.replace(/_/g, ' ')}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onDeleteMemory(mem.id)}
                      title="Delete memory"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="floating-card-sub" style={{ color: '#e2e8f0' }}>
                    {mem.value}
                  </div>
                  <div className="floating-card-sub" style={{ fontSize: '10px' }}>
                    Account: {mem.accountEmail}
                  </div>
                </div>
              ))
            )}

            {memories.length > 0 && (
              <button
                type="button"
                className="floating-btn-secondary danger"
                onClick={onClearMemories}
              >
                <Trash2 size={12} />
                <span>Wipe All Saved Memories</span>
              </button>
            )}
          </>
        )}

        {activeTab === 'searches' && (
          <>
            {filteredSearches.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 10px' }}>
                <Globe size={30} className="empty-bot-icon" />
                <p className="empty-sub">
                  Every search query and source link you ask Luminess about is automatically saved here in your database.
                </p>
              </div>
            ) : (
              filteredSearches.map((entry) => (
                <div key={entry.id} className="floating-card-item">
                  <div className="floating-card-row">
                    <span className="floating-card-title">🔍 {entry.query}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {entry.results.slice(0, 3).map((res, i) => (
                    <div
                      key={i}
                      className="floating-card-sub"
                      style={{
                        paddingTop: '4px',
                        borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <a
                        href={res.url}
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenExternalUrl(res.url);
                        }}
                        style={{
                          color: '#38bdf8',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>{res.title}</span>
                        <ExternalLink size={10} />
                      </a>
                      <div>{res.snippet.slice(0, 120)}{res.snippet.length > 120 ? '...' : ''}</div>
                    </div>
                  ))}
                </div>
              ))
            )}

            {searchHistory.length > 0 && (
              <button
                type="button"
                className="floating-btn-secondary danger"
                onClick={onClearSearchHistory}
              >
                <Trash2 size={12} />
                <span>Clear Search Database Log</span>
              </button>
            )}
          </>
        )}
      </div>

      <div className="floating-box-footer">
        <span>Synced: {googleEmail || 'Local Machine DB'}</span>
        <span>Draggable • Auto-Avoids Chatbox</span>
      </div>
    </div>
  );
}
