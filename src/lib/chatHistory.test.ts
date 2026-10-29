import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAllChatSessions,
  loadActiveChatMessages,
  saveActiveChatMessages,
  createNewSession,
  deleteChatSession,
  clearAllLocalChatHistory,
  clearMemoryStorageForTesting,
  LOCAL_CHAT_PRIVACY_NOTICE,
} from './chatHistory.ts';
import type { Message } from './gemini.ts';

describe('Local Chat History and Privacy', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
    }
    clearMemoryStorageForTesting();
  });

  it('guarantees privacy declarations and license notes', () => {
    expect(LOCAL_CHAT_PRIVACY_NOTICE.badge).toContain('100% Local');
    expect(LOCAL_CHAT_PRIVACY_NOTICE.license).toContain('MIT');
    expect(LOCAL_CHAT_PRIVACY_NOTICE.summary).toContain('NEVER connected to your Google account');
    expect(LOCAL_CHAT_PRIVACY_NOTICE.principles.length).toBeGreaterThanOrEqual(4);
  });

  it('initializes a fresh local session when no history exists', () => {
    const { sessionId, messages } = loadActiveChatMessages();
    expect(sessionId).toBeDefined();
    expect(messages).toEqual([]);
    expect(loadAllChatSessions().length).toBe(1);
  });

  it('persists and retrieves messages strictly locally', () => {
    const { sessionId } = loadActiveChatMessages();
    const testMessages: Message[] = [
      { role: 'user', content: 'Hello Luminess!' },
      { role: 'assistant', content: 'Hi there! I am your local assistant.', emotion: 'joy' },
    ];

    saveActiveChatMessages(sessionId, testMessages);

    const reloaded = loadActiveChatMessages();
    expect(reloaded.sessionId).toBe(sessionId);
    expect(reloaded.messages).toHaveLength(2);
    expect(reloaded.messages[0].content).toBe('Hello Luminess!');
    expect(reloaded.messages[1].emotion).toBe('joy');
  });

  it('creates new conversation sessions without losing previous ones', () => {
    const first = loadActiveChatMessages();
    saveActiveChatMessages(first.sessionId, [
      { role: 'user', content: 'First chat question' },
      { role: 'assistant', content: 'First answer' },
    ]);

    const second = createNewSession();
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.messages).toEqual([]);

    saveActiveChatMessages(second.sessionId, [
      { role: 'user', content: 'Second chat topic' },
      { role: 'assistant', content: 'Second answer' },
    ]);

    const all = loadAllChatSessions();
    expect(all.length).toBe(2);
    expect(all.some((s) => s.id === first.sessionId)).toBe(true);
    expect(all.some((s) => s.id === second.sessionId)).toBe(true);
  });

  it('deletes specific sessions and allows full local wipe', () => {
    const s1 = loadActiveChatMessages();
    saveActiveChatMessages(s1.sessionId, [{ role: 'user', content: 'Chat 1' }]);

    const s2 = createNewSession();
    saveActiveChatMessages(s2.sessionId, [{ role: 'user', content: 'Chat 2' }]);

    deleteChatSession(s1.sessionId);
    const sessionsAfterDel = loadAllChatSessions();
    expect(sessionsAfterDel.length).toBe(1);
    expect(sessionsAfterDel[0].id).toBe(s2.sessionId);

    // Full wipe
    clearAllLocalChatHistory();
    const wiped = loadAllChatSessions();
    expect(wiped.length).toBe(1);
    expect(wiped[0].messages).toEqual([]);
  });
});
