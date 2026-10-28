import React, { useState } from 'react';
import {
  Database,
  Table,
  Key,
  Copy,
  Check,
  Download,
  Share2,
  FileCode,
  Shield,
  Layers,
  ArrowRight,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  type PlatformState,
  type BotMemory,
  type GlobalConfigItem,
} from '../lib/botPlatformStore.ts';

interface DatabaseSchemaTabProps {
  platformState: PlatformState;
  onUpdateMemories: (memories: BotMemory[]) => void;
  onUpdateGlobalConfig: (config: GlobalConfigItem[]) => void;
}

const SCHEMA_DEFINITIONS = [
  {
    table: 'users',
    desc: 'Stores registered accounts, authorization roles, and authentication hashes.',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, pk: true, desc: 'Unique user identifier' },
      { name: 'username', type: 'VARCHAR(50)', nullable: false, desc: 'Unique handle / nickname' },
      { name: 'email', type: 'VARCHAR(255)', nullable: false, desc: 'Verified account email' },
      { name: 'password_hash', type: 'VARCHAR(255)', nullable: false, desc: 'Argon2id or bcrypt hash' },
      { name: 'role', type: 'VARCHAR(20)', nullable: false, desc: "'user' or 'admin'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, desc: 'Account registration timestamp' },
    ],
  },
  {
    table: 'bot_profiles',
    desc: 'Stores appearance, C.R.O.C. persona, voice, and PC permissions for desktop companions.',
    primaryKey: 'id',
    foreignKeys: [{ col: 'user_id', ref: 'users(id)' }],
    columns: [
      { name: 'id', type: 'UUID', nullable: false, pk: true, desc: 'Unique bot profile ID' },
      { name: 'user_id', type: 'UUID', nullable: false, fk: true, desc: 'Owner user ID' },
      { name: 'bot_name', type: 'VARCHAR(100)', nullable: false, desc: 'Companion display name' },
      { name: 'is_active', type: 'BOOLEAN', nullable: false, desc: 'Currently active companion flag' },
      { name: 'pairing_code', type: 'VARCHAR(12)', nullable: false, desc: '1-click desktop claim code' },
      { name: 'appearance_config', type: 'JSONB', nullable: false, desc: '{ model, color, accessory, scale }' },
      { name: 'personality_config', type: 'JSONB', nullable: false, desc: '{ archetype, formality, humor, verbosity }' },
      { name: 'voice_config', type: 'JSONB', nullable: false, desc: '{ voice_id, pitch, speed }' },
      { name: 'permissions', type: 'JSONB', nullable: false, desc: '{ can_open_apps, can_sort_files, ... }' },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, desc: 'Profile creation timestamp' },
    ],
  },
  {
    table: 'bot_memories',
    desc: 'Long-term memory facts remembered by the companion across PC reboots.',
    primaryKey: 'id',
    foreignKeys: [{ col: 'bot_profile_id', ref: 'bot_profiles(id)' }],
    columns: [
      { name: 'id', type: 'UUID', nullable: false, pk: true, desc: 'Unique memory record ID' },
      { name: 'bot_profile_id', type: 'UUID', nullable: false, fk: true, desc: 'Associated bot profile ID' },
      { name: 'memory_fact', type: 'TEXT', nullable: false, desc: 'Synthesized persistent memory statement' },
      { name: 'category', type: 'VARCHAR(40)', nullable: true, desc: "'preference', 'project', 'habit'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, desc: 'Fact discovery timestamp' },
    ],
  },
  {
    table: 'app_releases',
    desc: 'Desktop software binaries, version tags, patch notes, and mandatory OTA update flags.',
    primaryKey: 'version_id',
    columns: [
      { name: 'version_id', type: 'VARCHAR(32)', nullable: false, pk: true, desc: 'e.g. 1.1.2' },
      { name: 'download_url', type: 'TEXT', nullable: false, desc: 'HTTPS link to installer binary' },
      { name: 'release_notes', type: 'TEXT', nullable: true, desc: 'Markdown patch notes' },
      { name: 'is_mandatory_update', type: 'BOOLEAN', nullable: false, desc: 'Forces client update before use' },
      { name: 'status', type: 'VARCHAR(20)', nullable: false, desc: "'latest', 'beta', 'deprecated'" },
      { name: 'released_at', type: 'DATE', nullable: false, desc: 'Public launch date' },
    ],
  },
  {
    table: 'global_config',
    desc: 'Platform feature keys, master guardrail prompts, and emergency operational switches.',
    primaryKey: 'key',
    columns: [
      { name: 'key', type: 'VARCHAR(80)', nullable: false, pk: true, desc: 'Unique config setting key' },
      { name: 'value', type: 'TEXT', nullable: false, desc: 'Setting value or JSON payload' },
      { name: 'description', type: 'TEXT', nullable: true, desc: 'Operational purpose explanation' },
      { name: 'last_updated', type: 'DATE', nullable: false, desc: 'Last modification date' },
    ],
  },
];

