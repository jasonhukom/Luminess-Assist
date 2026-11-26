import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getProviderApiKey,
  normalizeCustomEndpointUrl,
  parseCustomHeadersJson,
  runAgent,
  saveAllProviderKeysToMachine,
  setProviderApiKey,
  setSelectedProvider,
  verifyProviderConnection,
} from './gemini.ts';
import { saveAppConfigToMachine } from './memoryAndStorage.ts';

describe('Agentic API Keys & Custom Preset-Free Endpoints', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await saveAppConfigToMachine({
      selected_provider: 'gemini',
      gemini_model: 'gemini-2.5-flash',
      claude_model: 'claude-sonnet-4-20250514',
      codex_model: 'gpt-4o',
      custom_api_format: 'openai-chat',
      custom_api_endpoint: '',
      custom_api_model: '',
      custom_api_headers: '',
    });
    setProviderApiKey('gemini', '');
    setProviderApiKey('claude', '');
    setProviderApiKey('codex', '');
    setProviderApiKey('custom', '');
    setSelectedProvider('gemini');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('normalizes arbitrary custom base URLs across all 4 API formats', () => {
    expect(
      normalizeCustomEndpointUrl('https://openrouter.ai/api/v1/', 'openai-chat', 'chat', 'x/y')
    ).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(
      normalizeCustomEndpointUrl('https://myproxy.example.com', 'openai-chat', 'chat', 'custom-1')
    ).toBe('https://myproxy.example.com/v1/chat/completions');
    expect(
      normalizeCustomEndpointUrl(
        'https://myproxy.example.com/custom/chat/completions',
        'openai-chat',
        'models'
      )
    ).toBe('https://myproxy.example.com/custom/models');
    expect(
      normalizeCustomEndpointUrl('https://api.anthropic.com/v1', 'anthropic', 'chat')
    ).toBe('https://api.anthropic.com/v1/messages');
    expect(
      normalizeCustomEndpointUrl('https://api.openai.com/v1', 'openai-responses', 'chat')
    ).toBe('https://api.openai.com/v1/responses');
    expect(
      normalizeCustomEndpointUrl(
        'https://proxy.example.com/v1beta',
        'gemini',
        'chat',
        'gemini-2.5-pro',
        'k123'
      )
    ).toBe('https://proxy.example.com/v1beta/models/gemini-2.5-pro:generateContent?key=k123');
  });

  it('parses custom JSON headers safely and rejects arrays', () => {
    expect(parseCustomHeadersJson('{"HTTP-Referer":"https://luminess.app","X-Title":"Lumi"}')).toEqual({
      'HTTP-Referer': 'https://luminess.app',
      'X-Title': 'Lumi',
    });
    expect(() => parseCustomHeadersJson('["not-an-object"]')).toThrow();
  });

  it('verifies arbitrary custom OpenAI-compatible endpoint & handles max_completion_tokens fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message:
              "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
      });
    globalThis.fetch = fetchMock as any;

    const res = await verifyProviderConnection('custom', 'sk-arbitrary-123', {
      baseUrl: 'https://custom-llm.example.com/v1',
      apiFormat: 'openai-chat',
      model: 'o3-mini',
    });

    expect(res.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.max_completion_tokens).toBe(16);
    expect(secondBody.model).toBe('o3-mini');
  });

  it('stores and retrieves trimmed custom provider keys cleanly', async () => {
    await saveAllProviderKeysToMachine({ custom: '  sk-or-v1-testkey  ' });
    expect(getProviderApiKey('custom')).toBe('sk-or-v1-testkey');
  });

  it('executes agentic custom OpenAI-compatible tool loops without any preset', async () => {
    await saveAppConfigToMachine({
      selected_provider: 'custom',
      custom_api_format: 'openai-chat',
      custom_api_endpoint: 'https://custom-agent.example.com/v1',
      custom_api_model: 'deepseek-chat',
    });
    setSelectedProvider('custom');
    setProviderApiKey('custom', 'sk-custom-key');

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"content":"Custom API connected and ready!","emotion":"joy"}',
            },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as any;

    const emotions: string[] = [];
    const reply = await runAgent(
      [{ role: 'user', content: 'Say hi' }],
      () => {},
      (em) => emotions.push(em),
      async () => true
    );

    expect(reply.content).toBe('Custom API connected and ready!');
    expect(reply.emotion).toBe('joy');
    expect(emotions).toContain('joy');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://custom-agent.example.com/v1/chat/completions');
  });

  it('does not blindly report success for empty Gemini OAuth when no project resolves', async () => {
    const res = await verifyProviderConnection('gemini', '');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
