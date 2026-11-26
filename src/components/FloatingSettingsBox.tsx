import { useState, useRef } from 'react';
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
  Palette,
  Flame,
  GitFork,
  Heart,
  Star,
  Plug,
  Sparkles,
  Download,
  Copy,
  Wand2,
  Droplets,
  Disc3,
  Activity,
  Brain,
  Lock,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  clampDrinkGoal,
  clampDrinkIntervalMinutes,
  clampDrinkSnoozeMinutes,
  normalizeDrinkReminderConfig,
  playGentleWaterChime,
} from '../lib/drinkReminder.ts';
import type { VisualEmotion } from './Robot.tsx';
import type { AIProvider, GoogleUserSession } from '../lib/gemini.ts';
import type { NormalizedAIError } from '../lib/aiErrors.ts';
import {
  STORAGE_TIER_OPTIONS,
  STORAGE_RECOMMENDATION_EXPLANATION,
  type AppConfigJson,
  type FloatingBoxPosition,
  type StorageStatus,
  type StorageTierId,
  type UserMemoryItem,
} from '../lib/memoryAndStorage.ts';
import {
  COLOR_PALETTE_PRESETS,
  buildAiForkCustomizePrompt,
  createDefaultBotCustomization,
  fetchBotProfileFromPlatform,
  fetchForkManifestFromGitHub,
  type AgentPresetDefinition,
  type BotAccessoryId,
  type BotChassisModel,
  type BotCustomizationManifest,
  type BotVisualMode,
  type CustomApiFormat,
} from '../lib/botCustomization.ts';
import type { LocalAiHardwareReport, LocalAiServerStatus } from '../lib/opencode.ts';

export type SettingsTabId = 'connectors' | 'look' | 'anger' | 'fork' | 'storage';

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
  isVerifying: boolean;
  connectionError: NormalizedAIError | null;
  verifiedBanner: string | null;
  hardwareReport: LocalAiHardwareReport | null;
  localServers: LocalAiServerStatus[];
  isScanningLocalAi: boolean;
  robotSize: number;
  initialTab?: SettingsTabId;
  externalTabSeq?: number;
  onUpdateConfig: (next: AppConfigJson) => Promise<void>;
  onSelectStorageTier: (tier: StorageTierId) => Promise<void>;
  onSaveProviderKeys: (
    keys: { gemini: string; claude: string; codex: string; custom?: string },
    activeProvider: AIProvider
  ) => Promise<void>;
  onVerifyConnection: (provider?: AIProvider, keyOverride?: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => void;
  onRefreshLocalAi: () => Promise<void>;
  onResizeRobot: (nextSize: number) => void;
  onTriggerBotAnger: (amount: number, reason?: string, calm?: boolean) => void;
  onOpenExternalUrl: (url: string) => void;
  onOpenSetupWizard?: () => void;
  onRunAiForkCustomize?: (prompt: string) => void;
  drinkCountdownLabel?: string;
  onOpenMusicPlayer?: () => void;
  onOpenWellbeingBox?: () => void;
  onTriggerDrinkAlert?: () => void;
  onLogDrink?: () => void;
  memories: UserMemoryItem[];
  onAddMemory: (category: UserMemoryItem['category'], key: string, value: string) => void;
  onDeleteMemory: (memoryId: string) => void;
  onClearMemories: () => void;
  onToggleWindowsStartup?: (enabled: boolean) => Promise<void>;
  onClose: () => void;
}

const ACCESSORIES: Array<{ id: BotAccessoryId; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'cat_ears', label: 'Cat Ears' },
  { id: 'wizard_hat', label: 'Wizard Hat' },
  { id: 'visor', label: 'Neon Visor' },
  { id: 'halo', label: 'Halo' },
  { id: 'crown', label: 'Crown' },
];

