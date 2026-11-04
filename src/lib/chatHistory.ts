import type { Message } from './gemini.ts';
import { getCachedAppConfig, saveDatabaseToMachine } from './memoryAndStorage.ts';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  accountEmail?: string;
  messages: Message[];
}

const STORAGE_KEY_SESSIONS = 'LUMINESS_LOCAL_CHAT_SESSIONS_V1';
const STORAGE_KEY_ACTIVE_ID = 'LUMINESS_LOCAL_ACTIVE_SESSION_ID_V1';

export const LOCAL_CHAT_PRIVACY_NOTICE = {
  badge: 'Persistent & Private',
  title: 'Chat Memory, Account Sync & Storage Guarantee',
  license: 'MIT Open Source License • User-Controlled Database',
  summary:
    'Your conversations, learned user profile memories, and web search history are saved in your local database with configurable storage quotas and associated with your authenticated Google account.',
  principles: [
    {
      title: 'Separate Machine Keys vs. Account Memory',
      description:
        'Provider API keys are encrypted in your Windows OS Credential Vault on this machine, separate from your Google account conversational memory.',
    },
    {
      title: 'Google Account Memory Synchronization',
      description:
        'When signed in with Google, Luminess remembers who you are, your preferences, and your conversation history under your account profile.',
    },
    {
      title: 'Configurable Database Quotas',
      description:
        'Choose Lightweight (1 GB), Recommended (5 GB), Extended (10 GB), Large (25 GB), or Unlimited storage with automatic disk space protection.',
    },
    {
      title: 'Full Export & Erasure Controls',
      description:
        'You have complete ownership of your data. Search, export to JSON, delete individual memories, or wipe all history anytime.',
    },
  ],
};

const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return memoryStorage.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // fallback
  }
  memoryStorage.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch {
    // fallback
  }
  memoryStorage.delete(key);
}

export function clearMemoryStorageForTesting(): void {
  memoryStorage.clear();
}

function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function summarizeTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg || !firstUserMsg.content.trim()) {
    return 'New Conversation';
  }
  const clean = firstUserMsg.content.trim().replace(/\s+/g, ' ');
  return clean.length > 36 ? `${clean.substring(0, 36)}...` : clean;
}

export function loadAllChatSessions(): ChatSession[] {
  try {
    const raw = getStorageItem(STORAGE_KEY_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (s) => s && typeof s.id === 'string' && Array.isArray(s.messages)
      );
    }
  } catch (err) {
    console.warn('[Luminess] Failed to load local chat sessions:', err);
  }
  return [];
}

export function saveAllChatSessions(sessions: ChatSession[]): void {
  try {
    setStorageItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    void saveDatabaseToMachine({ sessions });
  } catch (err) {
    console.warn('[Luminess] Failed to save local chat sessions:', err);
  }
}

export function searchChatSessions(query: string, sessions?: ChatSession[]): ChatSession[] {
  const all = sessions || loadAllChatSessions();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((session) => {
    if (session.title.toLowerCase().includes(q)) return true;
    return session.messages.some((m) => m.content.toLowerCase().includes(q));
  });
}

export function getActiveSessionId(): string | null {
  try {
    return getStorageItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    return null;
  }
}

export function setActiveSessionId(id: string | null): void {
  try {
    if (id) {
      setStorageItem(STORAGE_KEY_ACTIVE_ID, id);
    } else {
      removeStorageItem(STORAGE_KEY_ACTIVE_ID);
    }
  } catch {
    // ignore
  }
}

export function loadActiveChatMessages(): { sessionId: string; messages: Message[] } {
  const sessions = loadAllChatSessions();
  const activeId = getActiveSessionId();

  if (activeId) {
    const found = sessions.find((s) => s.id === activeId);
    if (found) {
      return { sessionId: found.id, messages: found.messages };
    }
  }

  if (sessions.length > 0) {
    const mostRecent = sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    setActiveSessionId(mostRecent.id);
    return { sessionId: mostRecent.id, messages: mostRecent.messages };
  }

  const email = getCachedAppConfig().google_account_email || undefined;
  const newSession: ChatSession = {
    id: generateId(),
    title: 'New Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accountEmail: email,
    messages: [],
  };
  saveAllChatSessions([newSession]);
  setActiveSessionId(newSession.id);
  return { sessionId: newSession.id, messages: [] };
}

export function saveActiveChatMessages(
  sessionId: string,
  messages: Message[]
): void {
  const sessions = loadAllChatSessions();
  const existingIdx = sessions.findIndex((s) => s.id === sessionId);

  const now = Date.now();
  const title = summarizeTitle(messages);
  const email = getCachedAppConfig().google_account_email || undefined;

  if (existingIdx >= 0) {
    sessions[existingIdx] = {
      ...sessions[existingIdx],
      messages,
      accountEmail: email || sessions[existingIdx].accountEmail,
      title: sessions[existingIdx].title === 'New Conversation' ? title : sessions[existingIdx].title,
      updatedAt: now,
    };
  } else {
    sessions.unshift({
      id: sessionId,
      title,
      createdAt: now,
      updatedAt: now,
      accountEmail: email,
      messages,
    });
  }

  saveAllChatSessions(sessions);
  setActiveSessionId(sessionId);
}

export function createNewSession(): { sessionId: string; messages: Message[] } {
  const sessions = loadAllChatSessions();
  const email = getCachedAppConfig().google_account_email || undefined;
  const newSession: ChatSession = {
    id: generateId(),
    title: 'New Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accountEmail: email,
    messages: [],
  };

  const cleaned = sessions.filter((s) => s.messages.length > 0);
  cleaned.unshift(newSession);

  saveAllChatSessions(cleaned);
  setActiveSessionId(newSession.id);
  return { sessionId: newSession.id, messages: [] };
}

export function deleteChatSession(sessionId: string): {
  activeSessionId: string;
  messages: Message[];
} {
  const sessions = loadAllChatSessions().filter((s) => s.id !== sessionId);
  saveAllChatSessions(sessions);

  if (sessions.length > 0) {
    const nextActive = sessions[0];
    setActiveSessionId(nextActive.id);
    return { activeSessionId: nextActive.id, messages: nextActive.messages };
  }

  const created = createNewSession();
  return { activeSessionId: created.sessionId, messages: created.messages };
}

export function clearAllLocalChatHistory(): {
  sessionId: string;
  messages: Message[];
} {
  try {
    removeStorageItem(STORAGE_KEY_SESSIONS);
    removeStorageItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    // ignore
  }
  return createNewSession();
}
