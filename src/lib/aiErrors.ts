import type { AIProvider } from './gemini.ts';

export type AIConnectionState =
  | 'not_configured'
  | 'ready_to_sign_in'
  | 'signing_in'
  | 'connected_and_verified'
  | 'setup_required'
  | 'connection_needs_attention'
  | 'provider_unavailable'
  | 'account_ineligible';

export type AIErrorKind =
  | 'auth_required'
  | 'unsupported_credentials'
  | 'invalid_api_key'
  | 'missing_project_or_permissions'
  | 'network_or_provider_failure'
  | 'account_ineligible'
  | 'unknown';

export interface NormalizedAIError {
  kind: AIErrorKind;
  title: string;
  message: string;
  actionLabel: string;
  actionCode:
    | 'sign_in_again'
    | 'fix_connection'
    | 'update_configuration'
    | 'choose_another_provider'
    | 'retry'
    | 'dismiss';
  diagnosticRef: string;
  status?: number;
  provider?: AIProvider;
  sanitizedDetails?: string;
}

/**
 * Strips secrets, access tokens, refresh tokens, and API keys from error messages.
 */
export function sanitizeErrorMessage(raw: string): string {
  if (!raw) return '';
  return raw
    // Redact Google AI Studio / GCP API keys (AIza...)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    // Redact Anthropic keys (sk-ant-...)
    .replace(/sk-ant-[0-9a-zA-Z\-_]{20,}/g, '[REDACTED_API_KEY]')
    // Redact OpenAI keys (sk-...)
    .replace(/sk-[a-zA-Z0-9\-_]{20,}/g, '[REDACTED_API_KEY]')
    // Redact Vertex / Express keys
    .replace(/AQ\.[A-Za-z0-9_-]{30,}/g, '[REDACTED_KEY]')
    // Redact Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer [REDACTED_TOKEN]')
    // Redact OAuth query parameters
    .replace(/(client_secret|access_token|refresh_token|code|key)=([A-Za-z0-9_.%-]+)/gi, '$1=[REDACTED]');
}

/**
 * Generates an opaque, user-safe diagnostic reference code (e.g. REF-48E2).
 */
