import React, { useState, useMemo } from 'react';
import { 
  HardDrive, 
  CheckSquare, 
  Square, 
  HelpCircle, 
  Zap, 
  Info, 
  Download, 
  Cpu, 
  CheckCircle2, 
  Layers,
  Sparkles
} from 'lucide-react';

interface DependencyItem {
  id: string;
  name: string;
  category: 'runtime' | 'system' | 'dev';
  description: string;
  downloadSizeMB: number;
  diskSizeMB: number;
  requiredFor: 'enduser' | 'dev';
  defaultOwned: boolean;
  notes: string;
}

const DEPENDENCY_ITEMS: DependencyItem[] = [
  {
    id: 'luminess-binary',
    name: 'Luminess Assist v1.1.0 (Desktop App)',
    category: 'runtime',
    description: 'The native compiled Tauri v2 / Rust executable and assets.',
    downloadSizeMB: 2.11,
    diskSizeMB: 9.5,
    requiredFor: 'enduser',
    defaultOwned: false,
    notes: 'Official release bundle compiled with profile [optimized].',
  },
  {
    id: 'webview2',
    name: 'Microsoft Edge WebView2 Evergreen',
    category: 'system',
    description: 'Native Windows OS web rendering runtime powering the UI.',
    downloadSizeMB: 150,
    diskSizeMB: 150,
    requiredFor: 'enduser',
    defaultOwned: true,
    notes: 'Already pre-installed on 99.2% of Windows 10 & 11 computers.',
  },
  {
    id: 'git',
    name: 'Git for Windows',
    category: 'dev',
    description: 'Version control CLI used to clone and pull project updates.',
    downloadSizeMB: 55,
    diskSizeMB: 320,
    requiredFor: 'dev',
    defaultOwned: true,
    notes: 'Only needed if you are developing or compiling from source.',
  },
  {
    id: 'nodejs',
    name: 'Node.js & npm (v20+ / v22+)',
    category: 'dev',
    description: 'JavaScript runtime for building React & Vite frontend modules.',
    downloadSizeMB: 32,
    diskSizeMB: 75,
    requiredFor: 'dev',
    defaultOwned: true,
    notes: 'Only needed for developer builds.',
  },
  {
    id: 'rust-toolchain',
    name: 'Rust & Cargo Toolchain (v1.90+)',
    category: 'dev',
    description: 'The Rust compiler and package manager powering Tauri backend.',
    downloadSizeMB: 180,
    diskSizeMB: 1200,
    requiredFor: 'dev',
    defaultOwned: false,
    notes: 'Only needed to build the native backend locally.',
  },
  {
    id: 'msvc-tools',
    name: 'Visual Studio C++ Build Tools',
    category: 'dev',
    description: 'Microsoft C++ linkers and Windows 10/11 SDK header libraries.',
    downloadSizeMB: 1500,
    diskSizeMB: 4500,
    requiredFor: 'dev',
    defaultOwned: false,
    notes: 'Required by Rust on Windows to link native .exe and .dll targets.',
  },
];

