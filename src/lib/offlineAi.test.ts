import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string, _args?: any) => {
    if (cmd === 'open_item') return Promise.resolve(true);
    if (cmd === 'get_pc_context') {
      return Promise.resolve({
        os: 'Windows 11',
        username: 'TestUser',
        desktop: 'C:\\Users\\TestUser\\Desktop',
        drives: ['C:', 'D:'],
      });
    }
    return Promise.resolve('ok');
  }),
}));

import { runOfflineAgent } from './offlineAi.ts';
import type { Message } from './gemini.ts';

describe('Offline AI Engine', () => {
  const mockToolStart = vi.fn();
  const mockEmotion = vi.fn();
  const mockRequestPermission = vi.fn().mockResolvedValue(true);
  const mockTimerComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('evaluates safe simple math calculations', async () => {
    const history: Message[] = [{ role: 'user', content: 'what is 25 * 4' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(res.role).toBe('assistant');
    expect(res.content).toBe('**100**');
    expect(mockEmotion).toHaveBeenCalledWith('curiosity');
  });

  it('responds with local time', async () => {
    const history: Message[] = [{ role: 'user', content: 'what time is it?' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(res.content).toContain('The local time is');
    expect(mockEmotion).toHaveBeenCalledWith('joy');
  });

  it('responds to greetings warmly and concisely', async () => {
    const history: Message[] = [{ role: 'user', content: 'hello Luminess!' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(res.content.toLowerCase()).toMatch(/offline|local|help|luminess/);
    expect(res.emotion).toBe('joy');
  });

  it('provides offline assistant capabilities info on help query', async () => {
    const history: Message[] = [{ role: 'user', content: 'who are you and what can you do?' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(res.content).toContain('Luminess Assist');
    expect(res.content).toContain('Offline Mode');
  });

  it('detects app launch request and calls open_item with permission', async () => {
    const history: Message[] = [{ role: 'user', content: 'open notepad please' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(mockRequestPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'open_item',
        args: { target: 'notepad.exe' },
      })
    );
    expect(res.content).toContain('Notepad');
  });

  it('detects timer duration and calls set_timer', async () => {
    const history: Message[] = [{ role: 'user', content: 'set timer for 10 minutes' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(mockRequestPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'set_timer',
        args: expect.objectContaining({ minutes: 10 }),
      })
    );
    expect(res.content).toContain('Timer set for **10 minutes**');
  });

  it('returns local PC specs and environment when asked', async () => {
    const history: Message[] = [{ role: 'user', content: 'what are my pc specs?' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(res.content).toContain('Local PC Status');
    expect(res.content).toContain('Windows 11');
    expect(res.content).toContain('TestUser');
    expect(res.content).toContain('Offline Local AI Active');
  });

  it('returns friendly companion fallback for general chatter', async () => {
    const history: Message[] = [{ role: 'user', content: 'supercalifragilisticexpialidocious' }];
    const res = await runOfflineAgent(
      history,
      mockToolStart,
      mockEmotion,
      mockRequestPermission,
      mockTimerComplete
    );

    expect(res.content).toContain('Offline Mode');
    expect(res.emotion).toBe('curiosity');
  });
});
