import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  CheckSquare,
  Square,
  Zap,
  Info,
  Download,
  Cpu,
  Layers,
  Sparkles,
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
    name: 'Luminess Assist (Desktop Binary)',
    category: 'runtime',
    description: 'The native compiled Tauri v2 / Rust executable and assets.',
    downloadSizeMB: 2.11,
    diskSizeMB: 9.5,
    requiredFor: 'enduser',
    defaultOwned: false,
    notes: 'Official release bundle compiled with [profile.release] lto = true.',
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

  const toggleDependency = (id: string) => {
    setOwnedDependencies((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const visibleItems = useMemo(() => {
    return DEPENDENCY_ITEMS.filter((item) => {
      if (activeProfile === 'enduser') {
        return item.requiredFor === 'enduser';
      }
      return true;
    });
  }, [activeProfile]);

  const stats = useMemo(() => {
    let totalDownloadMB = 0;
    let totalDiskMB = 0;

    visibleItems.forEach((item) => {
      const isOwned = ownedDependencies[item.id];
      if (!isOwned) {
        totalDownloadMB += item.downloadSizeMB;
        totalDiskMB += item.diskSizeMB;
      }
    });

    return {
      downloadMB: totalDownloadMB.toFixed(2),
      diskMB: totalDiskMB.toFixed(1),
    };
  }, [visibleItems, ownedDependencies]);

  return (
    <section className="py-16 lg:py-24 border-t border-[#dad7d0] dark:border-white/10">
      
      {/* Eyebrow & Header */}
      <div className="max-w-4xl mx-auto mb-16 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
          <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
            SPECIFICATIONS &amp; STORAGE CALCULATOR
          </span>
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
          Performance you can measure.
          <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
            Zero-bloat engineering.
          </span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-[#5e534a] dark:text-[#a89c92] max-w-2xl mx-auto leading-relaxed">
          Standard desktop assistants ship bundled Chromium engines taking hundreds of megabytes. 
          Luminess Assist reuses native Windows OS Webview2 APIs with an optimized Rust core.
        </p>
      </div>

      {/* Top 3 Metric Cards (Optimus Stat Grid) */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        
        <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] crosshair-corner">
          <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92] block mb-2 uppercase">
            Binary Size &bull; 87x Smaller
          </span>
          <div className="text-4xl lg:text-5xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
            2.11 MB
          </div>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
            Versus 185 MB for typical Electron-packaged companions. Downloads in less than a second on standard broadband.
          </p>
        </div>

        <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] crosshair-corner">
          <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92] block mb-2 uppercase">
            Idle Memory &bull; 7.6x Lighter
          </span>
          <div className="text-4xl lg:text-5xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
            41.8 MB
          </div>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
            Consumes under 50 MB RAM while idling on desktop, compared to 320 MB+ for Chrome background processes.
          </p>
        </div>

        <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] crosshair-corner">
          <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92] block mb-2 uppercase">
            Startup Latency &bull; 8x Faster
          </span>
          <div className="text-4xl lg:text-5xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
            180 ms
          </div>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
            Instant cold-start execution through compiled native Rust runtime hooks rather than heavy V8 engine bootstrapping.
          </p>
        </div>

      </div>

      {/* Interactive Calculator Section */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] shadow-sm space-y-8 crosshair-corner">
          
          {/* Profile Switcher */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-[#dad7d0]/60 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold text-[#080503] dark:text-[#fafaf9]">
                Storage Profile Estimator
              </h3>
              <p className="text-xs text-[#5e534a] dark:text-[#a89c92]">
                Toggle pre-installed components to calculate your exact download and disk delta.
              </p>
            </div>

            <div className="p-1 rounded-full border border-[#dad7d0] dark:border-white/10 bg-[#f3f2ee] dark:bg-[#171411] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveProfile('enduser')}
                className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                  activeProfile === 'enduser'
                    ? 'bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] font-semibold'
                    : 'text-[#5e534a] dark:text-[#a89c92]'
                }`}
              >
                Standard User
              </button>
              <button
                type="button"
                onClick={() => setActiveProfile('dev')}
                className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                  activeProfile === 'dev'
                    ? 'bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] font-semibold'
                    : 'text-[#5e534a] dark:text-[#a89c92]'
                }`}
              >
                Developer (Source Build)
              </button>
            </div>
          </div>

          {/* Current Calculation Readout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-xl border border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907]">
            <div>
              <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92] block uppercase">
                Estimated Download Needed
              </span>
              <div className="text-3xl font-mono font-bold text-[#080503] dark:text-[#fafaf9]">
                {stats.downloadMB} <span className="text-sm font-normal">MB</span>
              </div>
            </div>
            <div>
              <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92] block uppercase">
                Estimated Final Disk Footprint
              </span>
              <div className="text-3xl font-mono font-bold text-[#080503] dark:text-[#fafaf9]">
                {stats.diskMB} <span className="text-sm font-normal">MB</span>
              </div>
            </div>
          </div>

          {/* Component Checkboxes Table */}
          <div className="space-y-3">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] block">
              Toggle Components You Already Have Installed:
            </span>

            <div className="divide-y divide-[#dad7d0]/60 dark:divide-white/5 border-t border-b border-[#dad7d0]/60 dark:border-white/5">
              {visibleItems.map((item) => {
                const isOwned = ownedDependencies[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleDependency(item.id)}
                    className="py-3 flex items-start justify-between gap-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[#080503] dark:text-[#fafaf9]">
                        {isOwned ? <CheckSquare size={16} /> : <Square size={16} className="opacity-40" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isOwned ? 'line-through opacity-50' : 'text-[#080503] dark:text-[#fafaf9]'}`}>
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[#5e534a] dark:text-[#a89c92]">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-[#5e534a] dark:text-[#a89c92] mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono text-xs text-[#5e534a] dark:text-[#a89c92]">
                      <div>{item.downloadSizeMB} MB dl</div>
                      <div className="text-[10px] opacity-70">{item.diskSizeMB} MB disk</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

    </section>
  );
};
