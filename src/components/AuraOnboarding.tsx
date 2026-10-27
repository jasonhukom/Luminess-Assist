import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  UserRound,
  Zap,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { AIProvider, GoogleUserSession } from '../lib/gemini.ts';
import './AuraOnboarding.css';

interface AuraOnboardingProps {
  googleUser: GoogleUserSession | null;
  isLoggingIn: boolean;
  error: string;
  selectedProvider: AIProvider;
  providerKeys: Record<AIProvider, string>;
  onProviderChange: (provider: AIProvider) => void;
  onProviderKeyChange: (provider: AIProvider, key: string) => void;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onContinue: () => void;
}

const PROVIDERS: Array<{
  id: AIProvider;
  name: string;
  mark: string;
  description: string;
  model: string;
  url: string;
  keyLabel: string;
  placeholder: string;
  color: string;
}> = [
  {
    id: 'gemini',
    name: 'Gemini',
    mark: 'G',
    description: 'Google AI models with native Gemini tools and Google account support.',
    model: 'Gemini 2.5 Flash',
    url: 'https://aistudio.google.com/app/apikey',
    keyLabel: 'GEMINI API KEY',
    placeholder: 'Paste your Gemini API key',
    color: 'gemini',
  },
  {
    id: 'claude',
    name: 'Claude',
    mark: 'C',
    description: 'Claude models for thoughtful conversations and agentic tasks.',
    model: 'Claude Sonnet 5.5',
    url: 'https://platform.claude.com/settings/keys',
    keyLabel: 'ANTHROPIC API KEY',
    placeholder: 'Paste your Anthropic API key',
    color: 'claude',
  },
  {
    id: 'codex',
    name: 'Codex',
    mark: '⌘',
    description: 'OpenAI API access for coding-focused and general assistant tasks.',
    model: 'OpenAI API · GPT-5.5',
    url: 'https://platform.openai.com/api-keys',
    keyLabel: 'OPENAI API KEY',
    placeholder: 'Paste your OpenAI API key',
    color: 'codex',
  },
];