const CHASSIS_MODELS: Array<{ id: BotChassisModel; label: string }> = [
  { id: 'classic', label: 'Classic' },
  { id: 'visor', label: 'Visor' },
  { id: 'orb', label: 'Orb' },
  { id: 'retro', label: 'Retro CRT' },
];

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
  isVerifying,
  connectionError,
  verifiedBanner,
  hardwareReport,
  localServers,
  isScanningLocalAi,
  robotSize,
  initialTab = 'connectors',
  externalTabSeq = 0,
  onUpdateConfig,
  onSelectStorageTier,
  onSaveProviderKeys,
  onVerifyConnection,
  onGoogleLogin,
  onGoogleLogout,
  onRefreshLocalAi,
  onResizeRobot,
  onTriggerBotAnger,
  onOpenExternalUrl,
  onOpenSetupWizard,
  onRunAiForkCustomize,
  drinkCountdownLabel,
  onOpenMusicPlayer,
  onOpenWellbeingBox,
  onTriggerDrinkAlert,
  onLogDrink,
  memories,
  onAddMemory,
  onDeleteMemory,
  onClearMemories,
  onToggleWindowsStartup,
  onClose,
}: FloatingSettingsBoxProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [prevExtSeq, setPrevExtSeq] = useState(externalTabSeq);
  if (externalTabSeq !== prevExtSeq) {
    setPrevExtSeq(externalTabSeq);
    setActiveTab(initialTab);
  }

  const [isDragging, setIsDragging] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  // Provider & No-Preset Custom API draft fields initialized cleanly and kept in sync when signature changes
  const propsKeySig = `${selectedProvider}|${providerKeys.gemini || ''}|${providerKeys.claude || ''}|${providerKeys.codex || ''}|${providerKeys.custom || ''}|${config.updated_at}`;
  const [prevSig, setPrevSig] = useState(propsKeySig);

  const [activeProv, setActiveProv] = useState<AIProvider>(selectedProvider);
  const [geminiKey, setGeminiKey] = useState(providerKeys.gemini || '');
  const [claudeKey, setClaudeKey] = useState(providerKeys.claude || '');
  const [codexKey, setCodexKey] = useState(providerKeys.codex || '');
  const [customKey, setCustomKey] = useState(providerKeys.custom || '');
  const [customBaseUrl, setCustomBaseUrl] = useState(config.custom_api_endpoint || '');
  const [customFormat, setCustomFormat] = useState<CustomApiFormat>(
    config.custom_api_format || 'openai-chat'
  );
  const [customModel, setCustomModel] = useState(config.custom_api_model || '');
  const [customHeaders, setCustomHeaders] = useState(config.custom_api_headers || '');
  const [geminiModel, setGeminiModel] = useState(config.gemini_model || 'gemini-2.5-flash');
  const [claudeModel, setClaudeModel] = useState(config.claude_model || 'claude-sonnet-4-20250514');
  const [codexModel, setCodexModel] = useState(config.codex_model || 'gpt-4o');
  const [activePresetId, setActivePresetId] = useState(config.active_agent_preset || 'direct-custom');
  const [localRuntime, setLocalRuntime] = useState<AppConfigJson['local_ai_runtime']>(
    config.local_ai_runtime || 'auto'
  );
  const [localEndpoint, setLocalEndpoint] = useState(
    config.local_ai_endpoint || 'http://127.0.0.1:11434'
  );
  const [localModel, setLocalModel] = useState(config.local_ai_model || 'qwen2.5-coder:latest');
  const [customCliCmd, setCustomCliCmd] = useState(config.agent_cli_command || 'opencode');
  const [jsonText, setJsonText] = useState(() => JSON.stringify(config, null, 2));

  if (propsKeySig !== prevSig) {
    setPrevSig(propsKeySig);
    setActiveProv(selectedProvider);
    setGeminiKey(providerKeys.gemini || '');
    setClaudeKey(providerKeys.claude || '');
    setCodexKey(providerKeys.codex || '');
    setCustomKey(providerKeys.custom || '');
    setCustomBaseUrl(config.custom_api_endpoint || '');
    setCustomFormat(config.custom_api_format || 'openai-chat');
    setCustomModel(config.custom_api_model || '');
    setCustomHeaders(config.custom_api_headers || '');
    setGeminiModel(config.gemini_model || 'gemini-2.5-flash');
    setClaudeModel(config.claude_model || 'claude-sonnet-4-20250514');
    setCodexModel(config.codex_model || 'gpt-4o');
    setActivePresetId(config.active_agent_preset || 'direct-custom');
    setLocalRuntime(config.local_ai_runtime || 'auto');
    setLocalEndpoint(config.local_ai_endpoint || 'http://127.0.0.1:11434');
    setLocalModel(config.local_ai_model || 'qwen2.5-coder:latest');
    setCustomCliCmd(config.agent_cli_command || 'opencode');
    setJsonText(JSON.stringify(config, null, 2));
  }

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [newMemKey, setNewMemKey] = useState('');
  const [newMemValue, setNewMemValue] = useState('');
  const [newMemCategory, setNewMemCategory] = useState<UserMemoryItem['category']>('fact');

  // Fork Sync & Platform Pairing state
  const botCustom: BotCustomizationManifest =
    config.bot_customization || createDefaultBotCustomization();
  const [forkRepoInput, setForkRepoInput] = useState(botCustom.repo || 'jasonhukom/Luminess-Assist');
  const [forkBranchInput, setForkBranchInput] = useState(botCustom.branch || 'main');
  const [platformUrlInput, setPlatformUrlInput] = useState(
    botCustom.platformBaseUrl || 'http://127.0.0.1:8000'
  );
  const [pairingCodeInput, setPairingCodeInput] = useState(botCustom.platformPairingCode || '');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const flashNotice = (msg: string) => {
    setSavedNotice(msg);
    window.setTimeout(() => setSavedNotice(null), 2600);
  };

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

  const updateBotCustomization = async (
    updater: (prev: BotCustomizationManifest) => BotCustomizationManifest
  ) => {
    const nextManifest = updater(botCustom);
    await onUpdateConfig({
      ...config,
      bot_customization: nextManifest,
    });
  };

  const applyPresetSelection = async (preset: AgentPresetDefinition) => {
    setActivePresetId(preset.id);
    if (preset.provider === 'offline') {
      setActiveProv('offline');
      const nextRuntime: AppConfigJson['local_ai_runtime'] =
        preset.id === 'kilocode'
          ? 'kilocode'
          : preset.id === 'opencode'
            ? 'opencode'
            : preset.id === 'ollama'
              ? 'ollama'
              : 'auto';
      setLocalRuntime(nextRuntime);
      if (preset.baseUrl) setLocalEndpoint(preset.baseUrl);
      if (preset.model) setLocalModel(preset.model);
      if (preset.cliCommand) setCustomCliCmd(preset.cliCommand);

      await onSaveProviderKeys(
        {
          gemini: geminiKey.trim(),
          claude: claudeKey.trim(),
          codex: codexKey.trim(),
          custom: customKey.trim(),
        },
        'offline'
      );
      await onUpdateConfig({
        ...config,
        selected_provider: 'offline',
        active_agent_preset: preset.id,
        local_ai_runtime: nextRuntime,
        local_ai_endpoint: preset.baseUrl || localEndpoint,
        local_ai_model: preset.model || localModel,
        agent_cli_command: preset.cliCommand || customCliCmd,
        bot_customization: {
          ...botCustom,
          apiConfig: {
            ...botCustom.apiConfig,
            activePresetId: preset.id,
          },
        },
      });
      flashNotice(`Switched to ${preset.name}`);
      return;
    }

    const nextProv: AIProvider =
      preset.provider === 'gemini' || preset.provider === 'claude' || preset.provider === 'codex'
        ? preset.provider
        : 'custom';
    setActiveProv(nextProv);
    setCustomFormat(preset.apiFormat);
    setCustomBaseUrl(nextProv === 'custom' ? preset.baseUrl : '');
    if (nextProv === 'custom') setCustomModel(preset.model);
    if (nextProv === 'gemini' && preset.model) setGeminiModel(preset.model);
    if (nextProv === 'claude' && preset.model) setClaudeModel(preset.model);
    if (nextProv === 'codex' && preset.model) setCodexModel(preset.model);

    await onUpdateConfig({
      ...config,
      selected_provider: nextProv,
      active_agent_preset: preset.id,
      gemini_model: nextProv === 'gemini' && preset.model ? preset.model : geminiModel,
      claude_model: nextProv === 'claude' && preset.model ? preset.model : claudeModel,
      codex_model: nextProv === 'codex' && preset.model ? preset.model : codexModel,
      custom_api_endpoint: nextProv === 'custom' ? preset.baseUrl : '',
      custom_api_format: preset.apiFormat,
      custom_api_model: nextProv === 'custom' ? preset.model : customModel,
      bot_customization: {
        ...botCustom,
        apiConfig: {
          ...botCustom.apiConfig,
          activePresetId: preset.id,
          customBaseUrl: nextProv === 'custom' ? preset.baseUrl : '',
          customApiFormat: preset.apiFormat,
          customModel: nextProv === 'custom' ? preset.model : customModel,
        },
      },
    });
    await onSaveProviderKeys(
      {
        gemini: geminiKey.trim(),
        claude: claudeKey.trim(),
        codex: codexKey.trim(),
        custom: customKey.trim(),
      },
      nextProv
    );
    flashNotice(`Loaded ${preset.name}`);
  };

  const handleSaveAndTestConnector = async (verifyAfterSave: boolean) => {
    const cleanKeys = {
      gemini: geminiKey.trim(),
      claude: claudeKey.trim(),
      codex: codexKey.trim(),
      custom: customKey.trim(),
    };
    await onUpdateConfig({
      ...config,
      selected_provider: activeProv,
      gemini_model: geminiModel.trim() || 'gemini-2.5-flash',
      claude_model: claudeModel.trim() || 'claude-sonnet-4-20250514',
      codex_model: codexModel.trim() || 'gpt-4o',
      custom_api_endpoint: customBaseUrl.trim(),
      custom_api_format: customFormat,
      custom_api_model: customModel.trim(),
      custom_api_headers: customHeaders.trim(),
      active_agent_preset: activePresetId,
      agent_cli_command: customCliCmd.trim() || 'opencode',
      local_ai_runtime: localRuntime,
      local_ai_endpoint: localEndpoint.trim() || 'http://127.0.0.1:11434',
      local_ai_model: localModel.trim() || 'qwen2.5-coder:latest',
      bot_customization: {
        ...botCustom,
        apiConfig: {
          ...botCustom.apiConfig,
          activePresetId,
          requirePreset: false,
          customBaseUrl: customBaseUrl.trim(),
          customApiFormat: customFormat,
          customModel: customModel.trim(),
          customHeadersJson: customHeaders.trim(),
        },
      },
    });
    await onSaveProviderKeys(cleanKeys, activeProv);
    if (verifyAfterSave) {
      const keyForProv =
        activeProv === 'gemini'
          ? cleanKeys.gemini
          : activeProv === 'claude'
            ? cleanKeys.claude
            : activeProv === 'codex'
              ? cleanKeys.codex
              : activeProv === 'custom'
                ? cleanKeys.custom
                : '';
      await onVerifyConnection(activeProv, keyForProv);
    } else {
      flashNotice('Connector & Machine Vault Saved!');
    }
  };

  const handleSyncGitHubFork = async () => {
    setSyncBusy(true);
    setSyncFeedback(null);
    const res = await fetchForkManifestFromGitHub(
      forkRepoInput,
      forkBranchInput,
      botCustom
    );
    setSyncBusy(false);
    if (res.ok && res.manifest) {
      setForkRepoInput(res.slug);
      setForkBranchInput(res.branch);
      await onUpdateConfig({
        ...config,
        bot_customization: res.manifest,
      });
      setSyncFeedback({
        ok: true,
        msg: `Synced "${res.manifest.botName}" live from ${res.slug} (${res.branch})!`,
      });
    } else {
      setSyncFeedback({
        ok: false,
        msg: res.error || 'Failed to load luminess.bot.json from GitHub fork.',
      });
    }
  };

  const handleConnectPlatformCode = async () => {
    setSyncBusy(true);
    setSyncFeedback(null);
    const res = await fetchBotProfileFromPlatform(
      platformUrlInput,
      pairingCodeInput,
      botCustom
    );
    setSyncBusy(false);
    if (res.ok && res.manifest) {
      setForkRepoInput(res.manifest.repo);
      await onUpdateConfig({
        ...config,
        bot_customization: res.manifest,
      });
      setSyncFeedback({
        ok: true,
        msg: `Connected Platform bot "${res.manifest.botName}" (${pairingCodeInput.toUpperCase()})!`,
      });
    } else {
      setSyncFeedback({
        ok: false,
        msg: res.error || 'Could not pair with Luminess Platform.',
      });
    }
  };

  const handleSaveRawConfigJson = async () => {
    try {
      const parsed = JSON.parse(jsonText) as AppConfigJson;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Root of config.json must be a JSON object.');
      }
      setJsonError(null);
      await onUpdateConfig(parsed);
      flashNotice('Saved config.json to Disk!');
    } catch (e: any) {
      setJsonError(e?.message || 'Invalid JSON syntax');
    }
  };

  const formatBytesToHuman = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const usagePct = storageStatus ? Math.min(100, Math.max(1, storageStatus.usage_percent)) : 2;
  const usageFillClass =
    usagePct > 90 || storageStatus?.disk_critical
      ? 'danger'
      : usagePct > 75 || storageStatus?.disk_warning
        ? 'warn'
        : '';

  const activeKeyForProv =
    activeProv === 'gemini'
      ? geminiKey
      : activeProv === 'claude'
        ? claudeKey
        : activeProv === 'codex'
          ? codexKey
          : activeProv === 'custom'
            ? customKey
            : '';

  const setKeyForProv = (val: string) => {
    if (activeProv === 'gemini') setGeminiKey(val);
    else if (activeProv === 'claude') setClaudeKey(val);
    else if (activeProv === 'codex') setCodexKey(val);
    else if (activeProv === 'custom') setCustomKey(val);
  };

  const aiCustomizePrompt = buildAiForkCustomizePrompt(botCustom);

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
          <span>{botCustom.botName || 'Luminess'} • Settings & Connectors</span>
          <span className="floating-avoid-pill" title="Moves away automatically if touching Chatbox">
            <Move size={10} />
            <span>Auto-Dodge</span>
          </span>
        </div>
        <div className="chat-actions">
          <button type="button" className="icon-btn" onClick={onClose} title="Close Settings">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Live Connection Strip Tying Directly to Desktop Mascot */}
      <div className="floating-bot-live-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
          <span className="floating-bot-dot" />
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Live Bot: {botCustom.botName || 'Luminess'} [{emotion}]
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ color: '#94a3b8', fontSize: '10px' }}>
            {activeProv.toUpperCase()} • {botCustom.repo}
          </span>
        </div>
      </div>

      {/* Unified Tabs */}
      <div className="floating-box-tabs">
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'connectors' ? 'active' : ''}`}
          onClick={() => setActiveTab('connectors')}
        >
          <Plug size={12} />
          <span>Connectors</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'look' ? 'active' : ''}`}
          onClick={() => setActiveTab('look')}
        >
          <Palette size={12} />
          <span>Look</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'anger' ? 'active' : ''}`}
          onClick={() => setActiveTab('anger')}
        >
          <Flame size={12} />
          <span>Mad & Mind</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'fork' ? 'active' : ''}`}
          onClick={() => setActiveTab('fork')}
        >
          <GitFork size={12} />
          <span>Fork</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          <HardDrive size={12} />
          <span>Data</span>
        </button>
      </div>

      <div className="floating-box-body">
        {savedNotice && (
          <div
            className="floating-card-item"
            style={{
              background: 'rgba(16, 185, 129, 0.14)',
              borderColor: 'rgba(52, 211, 153, 0.5)',
              color: '#6ee7b7',
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '7px 10px',
            }}
          >
            ✅ {savedNotice}
          </div>
        )}

        {/* TAB 1: UNIFIED CONNECTORS, NO-PRESET CUSTOM API & LOCAL AGENTS */}
        {activeTab === 'connectors' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Agent Presets & API Mode</span>
                <span style={{ fontSize: '10px', color: '#7dd3fc' }}>No Preset Lock-In</span>
              </div>
              <div className="floating-pill-grid" style={{ marginTop: '4px' }}>
                {botCustom.agentPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`floating-chip ${activePresetId === preset.id ? 'active' : ''}`}
                    onClick={() => void applyPresetSelection(preset)}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">API Provider / Direct Custom Connection</span>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  style={{ padding: '3px 7px', fontSize: '10px' }}
                  onClick={() => setShowSecrets((s) => !s)}
                >
                  {showSecrets ? <EyeOff size={11} /> : <Eye size={11} />}
                  <span>{showSecrets ? 'Hide Keys' : 'Show Keys'}</span>
                </button>
              </div>

              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                Routing Engine:
                <select
                  className="floating-input"
                  style={{ marginTop: '4px' }}
                  value={activeProv}
                  onChange={(e) => setActiveProv(e.target.value as AIProvider)}
                >
                  <option value="custom">Custom / Any OpenAI, Anthropic or Gemini API (No Preset)</option>
                  <option value="gemini">Google Gemini (API Key or OAuth)</option>
                  <option value="claude">Anthropic Claude (Messages API)</option>
                  <option value="codex">OpenAI / Codex (Chat & Reasoning Models)</option>
                  <option value="offline">Local Agents (OpenCode / KiloCode / Ollama / Built-in)</option>
                </select>
              </label>

              {activeProv !== 'offline' && (
                <>
                  {activeProv === 'custom' && (
                    <>
                      <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px' }}>
                        API Format:
                        <select
                          className="floating-input"
                          style={{ marginTop: '3px' }}
                          value={customFormat}
                          onChange={(e) => setCustomFormat(e.target.value as CustomApiFormat)}
                        >
                          <option value="openai-chat">OpenAI Chat Completions (/chat/completions)</option>
                          <option value="openai-responses">OpenAI Responses (/responses)</option>
                          <option value="anthropic">Anthropic Messages (/messages)</option>
                          <option value="gemini">Google Gemini REST (:generateContent)</option>
                        </select>
                      </label>
                      <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '5px' }}>
                        Base URL / Endpoint (any gateway, OpenRouter, Groq, DeepSeek, proxy):
                        <input
                          type="text"
                          className="floating-input"
                          style={{ marginTop: '3px' }}
                          placeholder="https://api.openai.com/v1 or http://127.0.0.1:4000/v1"
                          value={customBaseUrl}
                          onChange={(e) => setCustomBaseUrl(e.target.value)}
                        />
                      </label>
                    </>
                  )}

                  <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '5px' }}>
                    Model Name (freeform — type any model ID):
                    <input
                      type="text"
                      className="floating-input"
                      style={{ marginTop: '3px' }}
                      placeholder={
                        activeProv === 'gemini'
                          ? 'gemini-2.5-flash'
                          : activeProv === 'claude'
                            ? 'claude-sonnet-4-20250514'
                            : activeProv === 'codex'
                              ? 'gpt-4o or o3-mini'
                              : 'e.g. deepseek-chat, anthropic/claude-sonnet-4, qwen3'
                      }
                      value={
                        activeProv === 'gemini'
                          ? geminiModel
                          : activeProv === 'claude'
                            ? claudeModel
                            : activeProv === 'codex'
                              ? codexModel
                              : customModel
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (activeProv === 'gemini') setGeminiModel(val);
                        else if (activeProv === 'claude') setClaudeModel(val);
                        else if (activeProv === 'codex') setCodexModel(val);
                        else setCustomModel(val);
                      }}
                    />
                  </label>

                  <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '5px' }}>
                    API Key (stored encrypted in Windows DPAPI vault):
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      className="floating-input"
                      style={{ marginTop: '3px' }}
                      placeholder={
                        activeProv === 'custom'
                          ? 'Any bearer/API key (optional for unauthenticated proxies)'
                          : 'Paste your API key...'
                      }
                      value={activeKeyForProv}
                      onChange={(e) => setKeyForProv(e.target.value)}
                    />
                  </label>

                  {activeProv === 'custom' && (
                    <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '5px' }}>
                      Optional Extra Headers JSON:
                      <input
                        type="text"
                        className="floating-input"
                        style={{ marginTop: '3px' }}
                        placeholder='{"HTTP-Referer":"https://luminess.app"}'
                        value={customHeaders}
                        onChange={(e) => setCustomHeaders(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}

              {connectionError && (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '7px 9px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(248, 113, 113, 0.4)',
                    fontSize: '11px',
                    color: '#fecaca',
                  }}
                >
                  <strong>{connectionError.title}:</strong> {connectionError.message}
                </div>
              )}

              {verifiedBanner && !connectionError && (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '7px 9px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.14)',
                    border: '1px solid rgba(52, 211, 153, 0.45)',
                    fontSize: '11px',
                    color: '#6ee7b7',
                  }}
                >
                  ✅ {verifiedBanner}
                </div>
              )}

              <div className="floating-card-row" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => void handleSaveAndTestConnector(false)}
                >
                  <Check size={12} />
                  <span>Save Only</span>
                </button>
                <button
                  type="button"
                  className="floating-btn-primary"
                  style={{ flex: 1 }}
                  disabled={isVerifying}
                  onClick={() => void handleSaveAndTestConnector(true)}
                >
                  {isVerifying ? <Loader2 size={13} className="spin" /> : <KeyRound size={13} />}
                  <span>{isVerifying ? 'Verifying API...' : 'Save & Test Connection'}</span>
                </button>
              </div>
            </div>

            {/* Local Agents: OpenCode, KiloCode & Ollama */}
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">
                  <Cpu size={13} style={{ display: 'inline', marginRight: '5px' }} />
                  Local Agents & Servers (OpenCode / KiloCode / Ollama)
                </span>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '10.5px' }}
                  onClick={() => void onRefreshLocalAi()}
                  disabled={isScanningLocalAi}
                >
                  <RefreshCw size={11} className={isScanningLocalAi ? 'spin' : ''} />
                  <span>Scan</span>
                </button>
              </div>

              {hardwareReport && (
                <div className="floating-card-sub">
                  {hardwareReport.hardware_tier} • {hardwareReport.gpu_name}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {localServers.map((srv) => (
                  <div
                    key={srv.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.28)',
                      border: `1px solid ${srv.online ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{srv.name}</span>
                    <span style={{ color: srv.online ? '#34d399' : '#94a3b8', fontSize: '10px' }}>
                      {srv.online ? '● READY' : '○ Offline'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="floating-color-grid" style={{ marginTop: '6px' }}>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Local Runtime:
                  <select
                    className="floating-input"
                    style={{ marginTop: '3px' }}
                    value={localRuntime}
                    onChange={(e) =>
                      setLocalRuntime(e.target.value as AppConfigJson['local_ai_runtime'])
                    }
                  >
                    <option value="auto">Auto (OpenCode / KiloCode / Ollama)</option>
                    <option value="opencode">OpenCode CLI</option>
                    <option value="kilocode">KiloCode CLI</option>
                    <option value="ollama">Ollama Server</option>
                    <option value="openai_compatible">Local OpenAI Server</option>
                    <option value="builtin">Built-in Engine</option>
                  </select>
                </label>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Custom CLI Binary:
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '3px' }}
                    value={customCliCmd}
                    onChange={(e) => setCustomCliCmd(e.target.value)}
                    placeholder="opencode or kilocode"
                  />
                </label>
              </div>
              <div className="floating-color-grid" style={{ marginTop: '5px' }}>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Local Server URL:
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '3px' }}
                    value={localEndpoint}
                    onChange={(e) => setLocalEndpoint(e.target.value)}
                  />
                </label>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Local Model ID:
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '3px' }}
                    value={localModel}
                    onChange={(e) => setLocalModel(e.target.value)}
                  />
                </label>
              </div>
              <div className="floating-card-row" style={{ marginTop: '6px' }}>
                {onOpenSetupWizard && (
                  <button
                    type="button"
                    className="floating-btn-secondary"
                    onClick={onOpenSetupWizard}
                  >
                    <Sparkles size={11} />
                    <span>Onboarding Wizard</span>
                  </button>
                )}
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => void handleSaveAndTestConnector(false)}
                >
                  Save Local Agent Config
                </button>
              </div>
            </div>

            {/* Google Account Session */}
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Google Account Sync</span>
                {googleUser ? (
                  <span style={{ fontSize: '10.5px', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} /> {googleUser.email}
                  </span>
                ) : (
                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Not signed in</span>
                )}
              </div>
              {googleUser ? (
                <button
                  type="button"
                  className="floating-btn-secondary danger"
                  onClick={onGoogleLogout}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <LogOut size={12} />
                  <span>Sign Out Google Account</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => void onGoogleLogin()}
                  disabled={isLoggingIn}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {isLoggingIn ? <Loader2 size={12} className="spin" /> : null}
                  <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* TAB 2: BOT VISUAL LOOK, COLORS, MEDIA & ACCESSORIES */}
        {activeTab === 'look' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-title">Visual Format (Instant Live Preview on Mascot)</div>
              <div className="floating-pill-grid" style={{ marginTop: '4px' }}>
                {(
                  [
                    ['robot', 'Vector Bot'],
                    ['image', 'Image Avatar'],
                    ['sprite_frames', 'Sprite Frames'],
                    ['video', 'Video Loop'],
                  ] as Array<[BotVisualMode, string]>
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`floating-chip ${botCustom.visualMode === mode ? 'active' : ''}`}
                    onClick={() =>
                      void updateBotCustomization((prev) => ({ ...prev, visualMode: mode }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {botCustom.visualMode === 'image' && (
                <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px' }}>
                  Image URL (PNG/SVG/GIF):
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '3px' }}
                    placeholder="https://..."
                    value={botCustom.avatarImageUrl}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        avatarImageUrl: e.target.value,
                      }))
                    }
                  />
                </label>
              )}

              {botCustom.visualMode === 'video' && (
                <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px' }}>
                  MP4 / WebM Video Loop URL:
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '3px' }}
                    placeholder="https://..."
                    value={botCustom.videoUrl}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        videoUrl: e.target.value,
                      }))
                    }
                  />
                </label>
              )}

              {botCustom.visualMode === 'sprite_frames' && (
                <div className="floating-color-grid" style={{ marginTop: '6px' }}>
                  {(['idle', 'happy', 'anger', 'furious'] as const).map((st) => (
                    <label key={st} style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                      {st} frame URL:
                      <input
                        type="text"
                        className="floating-input"
                        style={{ marginTop: '2px' }}
                        value={botCustom.framesConfig?.[st] || ''}
                        placeholder={`https://.../${st}.png`}
                        onChange={(e) =>
                          void updateBotCustomization((prev) => ({
                            ...prev,
                            framesConfig: { ...prev.framesConfig, [st]: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="floating-card-item">
              <div className="floating-card-title">Chassis & Accessory</div>
              <div className="floating-pill-grid" style={{ marginTop: '4px' }}>
                {CHASSIS_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`floating-chip ${botCustom.appearance.model === m.id ? 'active' : ''}`}
                    onClick={() =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        appearance: { ...prev.appearance, model: m.id },
                      }))
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="floating-pill-grid" style={{ marginTop: '6px' }}>
                {ACCESSORIES.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    className={`floating-chip ${botCustom.appearance.accessory === acc.id ? 'active' : ''}`}
                    onClick={() =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        appearance: { ...prev.appearance, accessory: acc.id },
                      }))
                    }
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Bot Glow, Eye & Anger Colors</span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {botCustom.appearance.paletteName}
                </span>
              </div>
              <div className="floating-pill-grid" style={{ marginTop: '4px' }}>
                {COLOR_PALETTE_PRESETS.map((pal) => (
                  <button
                    key={pal.name}
                    type="button"
                    className={`floating-chip ${botCustom.appearance.paletteName === pal.name ? 'active' : ''}`}
                    onClick={() =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        appearance: {
                          ...prev.appearance,
                          paletteName: pal.name,
                          idleColor: pal.idleColor,
                          glowColor: pal.glowColor,
                          joyColor: pal.joyColor,
                          angerColor: pal.angerColor,
                          furiousColor: pal.furiousColor,
                        },
                      }))
                    }
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '99px',
                        background: pal.idleColor,
                      }}
                    />
                    {pal.name}
                  </button>
                ))}
              </div>

              <div className="floating-color-grid" style={{ marginTop: '6px' }}>
                {(
                  [
                    ['idleColor', 'Idle Eyes'],
                    ['glowColor', 'Aura Glow'],
                    ['joyColor', 'Joy Mood'],
                    ['loveColor', 'Love Hearts'],
                    ['angerColor', 'Mad Color'],
                    ['furiousColor', 'Furious Color'],
                    ['thinkingColor', 'Thinking'],
                    ['shellBg', 'Head Shell'],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="floating-color-field">
                    <span>{label}</span>
                    <input
                      type="color"
                      value={botCustom.appearance[field]}
                      onChange={(e) =>
                        void updateBotCustomization((prev) => ({
                          ...prev,
                          appearance: {
                            ...prev.appearance,
                            paletteName: 'Custom',
                            [field]: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              <label className="floating-slider-row" style={{ marginTop: '6px' }}>
                <span>Desktop Mascot Size: {robotSize}px</span>
                <input
                  type="range"
                  min={110}
                  max={280}
                  value={robotSize}
                  onChange={(e) => onResizeRobot(Number(e.target.value))}
                />
              </label>
            </div>
          </>
        )}

        {/* TAB 3: WHERE & HOW HE GETS MAD + PERSONALITY */}
        {activeTab === 'anger' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Where & How He Gets Mad</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className="floating-btn-secondary danger"
                    style={{ padding: '4px 8px', fontSize: '10.5px' }}
                    onClick={() => onTriggerBotAnger(45, 'Hey! Watch it!')}
                  >
                    Test Mad
                  </button>
                  <button
                    type="button"
                    className="floating-btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '10.5px' }}
                    onClick={() => onTriggerBotAnger(0, undefined, true)}
                  >
                    Calm
                  </button>
                </div>
              </div>

              <label className="floating-toggle-row" style={{ marginTop: '4px' }}>
                <span>Enable Anger & Frustration System</span>
                <input
                  type="checkbox"
                  checked={botCustom.angerSettings.enabled}
                  onChange={(e) =>
                    void updateBotCustomization((prev) => ({
                      ...prev,
                      angerSettings: { ...prev.angerSettings, enabled: e.target.checked },
                    }))
                  }
                />
              </label>

              <div className="floating-color-grid" style={{ marginTop: '4px' }}>
                <label className="floating-toggle-row">
                  <span>Screen Wall Hits</span>
                  <input
                    type="checkbox"
                    checked={botCustom.angerSettings.triggers.wallImpact}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        angerSettings: {
                          ...prev.angerSettings,
                          triggers: {
                            ...prev.angerSettings.triggers,
                            wallImpact: e.target.checked,
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="floating-toggle-row">
                  <span>Hostile Chat Words</span>
                  <input
                    type="checkbox"
                    checked={botCustom.angerSettings.triggers.hostileWords}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        angerSettings: {
                          ...prev.angerSettings,
                          triggers: {
                            ...prev.angerSettings.triggers,
                            hostileWords: e.target.checked,
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="floating-toggle-row">
                  <span>Rapid Shaking</span>
                  <input
                    type="checkbox"
                    checked={botCustom.angerSettings.triggers.rapidShake}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        angerSettings: {
                          ...prev.angerSettings,
                          triggers: {
                            ...prev.angerSettings.triggers,
                            rapidShake: e.target.checked,
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="floating-toggle-row">
                  <span>Break Chassis at Max</span>
                  <input
                    type="checkbox"
                    checked={botCustom.angerSettings.breakOnMaxDamage}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        angerSettings: {
                          ...prev.angerSettings,
                          breakOnMaxDamage: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <label className="floating-slider-row" style={{ marginTop: '6px' }}>
                <span>
                  Wall Impact Sensitivity: {botCustom.angerSettings.wallImpactSensitivity.toFixed(1)}x
                </span>
                <input
                  type="range"
                  min={0.3}
                  max={3.0}
                  step={0.1}
                  value={botCustom.angerSettings.wallImpactSensitivity}
                  onChange={(e) =>
                    void updateBotCustomization((prev) => ({
                      ...prev,
                      angerSettings: {
                        ...prev.angerSettings,
                        wallImpactSensitivity: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>

              <div className="floating-color-grid">
                <label className="floating-slider-row">
                  <span>Mad Threshold: {botCustom.angerSettings.angerThreshold}</span>
                  <input
                    type="range"
                    min={10}
                    max={65}
                    value={botCustom.angerSettings.angerThreshold}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        angerSettings: {
                          ...prev.angerSettings,
                          angerThreshold: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
                <label className="floating-slider-row">
                  <span>Furious Threshold: {botCustom.angerSettings.furiousThreshold}</span>
                  <input
                    type="range"
                    min={30}
                    max={95}
                    value={botCustom.angerSettings.furiousThreshold}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        angerSettings: {
                          ...prev.angerSettings,
                          furiousThreshold: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                Hostile Trigger Words in Chat (comma-separated):
                <input
                  type="text"
                  className="floating-input"
                  style={{ marginTop: '3px' }}
                  value={botCustom.angerSettings.hostileKeywords.join(', ')}
                  onChange={(e) =>
                    void updateBotCustomization((prev) => ({
                      ...prev,
                      angerSettings: {
                        ...prev.angerSettings,
                        hostileKeywords: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                />
              </label>

              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                Custom Furious Lines (comma-separated):
                <input
                  type="text"
                  className="floating-input"
                  style={{ marginTop: '3px' }}
                  value={botCustom.angerSettings.customFuriousPhrases.join(', ')}
                  onChange={(e) =>
                    void updateBotCustomization((prev) => ({
                      ...prev,
                      angerSettings: {
                        ...prev.angerSettings,
                        customFuriousPhrases: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                />
              </label>
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={12} />
                  <span>Who Luminess Is (Settings-Only)</span>
                </span>
                <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>Locked from chat edits</span>
              </div>
              <div className="floating-card-sub">
                Who Luminess is can only be changed here in Settings — chat messages cannot rewrite Luminess&apos;s core identity.
              </div>
              <div className="floating-color-grid" style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Bot Name (Who Luminess Is):
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '2px' }}
                    value={botCustom.botName}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        botName: e.target.value,
                      }))
                    }
                  />
                </label>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Call You (Your Name):
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '2px' }}
                    placeholder="What should Luminess call you?"
                    value={botCustom.userName}
                    onChange={(e) =>
                      void updateBotCustomization((prev) => ({
                        ...prev,
                        userName: e.target.value,
                      }))
                    }
                    onBlur={(e) => {
                      const trimmed = e.target.value.trim();
                      if (trimmed) {
                        onAddMemory('identity', 'preferred_name', trimmed);
                      }
                    }}
                  />
                </label>
              </div>
              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '5px' }}>
                Who Luminess Is (Personality & Behavior Instructions):
                <textarea
                  className="config-json-textarea"
                  style={{ minHeight: '66px', marginTop: '3px' }}
                  placeholder="Describe who Luminess is and how they act (only editable in Settings)..."
                  value={botCustom.personality.customPrompt}
                  onChange={(e) =>
                    void updateBotCustomization((prev) => ({
                      ...prev,
                      personality: { ...prev.personality, customPrompt: e.target.value },
                    }))
                  }
                />
              </label>
              <label style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '5px' }}>
                What Would You Like Luminess to Know About You? (Bio):
                <textarea
                  className="config-json-textarea"
                  style={{ minHeight: '56px', marginTop: '3px' }}
                  placeholder="Your work, hobbies, goals, preferences, timezone, or projects..."
                  value={botCustom.userBio || ''}
                  onChange={(e) =>
                    void updateBotCustomization((prev) => ({
                      ...prev,
                      userBio: e.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Brain size={12} />
                  <span>Saved Memory (ChatGPT-Style)</span>
                </span>
                {memories.length > 0 && (
                  <button
                    type="button"
                    className="floating-btn-secondary"
                    style={{ padding: '2px 7px', fontSize: '9.5px' }}
                    onClick={onClearMemories}
                  >
                    Clear All
                  </button>
                )}
              </div>
              <label className="floating-toggle-row" style={{ marginTop: '2px' }}>
                <span>Reference & Keep Saved Memories Across Sessions</span>
                <input
                  type="checkbox"
                  checked={config.memory_sync_enabled}
                  onChange={(e) =>
                    void onUpdateConfig({ ...config, memory_sync_enabled: e.target.checked })
                  }
                />
              </label>
              <div style={{ display: 'flex', gap: '4px', marginTop: '5px', flexWrap: 'wrap' }}>
                <select
                  className="floating-input"
                  style={{ width: '92px', flex: '0 0 auto', padding: '4px 6px', fontSize: '10.5px' }}
                  value={newMemCategory}
                  onChange={(e) =>
                    setNewMemCategory(e.target.value as UserMemoryItem['category'])
                  }
                >
                  <option value="fact">Fact</option>
                  <option value="identity">Identity</option>
                  <option value="preference">Pref</option>
                  <option value="project">Project</option>
                </select>
                <input
                  type="text"
                  className="floating-input"
                  style={{ flex: '1 1 85px', padding: '4px 6px', fontSize: '10.5px' }}
                  placeholder="Key (e.g. stack)"
                  value={newMemKey}
                  onChange={(e) => setNewMemKey(e.target.value)}
                />
                <input
                  type="text"
                  className="floating-input"
                  style={{ flex: '2 1 130px', padding: '4px 6px', fontSize: '10.5px' }}
                  placeholder="What to remember..."
                  value={newMemValue}
                  onChange={(e) => setNewMemValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMemValue.trim()) {
                      e.preventDefault();
                      onAddMemory(
                        newMemCategory,
                        (newMemKey || 'note').trim(),
                        newMemValue.trim()
                      );
                      setNewMemKey('');
                      setNewMemValue('');
                      flashNotice('Saved to Luminess memory');
                    }
                  }}
                />
                <button
                  type="button"
                  className="floating-btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '10.5px' }}
                  onClick={() => {
                    if (!newMemValue.trim()) return;
                    onAddMemory(
                      newMemCategory,
                      (newMemKey || 'note').trim(),
                      newMemValue.trim()
                    );
                    setNewMemKey('');
                    setNewMemValue('');
                    flashNotice('Saved to Luminess memory');
                  }}
                >
                  <Plus size={11} />
                  <span>Add</span>
                </button>
              </div>
              {memories.length === 0 ? (
                <div className="floating-card-sub" style={{ marginTop: '4px' }}>
                  No saved memories yet. Tell Luminess &quot;remember that...&quot; or add one above.
                </div>
              ) : (
                <div
                  style={{
                    marginTop: '6px',
                    maxHeight: '132px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {memories.slice(0, 24).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        padding: '4px 7px',
                        borderRadius: '6px',
                        background: 'rgba(15, 23, 42, 0.55)',
                        border: '1px solid rgba(148, 163, 184, 0.16)',
                        fontSize: '10.5px',
                      }}
                    >
                      <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <strong style={{ color: '#38bdf8' }}>{m.key}</strong>: {m.value}
                      </span>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ padding: '2px', flexShrink: 0 }}
                        title="Delete memory"
                        onClick={() => onDeleteMemory(m.id)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 4: GITHUB FORK CONNECT + PLATFORM PAIRING + AI CUSTOMIZATION */}
        {activeTab === 'fork' && (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">Connect & Sync Forked GitHub Repo</span>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10px' }}
                  onClick={() =>
                    onOpenExternalUrl('https://github.com/jasonhukom/Luminess-Assist/fork')
                  }
                >
                  <GitFork size={11} />
                  <span>Fork Upstream</span>
                </button>
              </div>
              <div className="floating-card-sub">
                Fork <code>jasonhukom/Luminess-Assist</code>, edit <code>luminess.bot.json</code> (manually or with AI), and pull your custom bot directly into this app!
              </div>

              <div className="floating-color-grid" style={{ marginTop: '5px' }}>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  GitHub Fork (owner/repo):
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '2px' }}
                    placeholder="yourname/Luminess-Assist"
                    value={forkRepoInput}
                    onChange={(e) => setForkRepoInput(e.target.value)}
                  />
                </label>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Branch:
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '2px' }}
                    value={forkBranchInput}
                    onChange={(e) => setForkBranchInput(e.target.value)}
                  />
                </label>
              </div>

              <button
                type="button"
                className="floating-btn-primary"
                style={{ marginTop: '6px' }}
                disabled={syncBusy}
                onClick={() => void handleSyncGitHubFork()}
              >
                {syncBusy ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                <span>Pull Customization from GitHub Fork</span>
              </button>
            </div>

            <div className="floating-card-item">
              <div className="floating-card-title">Connect via Luminess Platform</div>
              <div className="floating-color-grid" style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Platform URL:
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '2px' }}
                    value={platformUrlInput}
                    onChange={(e) => setPlatformUrlInput(e.target.value)}
                  />
                </label>
                <label style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                  Pairing Code:
                  <input
                    type="text"
                    className="floating-input"
                    style={{ marginTop: '2px' }}
                    placeholder="LUM-XXXX"
                    value={pairingCodeInput}
                    onChange={(e) => setPairingCodeInput(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="floating-btn-secondary"
                style={{ marginTop: '6px', width: '100%' }}
                disabled={syncBusy}
                onClick={() => void handleConnectPlatformCode()}
              >
                Sync from Platform Pairing Code
              </button>

              {syncFeedback && (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    background: syncFeedback.ok
                      ? 'rgba(16,185,129,0.14)'
                      : 'rgba(239,68,68,0.14)',
                    color: syncFeedback.ok ? '#6ee7b7' : '#fecaca',
                  }}
                >
                  {syncFeedback.msg}
                </div>
              )}
            </div>

            <div className="floating-card-item">
              <div className="floating-card-title">Customize Fork Using AI</div>
              <div className="floating-card-sub">
                Users are encouraged to fork this repo and use AI (OpenCode, KiloCode, Claude, or Gemini) inside their own forked repository to customize look, anger rules, or features.
              </div>
              <div className="floating-card-row" style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(botCustom, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'luminess.bot.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    flashNotice('Exported luminess.bot.json');
                  }}
                >
                  <Download size={12} />
                  <span>Export luminess.bot.json</span>
                </button>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(aiCustomizePrompt);
                    flashNotice('Copied AI Fork Prompt!');
                  }}
                >
                  <Copy size={12} />
                  <span>Copy AI Prompt</span>
                </button>
                {onRunAiForkCustomize && (
                  <button
                    type="button"
                    className="floating-btn-primary"
                    onClick={() => onRunAiForkCustomize(aiCustomizePrompt)}
                  >
                    <Wand2 size={12} />
                    <span>Ask Bot</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 5: STORAGE, PERMISSIONS, CONFIG.JSON & SUPPORT */}
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
                <div className={`storage-meter-fill ${usageFillClass}`} style={{ width: `${usagePct}%` }} />
              </div>
              <div className="floating-card-row" style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
                <span>Used: {storageStatus ? formatBytesToHuman(storageStatus.used_bytes) : '0 KB'}</span>
                <span>
                  Cap:{' '}
                  {storageStatus
                    ? formatBytesToHuman(storageStatus.effective_limit_bytes)
                    : `${config.storage_limit_bytes ? formatBytesToHuman(config.storage_limit_bytes) : 'Unlimited'}`}
                </span>
              </div>
              {storageStatus?.warning_message && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#fcd34d',
                    marginTop: '4px',
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>{storageStatus.warning_message}</span>
                </div>
              )}
            </div>

            <div className="floating-card-item">
              <div className="floating-card-sub">{STORAGE_RECOMMENDATION_EXPLANATION}</div>
              {STORAGE_TIER_OPTIONS.map((option) => {
                const isSelected = config.storage_tier === option.id;
                return (
                  <div
                    key={option.id}
                    className={`storage-tier-option ${isSelected ? 'selected' : ''}`}
                    style={{ marginTop: '4px' }}
                    onClick={() => void onSelectStorageTier(option.id)}
                  >
                    <div className="floating-card-row">
                      <span className="floating-card-title">
                        {option.label} — {option.allocationLabel}
                      </span>
                      {isSelected && <Check size={13} className="text-glow" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">
                  <Droplets size={13} style={{ display: 'inline', marginRight: '5px', color: '#38bdf8' }} />
                  Hydration & Drink Reminder
                </span>
                <span style={{ fontSize: '10.5px', color: '#7dd3fc', fontWeight: 700 }}>
                  {config.drink_reminder?.daily_glasses ?? 0}/{config.drink_reminder?.daily_goal_glasses ?? 8} glasses
                </span>
              </div>
              <div className="floating-card-sub">
                Next reminder: <strong>{drinkCountdownLabel || (config.drink_reminder?.enabled ? 'Scheduled' : 'Paused')}</strong>
              </div>
              <label className="floating-toggle-row" style={{ marginTop: '4px' }}>
                <span>Enable Recurring Drink Reminder</span>
                <input
                  type="checkbox"
                  checked={config.drink_reminder?.enabled ?? true}
                  onChange={(e) => {
                    const base = normalizeDrinkReminderConfig(config.drink_reminder);
                    void onUpdateConfig({
                      ...config,
                      drink_reminder: {
                        ...base,
                        enabled: e.target.checked,
                        last_reminded_at: Date.now(),
                        snoozed_until: 0,
                      },
                    });
                  }}
                />
              </label>
              <label className="floating-toggle-row" style={{ marginTop: '4px' }}>
                <span>Gentle Water Chime Sound</span>
                <input
                  type="checkbox"
                  checked={config.drink_reminder?.sound_enabled ?? true}
                  onChange={(e) => {
                    const base = normalizeDrinkReminderConfig(config.drink_reminder);
                    void onUpdateConfig({
                      ...config,
                      drink_reminder: { ...base, sound_enabled: e.target.checked },
                    });
                  }}
                />
              </label>
              <div className="floating-pill-grid" style={{ marginTop: '6px' }}>
                {[15, 30, 45, 60, 90, 120].map((mins) => {
                  const active = (config.drink_reminder?.interval_minutes ?? 45) === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      className={`floating-chip ${active ? 'active' : ''}`}
                      onClick={() => {
                        const base = normalizeDrinkReminderConfig(config.drink_reminder);
                        void onUpdateConfig({
                          ...config,
                          drink_reminder: {
                            ...base,
                            enabled: true,
                            interval_minutes: clampDrinkIntervalMinutes(mins),
                            last_reminded_at: Date.now(),
                            snoozed_until: 0,
                          },
                        });
                      }}
                    >
                      {mins}m
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                <label className="floating-card-sub">
                  Daily Goal (glasses)
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className="floating-input"
                    value={config.drink_reminder?.daily_goal_glasses ?? 8}
                    onChange={(e) => {
                      const base = normalizeDrinkReminderConfig(config.drink_reminder);
                      void onUpdateConfig({
                        ...config,
                        drink_reminder: {
                          ...base,
                          daily_goal_glasses: clampDrinkGoal(Number(e.target.value)),
                        },
                      });
                    }}
                  />
                </label>
                <label className="floating-card-sub">
                  Snooze (min)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className="floating-input"
                    value={config.drink_reminder?.snooze_minutes ?? 10}
                    onChange={(e) => {
                      const base = normalizeDrinkReminderConfig(config.drink_reminder);
                      void onUpdateConfig({
                        ...config,
                        drink_reminder: {
                          ...base,
                          snooze_minutes: clampDrinkSnoozeMinutes(Number(e.target.value)),
                        },
                      });
                    }}
                  />
                </label>
              </div>
              <input
                type="text"
                className="floating-input"
                style={{ marginTop: '6px' }}
                placeholder="Custom drink reminder prompt..."
                value={config.drink_reminder?.custom_message ?? ''}
                onChange={(e) => {
                  const base = normalizeDrinkReminderConfig(config.drink_reminder);
                  void onUpdateConfig({
                    ...config,
                    drink_reminder: { ...base, custom_message: e.target.value },
                  });
                }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {onLogDrink && (
                  <button type="button" className="floating-btn-primary" onClick={onLogDrink}>
                    <Droplets size={13} />
                    <span>+1 Drank Water</span>
                  </button>
                )}
                <button
                  type="button"
                  className="floating-btn-secondary"
                  onClick={() => {
                    playGentleWaterChime();
                    onTriggerDrinkAlert?.();
                  }}
                >
                  <span>Test Reminder</span>
                </button>
                {onOpenMusicPlayer && (
                  <button type="button" className="floating-btn-secondary" onClick={onOpenMusicPlayer}>
                    <Disc3 size={13} />
                    <span>Music Player</span>
                  </button>
                )}
                {onOpenWellbeingBox && (
                  <button type="button" className="floating-btn-secondary" onClick={onOpenWellbeingBox}>
                    <Activity size={13} />
                    <span>Wellbeing & Tasks</span>
                  </button>
                )}
              </div>
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">
                  <ShieldCheck size={13} style={{ display: 'inline', marginRight: '5px' }} />
                  Permissions, Startup & Search
                </span>
              </div>
              <label className="floating-toggle-row" style={{ marginTop: '4px' }}>
                <span>Launch Automatically When Windows Starts</span>
                <input
                  type="checkbox"
                  checked={config.auto_start_windows ?? true}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    if (onToggleWindowsStartup) {
                      void onToggleWindowsStartup(enabled);
                    } else {
                      void onUpdateConfig({ ...config, auto_start_windows: enabled });
                    }
                  }}
                />
              </label>
              <label className="floating-toggle-row" style={{ marginTop: '4px' }}>
                <span>Auto-Approve PC Tool Execution</span>
                <input
                  type="checkbox"
                  checked={config.auto_approve_tools}
                  onChange={(e) =>
                    void onUpdateConfig({ ...config, auto_approve_tools: e.target.checked })
                  }
                />
              </label>
              <label className="floating-toggle-row" style={{ marginTop: '4px' }}>
                <span>Web Search Engine & Citations</span>
                <input
                  type="checkbox"
                  checked={config.search_engine_enabled}
                  onChange={(e) =>
                    void onUpdateConfig({ ...config, search_engine_enabled: e.target.checked })
                  }
                />
              </label>
            </div>

            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title">
                  <FileJson size={13} style={{ display: 'inline', marginRight: '5px' }} />
                  config.json Editor
                </span>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10.5px' }}
                  onClick={() => setShowRawJson((v) => !v)}
                >
                  {showRawJson ? 'Hide' : 'Edit Raw JSON'}
                </button>
              </div>
              {showRawJson && (
                <>
                  <textarea
                    className="config-json-textarea"
                    style={{ marginTop: '6px' }}
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
                      Reset
                    </button>
                    <button
                      type="button"
                      className="floating-btn-primary"
                      onClick={() => void handleSaveRawConfigJson()}
                    >
                      Save config.json
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Support Luminess via Ko-fi & GitHub Star */}
            <div className="floating-card-item">
              <div className="floating-card-title">Support Luminess Assist</div>
              <div className="floating-card-sub">
                Like Luminess? Support development on Ko-fi or star our repository!
              </div>
              <div className="floating-card-row" style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  className="floating-btn-primary"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #db2777, #f43f5e)' }}
                  onClick={() => onOpenExternalUrl('https://ko-fi.com/jason_hukom')}
                >
                  <Heart size={12} />
                  <span>Support on Ko-fi</span>
                </button>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => onOpenExternalUrl('https://github.com/jasonhukom/Luminess-Assist')}
                >
                  <Star size={12} />
                  <span>Star Repo</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="floating-box-footer">
        <span>Vault: Windows DPAPI Encrypted</span>
        <span>Live-Synced with Bot & config.json</span>
      </div>
    </div>
  );
}
