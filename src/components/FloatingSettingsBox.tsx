import { useState, useRef, useEffect } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import './FloatingBoxes.css';
import {
  Settings,
  HardDrive,
  KeyRound,
  Cpu,
  FileJson,
  X,
  Move,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { VisualEmotion } from './Robot.tsx';
import type { AIProvider, GoogleUserSession } from '../lib/gemini.ts';
import {
  STORAGE_TIER_OPTIONS,
  STORAGE_RECOMMENDATION_EXPLANATION,
  type AppConfigJson,
  type FloatingBoxPosition,
  type StorageStatus,
  type StorageTierId,
} from '../lib/memoryAndStorage.ts';
import type { LocalAiHardwareReport, LocalAiServerStatus } from '../lib/opencode.ts';

interface FloatingSettingsBoxProps {
  position: FloatingBoxPosition;
  onChangePosition: (next: FloatingBoxPosition) => void;
  emotion: VisualEmotion;
  config: AppConfigJson;
  storageStatus: StorageStatus | null;
  selectedProvider: AIProvider;
  providerKeys: Record<AIProvider, string>;
  googleUser: GoogleUserSession | null;
  isLoggingIn: boolean;
  hardwareReport: LocalAiHardwareReport | null;
  localServers: LocalAiServerStatus[];
  isScanningLocalAi: boolean;
  onUpdateConfig: (next: AppConfigJson) => Promise<void>;
  onSelectStorageTier: (tier: StorageTierId) => Promise<void>;
  onSaveProviderKeys: (
    keys: { gemini: string; claude: string; codex: string },
    activeProvider: AIProvider
  ) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => void;
  onRefreshLocalAi: () => Promise<void>;
  onClose: () => void;
}

export function FloatingSettingsBox({
  position,
  onChangePosition,
  emotion,
  config,
  storageStatus,
  selectedProvider,
  providerKeys,
  googleUser,
  isLoggingIn,
  hardwareReport,
  localServers,
  isScanningLocalAi,
  onUpdateConfig,
  onSelectStorageTier,
  onSaveProviderKeys,
  onGoogleLogin,
  onGoogleLogout,
  onRefreshLocalAi,
  onClose,
}: FloatingSettingsBoxProps) {
  const [activeTab, setActiveTab] = useState<'storage' | 'keys' | 'localai' | 'configjson'>('storage');
  const [isDragging, setIsDragging] = useState(false);

  // Keys state
  const [geminiKey, setGeminiKey] = useState(providerKeys.gemini || '');
  const [claudeKey, setClaudeKey] = useState(providerKeys.claude || '');
  const [codexKey, setCodexKey] = useState(providerKeys.codex || '');
  const [activeProv, setActiveProv] = useState<AIProvider>(selectedProvider);
  const [showSecrets, setShowSecrets] = useState(false);
  const [keysSavedBanner, setKeysSavedBanner] = useState(false);

  // Local AI state
  const [localRuntime, setLocalRuntime] = useState<AppConfigJson['local_ai_runtime']>(
    config.local_ai_runtime || 'auto'
  );
  const [localEndpoint, setLocalEndpoint] = useState(
    config.local_ai_endpoint || 'http://127.0.0.1:11434'
  );
  const [localModel, setLocalModel] = useState(config.local_ai_model || 'qwen2.5-coder:latest');
  const [localSavedBanner, setLocalSavedBanner] = useState(false);

  // config.json raw editor state
  const [jsonText, setJsonText] = useState(() => JSON.stringify(config, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSavedBanner, setJsonSavedBanner] = useState(false);

  useEffect(() => {
    setGeminiKey(providerKeys.gemini || '');
    setClaudeKey(providerKeys.claude || '');
    setCodexKey(providerKeys.codex || '');
    setActiveProv(selectedProvider);
  }, [providerKeys, selectedProvider]);

  useEffect(() => {
    setLocalRuntime(config.local_ai_runtime || 'auto');
    setLocalEndpoint(config.local_ai_endpoint || 'http://127.0.0.1:11434');
    setLocalModel(config.local_ai_model || 'qwen2.5-coder:latest');
    setJsonText(JSON.stringify(config, null, 2));
  }, [config]);

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
    if (target.closest('button, input, select, textarea, a')) return;
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

  const handleSaveAllKeys = async () => {
    await onSaveProviderKeys(
      {
        gemini: geminiKey.trim(),
        claude: claudeKey.trim(),
        codex: codexKey.trim(),
      },
      activeProv
    );
    setKeysSavedBanner(true);
    setTimeout(() => setKeysSavedBanner(false), 2600);
  };

  const handleSaveLocalAiSettings = async () => {
    const updated: AppConfigJson = {
      ...config,
      local_ai_runtime: localRuntime,
      local_ai_endpoint: localEndpoint.trim() || 'http://127.0.0.1:11434',
      local_ai_model: localModel.trim() || 'qwen2.5-coder:latest',
    };
    await onUpdateConfig(updated);
    setLocalSavedBanner(true);
    setTimeout(() => setLocalSavedBanner(false), 2400);
  };

  const handleSaveRawConfigJson = async () => {
    try {
      const parsed = JSON.parse(jsonText) as AppConfigJson;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Root of config.json must be a JSON object.');
      }
      setJsonError(null);
      await onUpdateConfig(parsed);
      setJsonSavedBanner(true);
      setTimeout(() => setJsonSavedBanner(false), 2400);
    } catch (e: any) {
      setJsonError(e?.message || 'Invalid JSON syntax');
    }
  };

  const formatBytesToHuman = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (mb < 1024) {
      return `${mb.toFixed(2)} MB`;
    }
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const usagePct = storageStatus ? Math.min(100, Math.max(1, storageStatus.usage_percent)) : 2;
  const usageFillClass =
    usagePct > 90 || storageStatus?.disk_critical
      ? 'danger'
      : usagePct > 75 || storageStatus?.disk_warning
        ? 'warn'
        : '';

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
          <Settings size={16} className="text-glow" />
          <span>Storage & Settings (config.json)</span>
          <span className="floating-avoid-pill" title="Moves away automatically if touching Chatbox">
            <Move size={10} />
            <span>Auto-Dodge</span>
          </span>
        </div>
        <div className="chat-actions">
          <button type="button" className="icon-btn" onClick={onClose} title="Close Settings Box">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="floating-box-tabs">
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          <HardDrive size={12} />
          <span>Storage</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          <KeyRound size={12} />
          <span>Keys & Auth</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'localai' ? 'active' : ''}`}
          onClick={() => setActiveTab('localai')}
        >
          <Cpu size={12} />
          <span>Local AI</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'configjson' ? 'active' : ''}`}
          onClick={() => setActiveTab('configjson')}
        >
          <FileJson size={12} />
          <span>config.json</span>
        </button>
      </div>

      <div className="floating-box-body">
        {activeTab === 'storage' && (
          <>
            <div className="storage-meter-wrap">
              <div className="floating-card-row">
                <span className="floating-card-title">Database & Disk Allocation</span>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
                  {(config.storage_tier || 'recommended').toUpperCase()}
                </span>
              </div>
              <div className="storage-meter-bar">
                <div
                  className={`storage-meter-fill ${usageFillClass}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <div className="floating-card-row" style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                <span>
                  Used: {storageStatus ? formatBytesToHuman(storageStatus.used_bytes) : '0 KB'}
                </span>
                <span>
                  Effective Cap:{' '}
                  {storageStatus
                    ? formatBytesToHuman(storageStatus.effective_limit_bytes)
                    : `${config.storage_limit_bytes ? formatBytesToHuman(config.storage_limit_bytes) : 'Unlimited'}`}
                </span>
              </div>
              {storageStatus && (
                <div className="floating-card-sub" style={{ fontSize: '10.5px' }}>
                  Physical Free Disk Space:{' '}
                  <strong>{formatBytesToHuman(storageStatus.disk_free_bytes)}</strong> /{' '}
                  {formatBytesToHuman(storageStatus.disk_total_bytes)}
                </div>
              )}
              {storageStatus?.warning_message && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#fcd34d',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    marginTop: '2px',
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>{storageStatus.warning_message}</span>
                </div>
              )}
            </div>

            <div
              className="floating-card-item"
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
              }}
            >
              <div className="floating-card-row">
                <span className="floating-card-title" style={{ color: '#34d399' }}>
                  💡 Why 5 GB (Recommended) is Best to Pick
                </span>
              </div>
              <div className="floating-card-sub" style={{ color: '#e2e8f0' }}>
                {STORAGE_RECOMMENDATION_EXPLANATION}
              </div>
            </div>

            {STORAGE_TIER_OPTIONS.map((option) => {
              const isSelected = config.storage_tier === option.id;
              return (
                <div
                  key={option.id}
                  className={`storage-tier-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => void onSelectStorageTier(option.id)}
                >
                  <div className="floating-card-row">
                    <span className="floating-card-title">
                      {option.label} — {option.allocationLabel}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {option.recommended && <span className="storage-rec-badge">RECOMMENDED</span>}
                      {isSelected && <Check size={14} className="text-glow" />}
                    </div>
                  </div>
                  <div className="floating-card-sub">{option.description}</div>
                </div>
              );
            })}
          </>
        )}

        {activeTab === 'keys' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Google Account & Memory Sync</span>
                {googleUser ? (
                  <span style={{ fontSize: '10.5px', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} /> Connected
                  </span>
                ) : (
                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Not signed in</span>
                )}
              </div>

              {googleUser ? (
                <>
                  <div className="floating-card-sub" style={{ color: '#f8fafc', fontWeight: 600 }}>
                    {googleUser.name} ({googleUser.email})
                  </div>
                  <div className="floating-card-sub">
                    Your conversational memories and preferences are automatically associated with this Google account.
                  </div>
                  <div className="floating-card-row" style={{ marginTop: '4px' }}>
                    <button
                      type="button"
                      className="floating-btn-secondary"
                      onClick={() => void onGoogleLogin()}
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
                      <span>Switch Google Account</span>
                    </button>
                    <button
                      type="button"
                      className="floating-btn-secondary danger"
                      onClick={onGoogleLogout}
                    >
                      <LogOut size={12} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="floating-card-sub">
                    Sign in with Google to synchronize your personal memory profile and unlock Google OAuth Gemini access.
                  </div>
                  <button
                    type="button"
                    className="floating-btn-primary"
                    onClick={() => void onGoogleLogin()}
                    disabled={isLoggingIn}
                    style={{ marginTop: '4px' }}
                  >
                    {isLoggingIn ? (
                      <span>Waiting for browser sign-in...</span>
                    ) : (
                      <span>Sign In with Google Account</span>
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} className="text-glow" />
                  <span>Machine Credential Vault (All 3 Providers)</span>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowSecrets((v) => !v)}
                  title={showSecrets ? 'Hide API Keys' : 'Show API Keys'}
                >
                  {showSecrets ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <div className="floating-card-sub">
                Encrypted on this PC using Windows DPAPI (`credentials.dpapi`). Separate from your Google profile and never stored in plaintext.
              </div>

              <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginTop: '4px' }}>
                Active AI Provider
              </label>
              <select
                className="floating-input"
                value={activeProv}
                onChange={(e) => setActiveProv(e.target.value as AIProvider)}
              >
                <option value="gemini">Google Gemini (API Key or Google OAuth)</option>
                <option value="claude">Anthropic Claude (Sonnet 4 / 3.5)</option>
                <option value="codex">OpenAI Codex / GPT-4o</option>
                <option value="offline">Local AI (Ollama / llama.cpp / OpenCode / Built-in)</option>
              </select>

              <label style={{ fontSize: '11px', fontWeight: 600, color: '#93c5fd', marginTop: '4px' }}>
                1. Gemini API Key (Google AI Studio)
              </label>
              <input
                type={showSecrets ? 'text' : 'password'}
                className="floating-input"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />

              <label style={{ fontSize: '11px', fontWeight: 600, color: '#fdba74', marginTop: '4px' }}>
                2. Claude API Key (Anthropic Console)
              </label>
              <input
                type={showSecrets ? 'text' : 'password'}
                className="floating-input"
                placeholder="sk-ant-..."
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
              />

              <label style={{ fontSize: '11px', fontWeight: 600, color: '#86efac', marginTop: '4px' }}>
                3. OpenAI / Codex API Key
              </label>
              <input
                type={showSecrets ? 'text' : 'password'}
                className="floating-input"
                placeholder="sk-..."
                value={codexKey}
                onChange={(e) => setCodexKey(e.target.value)}
              />

              <button
                type="button"
                className="floating-btn-primary"
                style={{ marginTop: '6px' }}
                onClick={() => void handleSaveAllKeys()}
              >
                {keysSavedBanner ? (
                  <>
                    <Check size={14} />
                    <span>Saved to Windows DPAPI Machine Vault!</span>
                  </>
                ) : (
                  <span>Save All 3 Keys to Machine Vault</span>
                )}
              </button>
            </div>
          </>
        )}

        {activeTab === 'localai' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Hardware Compatibility Check</span>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => void onRefreshLocalAi()}
                  disabled={isScanningLocalAi}
                  style={{ padding: '4px 8px' }}
                >
                  <RefreshCw size={11} className={isScanningLocalAi ? 'spin' : ''} />
                  <span>Scan</span>
                </button>
              </div>
              {hardwareReport ? (
                <>
                  <div className="floating-card-sub" style={{ color: '#e2e8f0' }}>
                    • RAM: <strong>{hardwareReport.total_ram_gb.toFixed(1)} GB</strong> total (
                    {hardwareReport.available_ram_gb.toFixed(1)} GB available)
                    <br />• CPU: <strong>{hardwareReport.cpu_cores} logical cores</strong> ({hardwareReport.gpu_name})
                    <br />• Recommended Model: <strong>{hardwareReport.recommended_model}</strong>
                  </div>
                  <div className="floating-card-sub" style={{ color: '#34d399' }}>
                    {hardwareReport.compatibility_notes}
                  </div>
                </>
              ) : (
                <div className="floating-card-sub">Scanning system hardware...</div>
              )}
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Detected Local Model Servers</span>
              </div>
              {localServers.map((srv) => (
                <div
                  key={srv.name}
                  className="floating-card-row"
                  style={{
                    padding: '5px 8px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f8fafc' }}>
                      {srv.name} ({srv.endpoint})
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {srv.online
                        ? srv.models.length > 0
                          ? `Models: ${srv.models.slice(0, 3).join(', ')}`
                          : 'Server Online (OpenAI-compatible)'
                        : srv.notes}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: srv.online ? 'rgba(16,185,129,0.18)' : 'rgba(148,163,184,0.14)',
                      color: srv.online ? '#34d399' : '#94a3b8',
                    }}
                  >
                    {srv.online ? 'ONLINE' : 'STANDBY'}
                  </span>
                </div>
              ))}
            </div>

            <div className="floating-card-item">
              <div className="floating-card-title">Local AI Runtime Configuration</div>

              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                Preferred Runtime Engine
              </label>
              <select
                className="floating-input"
                value={localRuntime}
                onChange={(e) => setLocalRuntime(e.target.value as AppConfigJson['local_ai_runtime'])}
              >
                <option value="auto">Auto-Detect (Ollama → llama.cpp → OpenCode → Built-in)</option>
                <option value="ollama">Ollama Local Server (127.0.0.1:11434)</option>
                <option value="openai_compatible">llama.cpp / LM Studio Server (OpenAI-Compatible)</option>
                <option value="opencode">OpenCode Local Agent CLI</option>
                <option value="builtin">Built-in Instant Conversational Local AI</option>
              </select>

              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                Local Server Endpoint URL
              </label>
              <input
                type="text"
                className="floating-input"
                value={localEndpoint}
                onChange={(e) => setLocalEndpoint(e.target.value)}
                placeholder="http://127.0.0.1:11434"
              />

              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                Preferred Model Name
              </label>
              <input
                type="text"
                className="floating-input"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                placeholder="qwen2.5-coder:latest"
              />

              <button
                type="button"
                className="floating-btn-primary"
                style={{ marginTop: '6px' }}
                onClick={() => void handleSaveLocalAiSettings()}
              >
                {localSavedBanner ? 'Saved Local AI Config!' : 'Save Local AI Settings'}
              </button>
            </div>
          </>
        )}

        {activeTab === 'configjson' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Live Machine config.json Editor</span>
                <span style={{ fontSize: '10px', color: '#38bdf8' }}>
                  %LOCALAPPDATA%\LuminessAssist\config.json
                </span>
              </div>
              <div className="floating-card-sub">
                Edit storage limits, local AI runtime settings, search archival, and floating box coordinates directly in JSON.
              </div>
              <textarea
                className="config-json-editor"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                spellCheck={false}
              />
              {jsonError && (
                <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px' }}>
                  ⚠️ {jsonError}
                </div>
              )}
              <div className="floating-card-row" style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => {
                    setJsonText(JSON.stringify(config, null, 2));
                    setJsonError(null);
                  }}
                >
                  Reset Changes
                </button>
                <button
                  type="button"
                  className="floating-btn-primary"
                  onClick={() => void handleSaveRawConfigJson()}
                >
                  {jsonSavedBanner ? 'Saved config.json!' : 'Save config.json to Disk'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="floating-box-footer">
        <span>Vault: Windows DPAPI Encrypted</span>
        <span>Draggable • Auto-Avoids Chatbox</span>
      </div>
    </div>
  );
}
