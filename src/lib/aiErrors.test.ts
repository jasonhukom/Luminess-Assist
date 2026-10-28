import { describe, it, expect } from 'vitest';
import {
  normalizeAIError,
  sanitizeErrorMessage,
  type NormalizedAIError,
} from './aiErrors.ts';

describe('AI Error Normalizer and Credentials Sanitizer', () => {
  describe('Sanitization of sensitive credentials', () => {
    it('redacts Google AI Studio keys', () => {
      const msg = 'Invalid key: AIzaSyD94KxL048924823904892348923489234 was rejected';
      const clean = sanitizeErrorMessage(msg);
      expect(clean).not.toContain('AIzaSyD');
      expect(clean).toContain('[REDACTED_API_KEY]');
    });

    it('redacts Anthropic and OpenAI keys', () => {
      const msg = 'Failed with sk-ant-api03-abcdef1234567890abcdef12 and sk-proj-1234567890123456789012';
      const clean = sanitizeErrorMessage(msg);
      expect(clean).not.toContain('sk-ant');
      expect(clean).not.toContain('sk-proj');
      expect(clean).toContain('[REDACTED_API_KEY]');
    });

    it('redacts Bearer tokens and query parameter tokens', () => {
      const msg = 'Authorization: Bearer ya29.a0ARrdaM8123456789?access_token=secret123&refresh_token=refresh456';
      const clean = sanitizeErrorMessage(msg);
      expect(clean).not.toContain('ya29');
      expect(clean).not.toContain('secret123');
      expect(clean).not.toContain('refresh456');
    });
  });

  describe('Missing and expired authentication', () => {
    it('normalizes expired session / unauthenticated error', () => {
      const err = new Error('UNAUTHENTICATED: Your session has expired.');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('auth_required');
      expect(normalized.title).toBe('Sign in required');
      expect(normalized.message).toBe(
        "Your session has expired or you're not signed in. Sign in again to continue."
      );
      expect(normalized.actionLabel).toBe('Sign in again');
      expect(normalized.actionCode).toBe('sign_in_again');
    });

    it('normalizes HTTP 401 unauthenticated status', () => {
      const err = { status: 401, message: 'Unauthorized request' };
      const normalized = normalizeAIError(err, 'claude');

      expect(normalized.kind).toBe('auth_required');
      expect(normalized.title).toBe('Sign in required');
      expect(normalized.actionLabel).toBe('Sign in again');
    });
  });

  describe('ACCESS_TOKEN_TYPE_UNSUPPORTED', () => {
    it('diagnoses user exact error: 401 UNAUTHENTICATED with ACCESS_TOKEN_TYPE_UNSUPPORTED', () => {
      const rawError = {
        message:
          '401 UNAUTHENTICATED: API key not valid. Please pass a valid API key. (reason: ACCESS_TOKEN_TYPE_UNSUPPORTED)',
        status: 401,
      };
      const normalized = normalizeAIError(rawError, 'gemini');

      expect(normalized.kind).toBe('unsupported_credentials');
      expect(normalized.title).toBe('AI connection needs attention');
      expect(normalized.message).toBe(
        "Luminess couldn't use the current credentials with this AI provider. Check the provider configuration or reconnect using a supported authentication method."
      );
      expect(normalized.actionLabel).toBe('Fix connection');
      expect(normalized.actionCode).toBe('fix_connection');
      expect(normalized.diagnosticRef).toMatch(/^REF-[0-9A-F]{4}$/);
    });

    it('diagnoses SUBSCRIPTION_REQUIRED and Code Assist 3501', () => {
      const raw = new Error('Google Code Assist #3501: SUBSCRIPTION_REQUIRED for this account');
      const normalized = normalizeAIError(raw, 'gemini');

      expect(normalized.kind).toBe('unsupported_credentials');
      expect(normalized.title).toBe('AI connection needs attention');
      expect(normalized.actionLabel).toBe('Fix connection');
    });

    it('diagnoses Google token exchange failures or invalid_client errors', () => {
      const err = new Error('Google token exchange failed: {"error": "invalid_client"}');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('unsupported_credentials');
      expect(normalized.title).toBe('AI connection needs attention');
      expect(normalized.actionLabel).toBe('Fix connection');
    });
  });

  describe('Invalid API Keys', () => {
    it('normalizes rejected or invalid API keys', () => {
      const err = new Error('API_KEY_INVALID: The provided API key does not exist');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('invalid_api_key');
      expect(normalized.title).toBe('Invalid API key');
      expect(normalized.message).toBe(
        'The configured API key was rejected. Check your provider settings and update the key to continue.'
      );
      expect(normalized.actionLabel).toBe('Update configuration');
      expect(normalized.actionCode).toBe('update_configuration');
    });

    it('normalizes HTTP 400 invalid API key', () => {
      const err = { status: 400, message: 'Invalid API key provided for provider' };
      const normalized = normalizeAIError(err, 'claude');

      expect(normalized.kind).toBe('invalid_api_key');
      expect(normalized.title).toBe('Invalid API key');
      expect(normalized.actionLabel).toBe('Update configuration');
    });
  });

  describe('Missing project, billing, or permissions', () => {
    it('normalizes SERVICE_DISABLED on Google Cloud', () => {
      const err = new Error(
        'SERVICE_DISABLED: Generative Language API has not been used in project 12345 before or it is disabled.'
      );
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('missing_project_or_permissions');
      expect(normalized.title).toBe('Project or permissions required');
      expect(normalized.message).toContain('not enabled on your cloud project');
      expect(normalized.actionLabel).toBe('Update configuration');
      expect(normalized.actionCode).toBe('update_configuration');
    });

    it('normalizes billing disabled errors', () => {
      const err = new Error('BILLING_DISABLED: Cloud billing account is closed or missing');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('missing_project_or_permissions');
      expect(normalized.message).toContain('Cloud billing is disabled');
    });

    it('normalizes PERMISSION_DENIED errors without requesting unnecessary sign-in', () => {
      const err = new Error('PERMISSION_DENIED: User lacks models.generateContent permission');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('missing_project_or_permissions');
      expect(normalized.actionCode).toBe('update_configuration');
      expect(normalized.title).toBe('Project or permissions required');
    });
  });

  describe('Network failures and rate limits', () => {
    it('normalizes fetch failures and connection timeouts', () => {
      const err = new TypeError('Failed to fetch');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('network_or_provider_failure');
      expect(normalized.title).toBe('Service temporarily unavailable');
      expect(normalized.message).toContain('temporarily unavailable or the connection failed');
      expect(normalized.actionLabel).toBe('Retry');
      expect(normalized.actionCode).toBe('retry');
    });

    it('normalizes HTTP 429 rate limit errors with retry action', () => {
      const err = { status: 429, message: 'RESOURCE_EXHAUSTED: Rate limit exceeded' };
      const normalized = normalizeAIError(err, 'codex');

      expect(normalized.kind).toBe('network_or_provider_failure');
      expect(normalized.title).toBe('Service temporarily unavailable');
      expect(normalized.message).toContain('rate limit or quota exceeded');
      expect(normalized.actionLabel).toBe('Retry');
    });
  });

  describe('Explicit Age Eligibility and Provider Restrictions', () => {
    it('normalizes explicit age restriction confirmation', () => {
      const err = new Error('User does not meet age requirements for this generative AI model.');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('account_ineligible');
      expect(normalized.title).toBe("This AI provider isn't available for this account");
      expect(normalized.message).toBe(
        'This provider has age eligibility requirements that this account does not meet. Choose another available AI provider to continue using Luminess.'
      );
      expect(normalized.actionLabel).toBe('Choose another provider');
      expect(normalized.actionCode).toBe('choose_another_provider');
    });

    it('does NOT infer age restrictions from generic 401', () => {
      const err = { status: 401, message: '401 Unauthorized' };
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).not.toBe('account_ineligible');
      expect(normalized.kind).toBe('auth_required');
    });

    it('does NOT confuse ACCESS_TOKEN_TYPE_UNSUPPORTED with age ineligibility', () => {
      const err = new Error('ACCESS_TOKEN_TYPE_UNSUPPORTED');
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).not.toBe('account_ineligible');
      expect(normalized.kind).toBe('unsupported_credentials');
    });
  });

  describe('Malformed and unknown errors', () => {
    it('provides friendly fallback with diagnostic reference', () => {
      const err = { unexpected: 'gibberish', code: 999 };
      const normalized = normalizeAIError(err, 'gemini');

      expect(normalized.kind).toBe('unknown');
      expect(normalized.title).toBe('Connection error');
      expect(normalized.message).toContain('Diagnostic reference:');
      expect(normalized.diagnosticRef).toMatch(/^REF-[0-9A-F]{4}$/);
      expect(normalized.actionLabel).toBe('Retry');
    });

    it('preserves existing NormalizedAIError instances without mutating', () => {
      const original: NormalizedAIError = {
        kind: 'unsupported_credentials',
        title: 'AI connection needs attention',
        message: 'Custom message',
        actionLabel: 'Fix connection',
        actionCode: 'fix_connection',
        diagnosticRef: 'REF-TEST',
      };
      const normalized = normalizeAIError(original);
      expect(normalized.diagnosticRef).toBe('REF-TEST');
      expect(normalized.title).toBe('AI connection needs attention');
    });
  });
});