export function generateDiagnosticRef(): string {
  const chars = '0123456789ABCDEF';
  let ref = 'REF-';
  for (let i = 0; i < 4; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}

/**
 * Normalizes raw API errors, HTTP responses, or exceptions from any AI provider
 * into a typed NormalizedAIError matching standard Luminess error specifications.
 */
export function normalizeAIError(
  error: unknown,
  provider?: AIProvider,
  existingRef?: string
): NormalizedAIError {
  const diagnosticRef = existingRef || generateDiagnosticRef();

  if (error && typeof error === 'object' && 'kind' in error && 'actionLabel' in error) {
    const existing = error as NormalizedAIError;
    return {
      ...existing,
      diagnosticRef: existing.diagnosticRef || diagnosticRef,
      provider: provider || existing.provider,
    };
  }

  const rawString =
    typeof error === 'string'
      ? error
      : (error as any)?.message ||
        (error as any)?.error?.message ||
        (error as any)?.error_description ||
        (error as any)?.statusText ||
        JSON.stringify(error) ||
        '';

  const sanitized = sanitizeErrorMessage(rawString);
  const status =
    Number((error as any)?.status) ||
    Number((error as any)?.code) ||
    Number((error as any)?.response?.status) ||
    undefined;

  const lower = sanitized.toLowerCase();

  // 1. Explicit Age Eligibility & Provider Restrictions
  // Must NOT be confused with 401 or ACCESS_TOKEN_TYPE_UNSUPPORTED
  const isExplicitAgeIssue =
    lower.includes('age eligibility') ||
    lower.includes('age_restriction') ||
    lower.includes('age_ineligible') ||
    lower.includes('underage') ||
    lower.includes('not meet age requirements') ||
    lower.includes('minimum age requirement');

  if (isExplicitAgeIssue) {
    return {
      kind: 'account_ineligible',
      title: "This AI provider isn't available for this account",
      message:
        'This provider has age eligibility requirements that this account does not meet. Choose another available AI provider to continue using Luminess.',
      actionLabel: 'Choose another provider',
      actionCode: 'choose_another_provider',
      diagnosticRef,
      status,
      provider,
      sanitizedDetails: sanitized,
    };
  }

  // 2. Unsupported Credentials or Authentication Method
  // (e.g. consumer Google OAuth token passed to generativelanguage developer endpoint,
  // or OAuth token exchange rejection)
  const isUnsupportedCredentials =
    sanitized.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    lower.includes('access_token_type_unsupported') ||
    (lower.includes('api key not valid') && lower.includes('bearer')) ||
    (status === 401 && lower.includes('access_token_type_unsupported')) ||
    sanitized.includes('SUBSCRIPTION_REQUIRED') ||
    lower.includes('code assist is not enabled for this user') ||
    sanitized.includes('#3501') ||
    lower.includes('token exchange') ||
    lower.includes('invalid_client') ||
    lower.includes('unauthorized_client') ||
    lower.includes('google token exchange failed');

  if (isUnsupportedCredentials) {
    return {
      kind: 'unsupported_credentials',
      title: 'AI connection needs attention',
      message:
        "Luminess couldn't use the current credentials with this AI provider. Check the provider configuration or reconnect using a supported authentication method.",
      actionLabel: 'Fix connection',
      actionCode: 'fix_connection',
      diagnosticRef,
      status: status || 401,
      provider,
      sanitizedDetails: sanitized,
    };
  }

  // 3. Invalid API Key
  const isInvalidApiKey =
    sanitized.includes('API_KEY_INVALID') ||
    (lower.includes('api key') && (lower.includes('invalid') || lower.includes('rejected') || lower.includes('not valid'))) ||
    lower.includes('invalid api key') ||
    (status === 400 && lower.includes('api_key')) ||
    (status === 403 && lower.includes('api_key_invalid')) ||
    (lower.includes('authentication error') && lower.includes('key'));

  if (isInvalidApiKey) {
    return {
      kind: 'invalid_api_key',
      title: 'Invalid API key',
      message: 'The configured API key was rejected. Check your provider settings and update the key to continue.',
      actionLabel: 'Update configuration',
      actionCode: 'update_configuration',
      diagnosticRef,
      status: status || 401,
      provider,
      sanitizedDetails: sanitized,
    };
  }

  // 4. Authentication Required (Session expired, missing login, revoked session)
  const isAuthRequired =
    status === 401 ||
    lower.includes('unauthenticated') ||
    lower.includes('session expired') ||
    lower.includes('token expired') ||
    lower.includes('invalid session') ||
    lower.includes('sign in again') ||
    lower.includes('unauthorized');

  if (isAuthRequired) {
    return {
      kind: 'auth_required',
      title: 'Sign in required',
      message: "Your session has expired or you're not signed in. Sign in again to continue.",
      actionLabel: 'Sign in again',
      actionCode: 'sign_in_again',
      diagnosticRef,
      status: 401,
      provider,
      sanitizedDetails: sanitized,
    };
  }

  // 5. Missing Project, API Enablement, Billing, or Permissions
  const isMissingProjectOrPermissions =
    sanitized.includes('SERVICE_DISABLED') ||
    sanitized.includes('PERMISSION_DENIED') ||
    sanitized.includes('BILLING_DISABLED') ||
    lower.includes('has not been used in project') ||
    lower.includes('enable the generative language api') ||
    lower.includes('billing account') ||
    lower.includes('project permission') ||
    lower.includes('insufficient permissions') ||
    (status === 403 && (lower.includes('permission') || lower.includes('project') || lower.includes('disabled')));

  if (isMissingProjectOrPermissions) {
    let explanation =
      'Your cloud project is missing required permissions, API activation, or billing configuration.';
    if (lower.includes('billing')) {
      explanation = 'Cloud billing is disabled or missing for this project. Please configure billing to continue.';
    } else if (lower.includes('service_disabled') || lower.includes('has not been used in project')) {
      explanation =
        'The required AI API is not enabled on your cloud project. Enable it in Google Cloud Console or use an AI Studio key.';
    } else if (lower.includes('permission_denied')) {
      explanation = 'Your account or API key does not have permission to access the requested model or project.';
    }

    return {
      kind: 'missing_project_or_permissions',
      title: 'Project or permissions required',
      message: explanation,
      actionLabel: 'Update configuration',
      actionCode: 'update_configuration',
      diagnosticRef,
      status: status || 403,
      provider,
      sanitizedDetails: sanitized,
    };
  }

  // 6. Network or Provider Failure / Rate Limit / Service Outage
  const isNetworkOrProviderFailure =
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('overloaded');

  if (isNetworkOrProviderFailure) {
    let msg = 'The service is temporarily unavailable or the connection failed. Please check your internet connection and try again.';
    if (status === 429 || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
      msg = 'Provider rate limit or quota exceeded. Please wait a moment before sending another request.';
    }

    return {
      kind: 'network_or_provider_failure',
      title: 'Service temporarily unavailable',
      message: msg,
      actionLabel: 'Retry',
      actionCode: 'retry',
      diagnosticRef,
      status: status || 503,
      provider,
      sanitizedDetails: sanitized,
    };
  }

  // 7. Unknown / Unclassified Error
  return {
    kind: 'unknown',
    title: 'Connection error',
    message: `An unexpected error occurred while communicating with the AI service. Diagnostic reference: ${diagnosticRef}.`,
    actionLabel: 'Retry',
    actionCode: 'retry',
    diagnosticRef,
    status,
    provider,
    sanitizedDetails: sanitized,
  };
}
