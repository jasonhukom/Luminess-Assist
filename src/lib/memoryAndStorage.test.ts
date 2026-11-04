import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_TIER_OPTIONS,
  STORAGE_RECOMMENDATION_EXPLANATION,
  extractAndSaveUserMemoriesFromText,
  addExplicitUserMemory,
  getUserMemories,
  deleteUserMemory,
  clearAllUserMemories,
  syncMemoriesWithGoogleAccount,
  buildUserMemorySystemContext,
  isWebSearchIntent,
  clearMemoryAndStorageForTesting,
} from './memoryAndStorage.ts';

describe('memoryAndStorage', () => {
  beforeEach(() => {
    clearMemoryAndStorageForTesting();
  });

  it('defines all 5 storage allocation tiers with 5 GB as recommended default', () => {
    expect(STORAGE_TIER_OPTIONS.map((t) => t.id)).toEqual([
      'lightweight',
      'recommended',
      'extended',
      'large',
      'unlimited',
    ]);
    const rec = STORAGE_TIER_OPTIONS.find((t) => t.recommended);
    expect(rec?.id).toBe('recommended');
    expect(rec?.limitBytes).toBe(5 * 1024 * 1024 * 1024);
    const unlim = STORAGE_TIER_OPTIONS.find((t) => t.id === 'unlimited');
    expect(unlim?.limitBytes).toBe(0);
    expect(STORAGE_RECOMMENDATION_EXPLANATION).toContain('5 GB');
  });

  it('extracts user identity, preferences, and projects from conversational prompts', () => {
    const added = extractAndSaveUserMemoriesFromText(
      'Hi! My name is Jason and I work as a software architect. I prefer dark mode and concise answers.',
      'jason@example.com'
    );
    expect(added.length).toBeGreaterThanOrEqual(2);
    const memories = getUserMemories('jason@example.com');
    expect(memories.some((m) => m.key === 'user_name' && m.value.includes('Jason'))).toBe(true);
    expect(memories.some((m) => m.category === 'preference')).toBe(true);

    const ctx = buildUserMemorySystemContext('jason@example.com');
    expect(ctx).toContain('PERSISTENT USER MEMORY');
    expect(ctx).toContain('Jason');
  });

  it('associates local memories with Google account upon login sync and supports deletion', async () => {
    const item = addExplicitUserMemory('project', 'current_project', 'Luminess Assist v2', null);
    expect(item.accountEmail).toBe('local_user');

    await syncMemoriesWithGoogleAccount('user@gmail.com');
    const synced = getUserMemories('user@gmail.com');
    expect(synced.some((m) => m.id === item.id && m.accountEmail === 'user@gmail.com')).toBe(true);

    deleteUserMemory(item.id);
    expect(getUserMemories('user@gmail.com').some((m) => m.id === item.id)).toBe(false);

    addExplicitUserMemory('fact', 'favorite_language', 'Rust', 'user@gmail.com');
    clearAllUserMemories('user@gmail.com');
    expect(getUserMemories('user@gmail.com').length).toBe(0);
  });

  it('detects web search intent queries accurately', () => {
    expect(isWebSearchIntent('search the web for latest Tauri v2 docs')).toEqual({
      shouldSearch: true,
      query: 'latest Tauri v2 docs',
    });
    expect(isWebSearchIntent('who is Ada Lovelace?')).toEqual({
      shouldSearch: true,
      query: 'who is Ada Lovelace?',
    });
    expect(isWebSearchIntent('hi')).toEqual({
      shouldSearch: false,
      query: '',
    });
  });
});
