import React, { useState } from 'react';
import {
  ShieldAlert,
  Server,
  ToggleLeft,
  ToggleRight,
  FileText,
  Upload,
  Cpu,
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Terminal,
  Layers,
  Database,
  Radio,
  Clock,
  Plus,
} from 'lucide-react';
import {
  type AppRelease,
  type FeatureFlags,
  type GlobalConfigItem,
} from '../lib/botPlatformStore.ts';

interface AdminPanelTabProps {
  releases: AppRelease[];
  featureFlags: FeatureFlags;
  globalConfig: GlobalConfigItem[];
  onUpdateReleases: (releases: AppRelease[]) => void;
  onUpdateFeatureFlags: (flags: FeatureFlags) => void;
  onUpdateGlobalConfig: (config: GlobalConfigItem[]) => void;
}

export const AdminPanelTab: React.FC<AdminPanelTabProps> = ({
  releases,
  featureFlags,
  globalConfig,
  onUpdateReleases,
  onUpdateFeatureFlags,
  onUpdateGlobalConfig,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ota' | 'flags' | 'guardrails' | 'assets' | 'telemetry'>('ota');
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // New version form state
  const [newVersionId, setNewVersionId] = useState('1.1.4');
  const [newDownloadUrl, setNewDownloadUrl] = useState('https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.4/Luminess-Assist_1.1.4_x64_en-US.msi');
  const [newNotes, setNewNotes] = useState('Added hardware sensor reactive emotions, background process monitor, and web pairing sync.');
  const [newIsMandatory, setNewIsMandatory] = useState(false);

  // Guardrail prompt editor state
  const masterPromptItem = globalConfig.find((c) => c.key === 'master_guardrail_prompt') || {
    key: 'master_guardrail_prompt',
    value: 'Always reply in valid JSON { content: string, emotion: Emotion }. Never execute file deletion without explicit approval.',
    description: 'Hidden master guardrail wrapped around every custom bot personality',
    lastUpdated: '2026-10-28',
  };
  const [masterPromptText, setMasterPromptText] = useState(masterPromptItem.value);

  // Sample CMS assets
  const [cmsAssets, setCmsAssets] = useState([
    { id: 'skin_01', name: 'Cyber Neon Cat', category: 'Skin', status: 'active', downloads: '1.2k', rarity: 'Legendary' },
    { id: 'skin_02', name: 'Winter Frost Armor', category: 'Skin', status: 'active', downloads: '840', rarity: 'Epic' },
    { id: 'skin_03', name: 'Halloween Void Orb', category: 'Skin', status: 'draft', downloads: '0', rarity: 'Seasonal' },
    { id: 'preset_01', name: 'Study Buddy Pomodoro', category: 'Archetype', status: 'active', downloads: '4.8k', rarity: 'Official' },
    { id: 'sound_01', name: '8-Bit Synth Chirps', category: 'Voice Pack', status: 'active', downloads: '920', rarity: 'Rare' },
  ]);

  const triggerToast = (msg: string) => {
    setSavedSuccess(msg);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleToggleFlag = (key: keyof FeatureFlags) => {
    const updated = {
      ...featureFlags,
      [key]: !featureFlags[key],
    };
    onUpdateFeatureFlags(updated);
    triggerToast(`Feature flag '${String(key)}' updated to ${updated[key] ? 'ENABLED' : 'DISABLED'}`);
  };

  const handlePublishRelease = (e: React.FormEvent) => {
    e.preventDefault();
    const newRelease: AppRelease = {
      versionId: newVersionId.trim(),
      downloadUrl: newDownloadUrl.trim(),
      releaseNotes: newNotes.trim(),
      isMandatoryUpdate: newIsMandatory,
      status: 'latest',
      releasedAt: new Date().toISOString().split('T')[0],
    };
    // Demote old latest to beta or standard
    const updated = [
      newRelease,
      ...releases.map((r) => (r.status === 'latest' ? { ...r, status: 'beta' as const } : r)),
    ];
    onUpdateReleases(updated);
    triggerToast(`Version ${newRelease.versionId} published to OTA distribution channel!`);
  };

  const handleSaveGuardrails = () => {
    const updated = globalConfig.map((item) =>
      item.key === 'master_guardrail_prompt'
        ? { ...item, value: masterPromptText, lastUpdated: new Date().toISOString().split('T')[0] }
        : item
    );
    onUpdateGlobalConfig(updated);
    triggerToast('Master Guardrail System Prompt updated globally!');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Admin Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] p-6 sm:p-8 shadow-sm crosshair-corner">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dad7d0] dark:border-white/15 bg-[#080503]/5 dark:bg-white/5 px-3 py-1 font-mono text-[10px] font-semibold text-[#080503] dark:text-[#fafaf9] mb-3 uppercase tracking-wider">
              <ShieldAlert size={12} />
              <span>MISSION CONTROL &bull; ADMIN DASHBOARD</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
              Platform &amp; Desktop{' '}
              <span className="editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
                Control Center
              </span>
            </h1>
            <p className="mt-2 text-sm text-[#5e534a] dark:text-[#a89c92] max-w-2xl leading-relaxed">
              Manage OTA software updates, toggle emergency skill kill-switches, enforce global guardrail prompts, and monitor desktop client telemetry without recompiling binaries.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SERVERS: OPERATIONAL</span>
            </span>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-mono flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>{savedSuccess}</span>
          </div>
        )}

        {/* Admin Navigation Pills */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-[#dad7d0]/60 dark:border-white/10">
          {[
            { id: 'ota', label: 'Version & OTA Manager', icon: Upload },
            { id: 'flags', label: 'Feature Flags & Kill-Switches', icon: ToggleRight },
            { id: 'guardrails', label: 'Master Prompt & Guardrails', icon: FileText },
            { id: 'assets', label: 'Asset & Preset CMS', icon: Layers },
            { id: 'telemetry', label: 'Telemetry & LLM Token Usage', icon: Activity },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#080503] dark:border-white bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] shadow-sm'
                    : 'border border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] text-[#5e534a] dark:text-[#a89c92] hover:border-[#080503]/30'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-white dark:text-[#080503]' : 'opacity-60'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MODULE 1: VERSION & OTA MANAGER */}
      {activeSubTab === 'ota' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Publish New Release Form */}
          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-5 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload size={18} className="text-purple-400" />
                <span>Publish OTA Desktop Build</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Notify all running Windows clients that a new update is ready to download.
              </p>
            </div>

            <form onSubmit={handlePublishRelease} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-300 uppercase block mb-1">Version Number</label>
                <input
                  type="text"
                  value={newVersionId}
                  onChange={(e) => setNewVersionId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm outline-none focus:border-purple-400"
                  placeholder="e.g. 1.1.4"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 uppercase block mb-1">Download URL (.msi / .exe)</label>
                <input
                  type="url"
                  value={newDownloadUrl}
                  onChange={(e) => setNewDownloadUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-purple-400"
                  placeholder="https://github.com/.../release.msi"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 uppercase block mb-1">Patch Notes / Changelog</label>
                <textarea
                  rows={4}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-purple-400"
                  placeholder="Describe bug fixes and new skills..."
                  required
                />
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsMandatory}
                  onChange={(e) => setNewIsMandatory(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-400"
                />
                <div>
                  <span className="text-xs font-bold text-amber-200 block">Flag as Mandatory Security Update</span>
                  <span className="text-[11px] text-slate-400 block">Desktop bots will display a modal requiring update before AI calls.</span>
                </div>
              </label>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-mono text-xs font-bold tracking-wide shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer"
              >
                DEPLOY VERSION TO OTA CHANNEL
              </button>
            </form>
          </div>

          {/* Active Releases Table */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold uppercase text-slate-300 tracking-wider">
                Active Release Pipeline
              </h3>
              <span className="text-xs font-mono text-slate-500">{releases.length} Builds Registered</span>
            </div>

            <div className="space-y-3">
              {releases.map((rel) => (
                <div
                  key={rel.versionId}
                  className="p-4 rounded-2xl border border-white/[0.08] bg-black/30 space-y-2.5 transition hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-mono font-bold text-white">v{rel.versionId}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold border ${
                          rel.status === 'latest'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                            : rel.status === 'beta'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                              : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {rel.status}
                      </span>
                      {rel.isMandatoryUpdate && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-400/30 font-bold">
                          MANDATORY
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-500">{rel.releasedAt}</span>
                  </div>

                  <p className="text-xs text-slate-300 font-mono leading-relaxed bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                    {rel.releaseNotes}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                    <span className="truncate max-w-sm text-slate-500">{rel.downloadUrl}</span>
                    <a
                      href={rel.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-300 hover:text-purple-200 underline"
                    >
                      Verify Binary
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODULE 2: FEATURE FLAGS & GLOBAL KILL-SWITCHES */}
      {activeSubTab === 'flags' && (
        <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ToggleRight size={20} className="text-purple-400" />
              <span>Feature Flags &amp; Global Kill-Switches</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Instantly disable malfunctioning third-party APIs or costly features globally across all client bots in 1 click.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'voiceModeEnabled',
                title: 'Global Voice Mode (TTS Audio)',
                desc: 'If voice generation server costs spike or latency degrades, kill-switch disables TTS globally.',
              },
              {
                key: 'webSearchEnabled',
                title: 'Web Browsing & Search Integration',
                desc: 'Disables external search queries if rate limits on Google/Bing search APIs are reached.',
              },
              {
                key: 'powershellAutomationEnabled',
                title: 'PowerShell System Automation',
                desc: 'Master kill-switch that prevents desktop bots from running terminal commands in safe mode.',
              },
              {
                key: 'screenOcrEnabled',
                title: 'Screen Reading & Vision OCR',
                desc: 'Toggles screen capture processing capabilities for multi-modal companion models.',
              },
              {
                key: 'longTermMemorySyncEnabled',
                title: 'Long-Term Memory Sync',
                desc: 'Controls whether bot memories are synchronized across cloud database tables or kept local.',
              },
              {
                key: 'cloudCodeAssistFallback',
                title: 'Cloud Code Assist Fallback Route',
                desc: 'Restricts legacy internal Code Assist proxy routing to approved enterprise accounts.',
              },
            ].map((item) => {
              const isEnabled = featureFlags[item.key as keyof FeatureFlags];
              return (
                <div
                  key={item.key}
                  className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                    isEnabled
                      ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                      : 'border-red-500/30 bg-red-500/[0.04]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-sm font-bold text-white">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed pr-2">{item.desc}</p>
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold block pt-1 text-slate-500">
                      STATUS: {isEnabled ? 'ENABLED (LIVE FOR USERS)' : 'SUPPRESSED (KILL-SWITCH ACTIVE)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFlag(item.key as keyof FeatureFlags)}
                    className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-400/40 hover:bg-red-500/30'
                    }`}
                  >
                    {isEnabled ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODULE 3: MASTER PROMPT & GUARDRAIL EDITOR */}
      {activeSubTab === 'guardrails' && (
        <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText size={18} className="text-purple-400" />
              <span>Master System Guardrail &amp; Response Constraints</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              This prompt wraps around every user's custom C.R.O.C. persona to enforce strict safety, tool-use confirmations, and formatted JSON replies.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider block">
              Global Master Constraint Prompt (Hidden System Header)
            </label>
            <textarea
              rows={6}
              value={masterPromptText}
              onChange={(e) => setMasterPromptText(e.target.value)}
              className="w-full p-4 rounded-2xl bg-black border border-white/15 text-purple-200 font-mono text-xs leading-relaxed outline-none focus:border-purple-400"
            />
            <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
              <span>Variables injected at runtime: {'{user_persona}'}, {'{pc_context}'}, {'{tools}'}</span>
              <button
                type="button"
                onClick={handleSaveGuardrails}
                className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-mono font-bold cursor-pointer"
              >
                SAVE GLOBAL GUARDRAILS
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-2">
            <span className="text-xs font-mono font-bold uppercase text-cyan-300 block">
              Guardrail Architecture Preview
            </span>
            <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
{`[MASTER GUARDRAIL (Admin Controlled)]
${masterPromptText}

[USER C.R.O.C. PERSONA (User Controlled)]
Role: Coder Companion | Humor: 8/10 | Verbosity: 4/10
Personality: Focus on snappy desktop automation and friendly productivity reminders.

[WINDOWS ENVIRONMENT RUNTIME]
Platform: Windows 11 AMD64 | Available Tools: [fs_list_dir, open_item, execute_pc_command]`}
            </pre>
          </div>
        </div>
      )}

      {/* MODULE 4: ASSET & PRESET CMS */}
      {activeSubTab === 'assets' && (
        <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers size={18} className="text-purple-400" />
                <span>Asset &amp; Skin CMS Catalog</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Drop new skins, holiday accessories, voice models, and personality templates dynamically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const newAsset = {
                  id: `asset_${Date.now()}`,
                  name: `Community Neon Skin #${cmsAssets.length + 1}`,
                  category: 'Skin',
                  status: 'active',
                  downloads: '0',
                  rarity: 'Custom',
                };
                setCmsAssets([newAsset, ...cmsAssets]);
                triggerToast('New asset uploaded to CMS distribution!');
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-mono font-bold cursor-pointer"
            >
              <Plus size={14} />
              <span>UPLOAD NEW ASSET</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {cmsAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between p-4 rounded-xl border border-white/[0.08] bg-black/20 hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-mono text-purple-300 font-bold text-xs">
                    {asset.category[0]}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">{asset.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Category: {asset.category} • Rarity: {asset.rarity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-slate-400">{asset.downloads} installs</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold border ${
                      asset.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                    }`}
                  >
                    {asset.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE 5: TELEMETRY & LLM TOKENS */}
      {activeSubTab === 'telemetry' && (
        <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-purple-400" />
              <span>Live Telemetry &amp; LLM Token Monitor</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Real-time active companion sessions, query throughput, and token consumption by model.
            </p>
          </div>

          {/* Metric Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Active Desktop Bots', value: '1,482', change: '+12% this week', color: 'text-cyan-300' },
              { label: 'Queries (Last 24h)', value: '48,910', change: '99.98% success', color: 'text-purple-300' },
              { label: 'Avg API Response', value: '342ms', change: 'P95: 580ms', color: 'text-emerald-300' },
              { label: 'Crash Rate', value: '0.02%', change: '-0.01% vs v1.1.0', color: 'text-amber-300' },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-2xl border border-white/[0.08] bg-black/30 space-y-1">
                <span className="text-[11px] font-mono uppercase text-slate-400 block">{stat.label}</span>
                <span className={`text-2xl font-mono font-extrabold ${stat.color} block`}>{stat.value}</span>
                <span className="text-[10px] font-mono text-slate-500 block">{stat.change}</span>
              </div>
            ))}
          </div>

          {/* Token Usage by Model */}
          <div className="p-5 rounded-2xl border border-white/10 bg-black/40 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider">
              Token Consumption by Provider (Today)
            </h3>
            <div className="space-y-3">
              {[
                { provider: 'Google AI Studio (Gemini 2.5 Flash)', tokens: '14.2M tokens', pct: 65, color: 'bg-cyan-400' },
                { provider: 'Anthropic Claude (Sonnet 3.5)', tokens: '5.1M tokens', pct: 23, color: 'bg-purple-400' },
                { provider: 'OpenAI Codex (GPT-5.5 / Responses)', tokens: '2.6M tokens', pct: 12, color: 'bg-emerald-400' },
              ].map((row) => (
                <div key={row.provider} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">{row.provider}</span>
                    <span className="text-white font-bold">{row.tokens}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
