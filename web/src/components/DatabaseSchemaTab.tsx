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
  Server,
  Terminal,
  ExternalLink,
  Cpu,
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

const MARIADB_SCHEMA_DEFINITIONS = [
  {
    table: 'platform_users',
    desc: 'Registered user accounts, names, credentials, bio, and linked GitHub profile / repository.',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'VARCHAR(64)', nullable: false, pk: true, desc: 'Unique user identifier' },
      { name: 'username', type: 'VARCHAR(150)', nullable: false, desc: 'Unique account username' },
      { name: 'display_name', type: 'VARCHAR(150)', nullable: false, desc: 'Public display name' },
      { name: 'email', type: 'VARCHAR(254)', nullable: false, desc: 'Account email address' },
      { name: 'password_hash', type: 'VARCHAR(255)', nullable: false, desc: 'PBKDF2 SHA256 hashed password' },
      { name: 'role', type: "ENUM('admin', 'user')", nullable: false, desc: 'Account authorization level' },
      { name: 'bio', type: 'TEXT', nullable: true, desc: 'User profile bio description' },
      { name: 'avatar_url', type: 'TEXT', nullable: true, desc: 'Avatar image URL' },
      { name: 'github_username', type: 'VARCHAR(100)', nullable: true, desc: 'Connected GitHub account' },
      { name: 'github_repo_url', type: 'TEXT', nullable: true, desc: 'Forked repository URL' },
      { name: 'created_at', type: 'DATETIME', nullable: false, desc: 'Registration timestamp' },
    ],
  },
  {
    table: 'bot_profiles',
    desc: 'Custom user bots with images, per-frame sprite cycles, video loops, chat prompt, and GitHub fork link.',
    primaryKey: 'id',
    foreignKeys: [{ col: 'user_id', ref: 'platform_users(id)' }],
    columns: [
      { name: 'id', type: 'VARCHAR(64)', nullable: false, pk: true, desc: 'Unique bot profile ID' },
      { name: 'user_id', type: 'VARCHAR(64)', nullable: true, fk: true, desc: 'Creator account foreign key' },
      { name: 'bot_name', type: 'VARCHAR(100)', nullable: false, desc: 'Companion name' },
      { name: 'tagline', type: 'VARCHAR(255)', nullable: false, desc: 'Short description for showcase' },
      { name: 'is_active', type: 'TINYINT(1)', nullable: false, desc: 'Active desktop claim flag' },
      { name: 'is_public', type: 'TINYINT(1)', nullable: false, desc: 'Visible in Community Universe' },
      { name: 'pairing_code', type: 'VARCHAR(32)', nullable: false, desc: 'Unique desktop sync code' },
      { name: 'visual_mode', type: "ENUM('robot', 'sprite_frames', 'video', 'image', 'orb', 'vtuber')", nullable: false, desc: 'Visual engine type' },
      { name: 'avatar_image_url', type: 'TEXT', nullable: true, desc: 'Static image avatar' },
      { name: 'video_url', type: 'TEXT', nullable: true, desc: 'Animated MP4 / WebM video loop' },
      { name: 'frames_config', type: 'LONGTEXT', nullable: true, desc: 'JSON array of animation frame URLs & states' },
      { name: 'appearance_config', type: 'LONGTEXT', nullable: false, desc: 'JSON colors, scale, and accessories' },
      { name: 'greeting_message', type: 'TEXT', nullable: false, desc: 'Greeting message spoken on chat start' },
      { name: 'personality_config', type: 'LONGTEXT', nullable: false, desc: 'JSON archetype, prompt, humor, formality' },
      { name: 'voice_config', type: 'LONGTEXT', nullable: false, desc: 'JSON speech synthesis configuration' },
      { name: 'permissions', type: 'LONGTEXT', nullable: false, desc: 'JSON desktop automation capabilities' },
      { name: 'github_repo', type: 'VARCHAR(200)', nullable: true, desc: 'e.g. username/Luminess-Assist' },
      { name: 'forked_from', type: 'VARCHAR(200)', nullable: false, desc: 'Upstream base: jasonhukom/Luminess-Assist' },
      { name: 'likes_count', type: 'INT', nullable: false, desc: 'Community likes counter' },
      { name: 'created_at', type: 'DATETIME', nullable: false, desc: 'Creation timestamp' },
    ],
  },
  {
    table: 'bot_memories',
    desc: 'Persistent bot memory facts synchronized with desktop companion.',
    primaryKey: 'id',
    foreignKeys: [{ col: 'bot_profile_id', ref: 'bot_profiles(id)' }],
    columns: [
      { name: 'id', type: 'VARCHAR(64)', nullable: false, pk: true, desc: 'Unique memory record ID' },
      { name: 'bot_profile_id', type: 'VARCHAR(64)', nullable: false, fk: true, desc: 'Associated bot profile' },
      { name: 'memory_fact', type: 'TEXT', nullable: false, desc: 'Persistent learned user fact' },
      { name: 'category', type: "ENUM('preference', 'project', 'habit', 'hardware')", nullable: false, desc: 'Classification' },
      { name: 'created_at', type: 'DATETIME', nullable: false, desc: 'Memory creation timestamp' },
    ],
  },
  {
    table: 'app_releases',
    desc: 'OTA desktop updates, MSI release artifacts, and version changelogs.',
    primaryKey: 'version_id',
    columns: [
      { name: 'version_id', type: 'VARCHAR(32)', nullable: false, pk: true, desc: 'Semantic version tag (e.g. 1.1.2)' },
      { name: 'download_url', type: 'TEXT', nullable: false, desc: 'Binary artifact MSI download' },
      { name: 'release_notes', type: 'TEXT', nullable: false, desc: 'Changelog markdown' },
      { name: 'is_mandatory_update', type: 'TINYINT(1)', nullable: false, desc: 'Critical patch indicator' },
      { name: 'status', type: "ENUM('latest', 'beta', 'deprecated')", nullable: false, desc: 'Release tier' },
      { name: 'released_at', type: 'DATE', nullable: false, desc: 'Release date' },
    ],
  },
];