export const DependenciesTab: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<'enduser' | 'dev'>('enduser');
  const [ownedDependencies, setOwnedDependencies] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEPENDENCY_ITEMS.forEach((item) => {
      initial[item.id] = item.defaultOwned;
    });
    return initial;
  });

  const toggleOwned = (id: string) => {
    // Cannot toggle the main app itself as owned if you want to install it
    if (id === 'luminess-binary') return;
    setOwnedDependencies((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredItems = useMemo(() => {
    if (activeProfile === 'enduser') {
      return DEPENDENCY_ITEMS.filter((item) => item.requiredFor === 'enduser');
    }
    return DEPENDENCY_ITEMS;
  }, [activeProfile]);

  // Calculations
  const stats = useMemo(() => {
    let downloadRemainingMB = 0;
    let diskRemainingMB = 0;
    let totalAllDownloadMB = 0;
    let totalAllDiskMB = 0;

    filteredItems.forEach((item) => {
      totalAllDownloadMB += item.downloadSizeMB;
      totalAllDiskMB += item.diskSizeMB;

      const isOwned = ownedDependencies[item.id];
      if (!isOwned) {
        downloadRemainingMB += item.downloadSizeMB;
        diskRemainingMB += item.diskSizeMB;
      }
    });

    return {
      downloadRemainingMB: Number(downloadRemainingMB.toFixed(2)),
      diskRemainingMB: Number(diskRemainingMB.toFixed(1)),
      totalAllDownloadMB: Number(totalAllDownloadMB.toFixed(2)),
      totalAllDiskMB: Number(totalAllDiskMB.toFixed(1)),
    };
  }, [filteredItems, ownedDependencies]);

  const formatSize = (mb: number) => {
    if (mb >= 1000) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb} MB`;
  };

  return (
    <div className="py-8 space-y-10">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-mono">
          <HardDrive size={14} />
          <span>DISK SPACE &amp; DEPENDENCY CALCULATOR</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          How Big is Luminess Assist?
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Unlike heavy Electron apps that consume hundreds of megabytes, Luminess Assist is powered by 
          <strong className="text-cyan-300 font-semibold"> Tauri v2 + Rust</strong>. 
          Use the interactive table below to check what you already have and see your exact remaining download and disk size!
        </p>
      </div>

      {/* Profile Toggle (End-User vs Developer) */}
      <div className="flex justify-center">
        <div className="p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveProfile('enduser')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              activeProfile === 'enduser'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.3)] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap size={14} />
            <span>End-User Mode (Standard Installer)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveProfile('dev')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              activeProfile === 'dev'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-[0_0_16px_rgba(168,85,247,0.3)] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu size={14} />
            <span>Developer Mode (Compile From Source)</span>
          </button>
        </div>
      </div>

      {/* Dynamic Real-Time Metrics Bar */}
      <div className="max-w-4xl mx-auto">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-blue-950/40 border border-cyan-500/30 shadow-[0_0_35px_rgba(56,189,248,0.15)] grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          <div className="space-y-1">
            <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Download size={14} />
              DOWNLOAD NEEDED
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono text-glow-cyan">
              {formatSize(stats.downloadRemainingMB)}
            </div>
            <p className="text-[11px] text-slate-400">
              Payload to download over your network connection
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono text-purple-400 font-semibold tracking-wider flex items-center gap-1.5">
              <HardDrive size={14} />
              DISK FOOTPRINT
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono text-glow-purple">
              {formatSize(stats.diskRemainingMB)}
            </div>
            <p className="text-[11px] text-slate-400">
              Storage occupied on your local SSD/HDD
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
              <CheckCircle2 size={16} />
              <span>
                {stats.downloadRemainingMB <= 3
                  ? 'ULTRA COMPACT (READY IN SECONDS)'
                  : 'READY TO CONFIGURE'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-snug">
              {stats.downloadRemainingMB <= 3 ? (
                <>
                  Because you already have WebView2 on Windows, you only need to download 
                  <strong className="text-cyan-300"> 2.11 MB</strong>!
                </>
              ) : (
                'Select the dependencies you already have below to recalculate.'
              )}
            </p>
          </div>

        </div>
      </div>

      {/* Interactive Dependency Table */}
      <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-white/[0.1] bg-[#090b14]">
        
        <div className="px-6 py-4 bg-[#0d101d] border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white font-mono">
              DEPENDENCY CHECKLIST &amp; STORAGE MATRIX
            </h3>
            <p className="text-xs text-slate-400">
              Check off the software packages you currently have installed on your PC:
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/[0.05] text-slate-400 border border-white/[0.08]">
            {filteredItems.length} Components Listed
          </span>
        </div>

        <div className="divide-y divide-white/[0.06] overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-white/[0.02] text-slate-400 font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">I Have This</th>
                <th className="py-3 px-4">Package / Dependency</th>
                <th className="py-3 px-4">Download</th>
                <th className="py-3 px-4">Disk Space</th>
                <th className="py-3 px-4 hidden sm:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {filteredItems.map((item) => {
                const isOwned = ownedDependencies[item.id];
                const isLocked = item.id === 'luminess-binary';

                return (
                  <tr 
                    key={item.id}
                    onClick={() => !isLocked && toggleOwned(item.id)}
                    className={`transition-colors cursor-pointer ${
                      isOwned 
                        ? 'bg-emerald-950/15 hover:bg-emerald-950/25' 
                        : 'bg-white/[0.01] hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Checkbox Column */}
                    <td className="py-3.5 px-4">
                      {isLocked ? (
                        <div className="flex items-center gap-1.5 text-cyan-400" title="This is Luminess Assist itself!">
                          <Square size={18} className="text-slate-600" />
                          <span className="text-[10px] text-cyan-300 font-bold uppercase">To Install</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {isOwned ? (
                            <CheckSquare size={18} className="text-emerald-400" />
                          ) : (
                            <Square size={18} className="text-slate-500 hover:text-slate-300" />
                          )}
                          <span className={`text-[11px] ${isOwned ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                            {isOwned ? 'Installed' : 'Need it'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Name Column */}
                    <td className="py-3.5 px-4 font-sans font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.category === 'system' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            OS Built-in
                          </span>
                        )}
                        {item.category === 'dev' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Dev Tool
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-normal font-sans mt-0.5">
                        {item.description}
                      </p>
                    </td>

                    {/* Download Size */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={isOwned ? 'line-through text-slate-500' : 'text-cyan-300 font-bold'}>
                        {formatSize(item.downloadSizeMB)}
                      </span>
                    </td>

                    {/* Disk Space */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={isOwned ? 'line-through text-slate-500' : 'text-purple-300 font-bold'}>
                        {formatSize(item.diskSizeMB)}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 px-4 text-xs text-slate-400 font-sans hidden sm:table-cell">
                      {item.notes}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-4 bg-[#0a0d18] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="text-slate-400 flex items-center gap-2">
            <Info size={14} className="text-cyan-400" />
            <span>Click any row to toggle whether you already have that component.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span>
              Net Download: <strong className="text-cyan-300">{formatSize(stats.downloadRemainingMB)}</strong>
            </span>
            <span>
              Net Storage: <strong className="text-purple-300">{formatSize(stats.diskRemainingMB)}</strong>
            </span>
          </div>
        </div>

      </div>

      {/* Why Luminess is So Light Card */}
      <div className="max-w-4xl mx-auto p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
        <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
          <Sparkles size={18} className="text-cyan-400" />
          <span>WHY IS LUMINESS ASSIST ONLY 2.11 MB?</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <strong className="text-cyan-300 block mb-1">1. No Bundled Chromium</strong>
            Traditional desktop apps bundle an entire 150MB+ Chrome browser (Electron). Luminess leverages the evergreen Microsoft WebView2 already inside Windows.
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <strong className="text-purple-300 block mb-1">2. Native Rust Performance</strong>
            The backend engine is compiled directly to high-speed x64 machine code, avoiding heavy node runtime overhead and trimming idle memory down to ~30 MB RAM.
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <strong className="text-emerald-300 block mb-1">3. Optimized NSIS Compression</strong>
            The installer uses 7-Zip LZMA compression with stripped symbols to pack all robot assets into a 2-second download.
          </div>
        </div>
      </div>

    </div>
  );
};