export function AuraOnboarding({
  googleUser,
  isLoggingIn,
  error,
  selectedProvider,
  providerKeys,
  onProviderChange,
  onProviderKeyChange,
  onGoogleLogin,
  onGoogleLogout,
  onContinue,
}: AuraOnboardingProps) {
  const [showKey, setShowKey] = useState(false);
  const provider = PROVIDERS.find((item) => item.id === selectedProvider) || PROVIDERS[0];
  const currentKey = providerKeys[selectedProvider] || '';
  const hasSelectedKey = currentKey.trim().length > 0;
  const canContinue = (selectedProvider === 'gemini' && (!!googleUser || hasSelectedKey)) ||
    (selectedProvider !== 'gemini' && hasSelectedKey);
  const openProviderKeys = () => {
    void invoke('open_item', { target: provider.url }).catch(() => {
      window.open(provider.url, '_blank', 'noopener,noreferrer');
    });
  };

  return (
    <main className="aura-setup-screen">
      <div className="aura-setup-grid" />
      <header className="aura-setup-header">
        <div className="aura-setup-brand">
          <div className="aura-setup-emblem">L<span>/</span></div>
          <div>
            <div className="aura-setup-brand-title">LUMIN<span>ESS</span></div>
            <div className="aura-setup-brand-sub">AURA PERSONAL INTELLIGENCE</div>
          </div>
        </div>
        <div className="aura-setup-secure"><ShieldCheck size={13} /> LOCAL CONFIGURATION</div>
      </header>

      <section className="aura-setup-content">
        <div className="aura-setup-intro">
          <div className="aura-setup-overline"><Sparkles size={13} /> FIRST-RUN PROTOCOL <span>01 / 03</span></div>
          <h1>Connect your<br /><span>intelligence.</span></h1>
          <p>Link your account, choose an AI engine, and wake up your desktop companion.</p>
          <div className="aura-setup-progress"><i /><i /><i /></div>
          <div className="aura-setup-intro-meta"><TerminalSquare size={12} /> AUTHENTICATION → PROVIDER → COMPANION</div>
        </div>

        <section className="aura-google-card">
          <div className="aura-step-heading">
            <span className="aura-step-number">01</span>
            <div><h2>Google account</h2><p>Connect your account first</p></div>
            <UserRound size={17} />
          </div>

          {googleUser ? (
            <div className="aura-google-connected">
              {googleUser.picture
                ? <img src={googleUser.picture} alt="" referrerPolicy="no-referrer" />
                : <div className="aura-google-avatar">{(googleUser.name || googleUser.email || 'G').charAt(0).toUpperCase()}</div>}
              <div className="aura-google-info">
                <strong>{googleUser.name || 'Google account connected'}</strong>
                <span>{googleUser.email || 'Session active'}</span>
              </div>
              <CheckCircle2 size={18} className="aura-setup-ok" />
              <button className="aura-icon-action" onClick={onGoogleLogout} title="Sign out"><LogOut size={14} /></button>
            </div>
          ) : (
            <div className="aura-google-prompt">
              <div className="aura-google-logo">G</div>
              <div className="aura-google-prompt-copy"><strong>Continue with Google</strong><span>Use your Google session for Gemini access.</span></div>
              <button className="aura-google-button" onClick={onGoogleLogin} disabled={isLoggingIn}>
                {isLoggingIn ? <LoaderCircle size={15} className="aura-spin" /> : <><span>Connect</span><ArrowRight size={14} /></>}
              </button>
            </div>
          )}
        </section>

        <section className="aura-provider-card">
          <div className="aura-step-heading">
            <span className="aura-step-number">02</span>
            <div><h2>Choose your AI engine</h2><p>Switch providers whenever you need</p></div>
            <Zap size={17} />
          </div>

          <div className="aura-provider-tabs" role="tablist" aria-label="AI provider">
            {PROVIDERS.map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={selectedProvider === item.id}
                className={`aura-provider-tab ${item.color} ${selectedProvider === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => onProviderChange(item.id)}
              >
                <span className="aura-provider-mark">{item.mark}</span>
                <span>{item.name}</span>
                {providerKeys[item.id]?.trim() && <CheckCircle2 size={12} className="aura-provider-ready" />}
              </button>
            ))}
          </div>

          <div className={`aura-provider-detail ${provider.color}`}>
            <div className="aura-provider-model-line">
              <span className="aura-provider-model">{provider.model}</span>
              <span className="aura-provider-status"><i /> {hasSelectedKey || (selectedProvider === 'gemini' && googleUser) ? 'CONFIGURED' : 'NEEDS KEY'}</span>
            </div>
            <p>{provider.description}</p>
            <button type="button" className="aura-get-key" onClick={openProviderKeys}>
              <KeyRound size={14} /><span>Get {provider.name} API key</span><ExternalLink size={12} />
            </button>
            <label className="aura-key-label" htmlFor="aura-provider-key">{provider.keyLabel}</label>
            <div className="aura-key-input-wrap">
              <input
                id="aura-provider-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={currentKey}
                onChange={(event) => onProviderKeyChange(selectedProvider, event.target.value)}
                placeholder={provider.placeholder}
                onKeyDown={(event) => { if (event.key === 'Enter' && canContinue) onContinue(); }}
              />
              <button type="button" onClick={() => setShowKey((value) => !value)} title={showKey ? 'Hide key' : 'Show key'}>
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="aura-key-foot"><LockKeyhole size={11} /> Stored in local WebView storage (not encrypted). Use only on a trusted device.</div>
          </div>
        </section>

        {error && <div className="aura-setup-error">{error}</div>}

        <button type="button" className="aura-launch-button" disabled={!canContinue} onClick={onContinue}>
          <span><Sparkles size={15} /> Initialize Luminess</span>
          <ArrowRight size={17} />
        </button>
        {!canContinue && (
          <p className="aura-setup-hint">
            {selectedProvider === 'gemini'
              ? 'Connect Google or enter a Gemini API key to continue.'
              : `Enter a ${provider.name} API key to use this provider.`}
          </p>
        )}
      </section>

      <footer className="aura-setup-footer">
        <span><span className="aura-footer-dot" /> SYSTEM READY</span>
        <span>GOOGLE AUTH · GEMINI · CLAUDE · CODEX</span>
        <span>API KEYS STORED LOCALLY</span>
      </footer>
    </main>
  );
}