const FULL_POSTGRESQL_DDL = `-- ==========================================================
-- Luminess Assist Platform Database Schema (PostgreSQL / Supabase)
-- Auto-generated for Web Studio <-> Desktop Companion Sync
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BOT PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.bot_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    bot_name VARCHAR(100) NOT NULL DEFAULT 'Luminess',
    is_active BOOLEAN NOT NULL DEFAULT true,
    pairing_code VARCHAR(12) NOT NULL,
    appearance_config JSONB NOT NULL DEFAULT '{"model":"robot","color":"#38bdf8","accessory":"headphones","scale":1.0}'::jsonb,
    personality_config JSONB NOT NULL DEFAULT '{"archetype":"witty_hacker","formality":3,"humor":8,"verbosity":4}'::jsonb,
    voice_config JSONB NOT NULL DEFAULT '{"voice_id":"luna-neural","pitch":1.05,"speed":1.0}'::jsonb,
    permissions JSONB NOT NULL DEFAULT '{"can_open_apps":true,"can_sort_files":true,"can_read_clipboard":false}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for instant lookup by pairing code from desktop clients
CREATE INDEX IF NOT EXISTS idx_bot_profiles_pairing_code ON public.bot_profiles(pairing_code);
CREATE INDEX IF NOT EXISTS idx_bot_profiles_user_id ON public.bot_profiles(user_id);

-- 3. BOT MEMORIES TABLE (Long-term memory facts)
CREATE TABLE IF NOT EXISTS public.bot_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_profile_id UUID NOT NULL REFERENCES public.bot_profiles(id) ON DELETE CASCADE,
    memory_fact TEXT NOT NULL,
    category VARCHAR(40) DEFAULT 'preference',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_memories_profile_id ON public.bot_memories(bot_profile_id);

-- 4. APP RELEASES TABLE (OTA & Installer Builds)
CREATE TABLE IF NOT EXISTS public.app_releases (
    version_id VARCHAR(32) PRIMARY KEY,
    download_url TEXT NOT NULL,
    release_notes TEXT,
    is_mandatory_update BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'latest',
    released_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 5. GLOBAL CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.global_config (
    key VARCHAR(80) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    last_updated DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Row Level Security (RLS) Setup for Supabase
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;

-- Allow public read of active releases & global config
CREATE POLICY "Public Read Releases" ON public.app_releases FOR SELECT USING (true);
CREATE POLICY "Public Read Config" ON public.global_config FOR SELECT USING (true);
`;