export const DatabaseSchemaTab: React.FC<DatabaseSchemaTabProps> = ({
  platformState,
  onUpdateMemories,
  onUpdateGlobalConfig,
}) => {
  const [selectedTable, setSelectedTable] = useState('bot_profiles');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const activeDef = MARIADB_SCHEMA_DEFINITIONS.find((t) => t.table === selectedTable) || MARIADB_SCHEMA_DEFINITIONS[1];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="relative pt-28 pb-20 px-6 max-w-[1400px] mx-auto min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-8 pb-6 border-b border-[#dad7d0]/60 dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-medium mb-3">
            <Database size={13} />
            <span>MariaDB 11.4 Engine &bull; Docker Compose &bull; Vercel Serverless</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#080503] dark:text-[#fafaf9]">
            MariaDB Database Architecture
          </h1>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] mt-1.5 max-w-2xl">
            Fully openable with Docker Compose on port 3306, with instant browser database management GUI on port 8080 (Adminer),
            and production-ready for Vercel serverless deployment.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="http://localhost:8080"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#080503] dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-md"
          >
            <ExternalLink size={13} />
            <span>Open Adminer GUI (Port 8080)</span>
          </a>
        </div>
      </div>

      {/* Deployment & Connection Quick Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        
        {/* Docker Compose Box */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#080503] dark:text-white mb-2">
              <Server size={15} className="text-[#38bdf8]" />
              <span>1. Run with Docker Compose</span>
            </div>
            <p className="text-xs text-[#5e534a] dark:text-[#a89c92] leading-relaxed mb-3">
              Spins up MariaDB 11.4, Adminer Web GUI, and Django Web server automatically with persistent storage.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-[11px] flex items-center justify-between text-[#080503] dark:text-white">
            <code>docker compose up -d</code>
            <button
              type="button"
              onClick={() => handleCopy('docker compose up -d', 'cmd1')}
              className="p-1 hover:text-[#38bdf8] cursor-pointer"
            >
              {copiedCmd === 'cmd1' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Direct MariaDB Connection */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#080503] dark:text-white mb-2">
              <Terminal size={15} className="text-purple-400" />
              <span>2. Direct MariaDB Access (Port 3306)</span>
            </div>
            <p className="text-xs text-[#5e534a] dark:text-[#a89c92] leading-relaxed mb-3">
              Connect from HeidiSQL, DBeaver, VS Code MySQL Extension, or command line.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-[11px] flex items-center justify-between text-[#080503] dark:text-white">
            <code className="truncate max-w-[200px]">mariadb -h 127.0.0.1 -P 3306 -u luminess -pluminess_pass luminess_db</code>
            <button
              type="button"
              onClick={() => handleCopy('mariadb -h 127.0.0.1 -P 3306 -u luminess -pluminess_pass luminess_db', 'cmd2')}
              className="p-1 hover:text-[#38bdf8] cursor-pointer"
            >
              {copiedCmd === 'cmd2' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Vercel Serverless Connection */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#080503] dark:text-white mb-2">
              <Cpu size={15} className="text-emerald-400" />
              <span>3. Vercel Serverless Config</span>
            </div>
            <p className="text-xs text-[#5e534a] dark:text-[#a89c92] leading-relaxed mb-3">
              Configure your cloud MariaDB / PlanetScale / Aiven connection string in Vercel project environment variables.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-[11px] flex items-center justify-between text-[#080503] dark:text-white">
            <code className="truncate max-w-[200px]">DATABASE_URL=mysql://user:pass@host:3306/db</code>
            <button
              type="button"
              onClick={() => handleCopy('DATABASE_URL=mysql://luminess:luminess_pass@your-mariadb-host:3306/luminess_db', 'cmd3')}
              className="p-1 hover:text-[#38bdf8] cursor-pointer"
            >
              {copiedCmd === 'cmd3' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* Schema Table Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Table Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] px-1">
            MariaDB Database Tables ({MARIADB_SCHEMA_DEFINITIONS.length})
          </span>
          {MARIADB_SCHEMA_DEFINITIONS.map((def) => {
            const isSelected = selectedTable === def.table;
            return (
              <button
                key={def.table}
                type="button"
                onClick={() => setSelectedTable(def.table)}
                className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#38bdf8] bg-white dark:bg-[#120f0d] shadow-sm'
                    : 'border-[#dad7d0] dark:border-white/10 hover:border-black/30 text-[#5e534a] dark:text-[#a89c92]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-[#080503] dark:text-white">
                    {def.table}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10">
                    {def.columns.length} cols
                  </span>
                </div>
                <p className="text-[11px] text-[#5e534a] dark:text-[#a89c92] line-clamp-2">
                  {def.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Column Detail Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#dad7d0]/60 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <Table size={16} className="text-[#38bdf8]" />
                <h3 className="font-mono text-base font-bold text-[#080503] dark:text-white">
                  {activeDef.table}
                </h3>
              </div>
              <p className="text-xs text-[#5e534a] dark:text-[#a89c92] mt-1">
                {activeDef.desc}
              </p>
            </div>

            <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              Primary Key: {activeDef.primaryKey}
            </span>
          </div>

          {/* Table Columns */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#dad7d0]/60 dark:border-white/10 font-mono text-[10px] uppercase text-[#5e534a] dark:text-[#a89c92]">
                  <th className="py-2.5 px-3">Column</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Attributes</th>
                  <th className="py-2.5 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dad7d0]/40 dark:divide-white/5 font-mono">
                {activeDef.columns.map((col: any) => (
                  <tr key={col.name} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#080503] dark:text-white">
                      {col.name}
                    </td>
                    <td className="py-2.5 px-3 text-[#38bdf8]">{col.type}</td>
                    <td className="py-2.5 px-3">
                      {col.pk && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold mr-1">
                          PK
                        </span>
                      )}
                      {col.fk && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold mr-1">
                          FK
                        </span>
                      )}
                      <span className="text-[10px] text-[#5e534a] dark:text-[#a89c92]">
                        {col.nullable ? 'NULL' : 'NOT NULL'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#5e534a] dark:text-[#a89c92] font-sans">
                      {col.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
