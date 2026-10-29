import type { Message } from './gemini.ts';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

const STORAGE_KEY_SESSIONS = 'LUMINESS_LOCAL_CHAT_SESSIONS_V1';
const STORAGE_KEY_ACTIVE_ID = 'LUMINESS_LOCAL_ACTIVE_SESSION_ID_V1';

export const LOCAL_CHAT_PRIVACY_NOTICE = {
  badge: '100% Local & Private',
  title: 'Local Chat Privacy & Data Guarantee',
  license: 'MIT Open Source License • Zero Telemetry',
  summary:
    "Your conversations and desktop tool actions are stored strictly on this device. They are NEVER connected to your Google account, uploaded to cloud databases, or shared with third parties.",
  principles: [
    {
      title: 'Local Storage Only',
      description:
        'All chat history is saved exclusively in your local device storage. Nothing is stored in the cloud.',
    },
    {
      title: 'Decoupled from User Accounts',
      description:
        'Connecting a Google account or API key is strictly used to authenticate AI model inference. Your conversations are never saved to your account or personal profile.',
    },
    {
      title: 'Zero Telemetry & Zero Cloud Relays',
      description:
        'Luminess Assist does not operate tracking servers or database proxies. Prompts travel directly between your PC and the official model endpoint via encrypted HTTPS.',
    },
    {
      title: 'Full Local Erasure',
      description:
        'You have complete ownership of your data. You can clear individual sessions or wipe all local history instantly at any time.',
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
  } catch (err) {
    console.warn('[Luminess] Failed to save local chat sessions:', err);
  }
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

  // If there is an existing session, return the most recent one
  if (sessions.length > 0) {
    const mostRecent = sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    setActiveSessionId(mostRecent.id);
    return { sessionId: mostRecent.id, messages: mostRecent.messages };
  }

  // Otherwise start a fresh initial session
  const newSession: ChatSession = {
    id: generateId(),
    title: 'New Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
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

  if (existingIdx >= 0) {
    sessions[existingIdx] = {
      ...sessions[existingIdx],
      messages,
      title: sessions[existingIdx].title === 'New Conversation' ? title : sessions[existingIdx].title,
      updatedAt: now,
    };
  } else {
    sessions.unshift({
      id: sessionId,
      title,
      createdAt: now,
      updatedAt: now,
      messages,
    });
  }

  saveAllChatSessions(sessions);
  setActiveSessionId(sessionId);
}

export function createNewSession(): { sessionId: string; messages: Message[] } {
  const sessions = loadAllChatSessions();
  const newSession: ChatSession = {
    id: generateId(),
    title: 'New Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };

  // Keep sessions list clean: remove empty "New Conversation" sessions before adding another
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