export const DatabaseSchemaTab: React.FC<DatabaseSchemaTabProps> = ({
  platformState,
  onUpdateMemories,
  onUpdateGlobalConfig,
}) => {
  const [activeTable, setActiveTable] = useState<string>('bot_profiles');
  const [copiedSql, setCopiedSql] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');

  const handleCopySql = () => {
    navigator.clipboard.writeText(FULL_POSTGRESQL_DDL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([FULL_POSTGRESQL_DDL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'luminess_platform_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    const newMem: BotMemory = {
      id: `mem_${Date.now()}`,
      botProfileId: platformState.currentProfile.id,
      memoryFact: newMemoryText.trim(),
      category: 'preference',
      createdAt: new Date().toISOString().split('T')[0],
    };
    onUpdateMemories([newMem, ...platformState.memories]);
    setNewMemoryText('');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Database Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] p-6 sm:p-8 shadow-sm crosshair-corner">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dad7d0] dark:border-white/15 bg-[#080503]/5 dark:bg-white/5 px-3 py-1 font-mono text-[10px] font-semibold text-[#080503] dark:text-[#fafaf9] mb-3 uppercase tracking-wider">
              <Database size={12} />
              <span>POSTGRESQL &amp; SUPABASE ARCHITECTURE &bull; DATA SYNC ENGINE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
              Cloud Database{' '}
              <span className="editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
                &amp; Sync Architecture
              </span>
            </h1>
            <p className="mt-2 text-sm text-[#5e534a] dark:text-[#a89c92] max-w-2xl leading-relaxed">
              Explore the five core relational tables that bind your public web studio, admin control center, and desktop companion bots into one unified ecosystem.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-white/5 text-xs font-mono font-medium text-[#080503] dark:text-[#fafaf9] hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              {copiedSql ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copiedSql ? 'DDL Copied' : 'Copy SQL DDL'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSql}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] hover:opacity-90 text-xs font-mono font-bold tracking-tight shadow-sm transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>Download .SQL</span>
            </button>
          </div>
        </div>

        {/* 5 Core Tables Pill Selector */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-[#dad7d0]/60 dark:border-white/10">
          {SCHEMA_DEFINITIONS.map((def) => {
            const isSelected = activeTable === def.table;
            return (
              <button
                key={def.table}
                type="button"
                onClick={() => setActiveTable(def.table)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#080503] dark:border-white bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] shadow-sm'
                    : 'border border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] text-[#5e534a] dark:text-[#a89c92] hover:border-[#080503]/30'
                }`}
              >
                <Table size={13} className={isSelected ? 'text-white dark:text-[#080503]' : 'opacity-60'} />
                <span>{def.table}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Table Schema on Left, Live Data Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Table Schema DDL Card */}
        <div className="lg:col-span-6 rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-5 shadow-xl">
          {(() => {
            const currentDef = SCHEMA_DEFINITIONS.find((d) => d.table === activeTable) || SCHEMA_DEFINITIONS[0];
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Table size={20} className="text-emerald-400" />
                    <h2 className="text-lg font-bold text-white font-mono">{currentDef.table}</h2>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                    PK: {currentDef.primaryKey}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{currentDef.desc}</p>

                <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-black/30">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-white/[0.03] text-slate-400 text-[11px]">
                        <th className="p-3">COLUMN</th>
                        <th className="p-3">TYPE</th>
                        <th className="p-3">NULLABLE</th>
                        <th className="p-3">KEY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {currentDef.columns.map((col) => (
                        <tr key={col.name} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-bold text-white flex items-center gap-1.5">
                            {col.pk && <Key size={12} className="text-amber-400" />}
                            <span>{col.name}</span>
                          </td>
                          <td className="p-3 text-emerald-300">{col.type}</td>
                          <td className="p-3 text-slate-500">{col.nullable ? 'YES' : 'NO'}</td>
                          <td className="p-3">
                            {col.pk ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-bold">
                                PRIMARY
                              </span>
                            ) : (col as any).fk ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-300 border border-purple-400/20 font-bold">
                                FOREIGN
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right Column: Live Data Inspector / Sandbox */}
        <div className="lg:col-span-6 rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
              <Database size={16} className="text-emerald-400" />
              <span>Live Data Inspector ({activeTable})</span>
            </h3>
            <span className="text-xs font-mono text-emerald-400">SYNCED WITH LOCALSTORE</span>
          </div>

          {/* Active Table Data Renderer */}
          {activeTable === 'bot_profiles' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Currently loaded profile from your Web Studio customizer:
              </p>
              <div className="p-4 rounded-2xl bg-black border border-white/10 overflow-x-auto max-h-[380px] font-mono text-xs text-emerald-300">
                <pre>{JSON.stringify(platformState.currentProfile, null, 2)}</pre>
              </div>
            </div>
          )}

          {activeTable === 'bot_memories' && (
            <div className="space-y-4">
              <form onSubmit={handleAddMemory} className="flex gap-2">
                <input
                  type="text"
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  placeholder="Record new long-term memory fact..."
                  className="flex-1 px-3 py-2 rounded-xl bg-black border border-white/10 text-xs text-white font-mono outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold shrink-0 cursor-pointer"
                >
                  <Plus size={14} className="inline mr-1" />
                  <span>ADD FACT</span>
                </button>
              </form>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {platformState.memories.map((mem) => (
                  <div key={mem.id} className="p-3 rounded-xl border border-white/[0.08] bg-black/40 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                      <span className="text-emerald-400 uppercase font-bold">[{mem.category}]</span>
                      <span>{mem.createdAt}</span>
                    </div>
                    <p className="text-xs text-slate-200 font-mono">{mem.memoryFact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTable === 'users' && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {platformState.users.map((u) => (
                  <div key={u.id} className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white font-mono block">{u.username}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 uppercase font-bold">
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTable === 'app_releases' && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {platformState.releases.map((rel) => (
                  <div key={rel.versionId} className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 space-y-1">
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-xs font-bold text-white">v{rel.versionId}</span>
                      <span className="text-[10px] text-slate-400">{rel.releasedAt}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono truncate">{rel.downloadUrl}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTable === 'global_config' && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {platformState.globalConfig.map((cfg) => (
                  <div key={cfg.key} className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 space-y-1">
                    <span className="text-xs font-mono font-bold text-emerald-300 block">{cfg.key}</span>
                    <p className="text-xs text-slate-300 font-mono leading-relaxed bg-black/50 p-2 rounded-lg border border-white/5">
                      {cfg.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Sync Protocol Flowchart Section */}
      <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-sm font-mono font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
          <Share2 size={16} className="text-emerald-400" />
          <span>Web Portal ↔ Database ↔ Desktop Bot Sync Architecture</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.03] space-y-2">
            <span className="text-xs font-mono font-bold text-cyan-300 block">STEP 1: WEB STUDIO</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              User customizes visual avatar, tone sliders, voice pitch, and permissions. Generates unique 1-click token (e.g. `LUMI-8492`).
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] space-y-2">
            <span className="text-xs font-mono font-bold text-emerald-300 block">STEP 2: DATABASE STORAGE</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              JSON configurations are stored in PostgreSQL / Supabase `bot_profiles` table, indexed by `pairing_code` with RLS protection.
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/[0.03] space-y-2">
            <span className="text-xs font-mono font-bold text-purple-300 block">STEP 3: WINDOWS CLIENT CLAIM</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Desktop app receives pairing token via deep link `luminess://sync?code=...` or settings modal, hydrates local state, and starts companion!
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
