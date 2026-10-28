import React from 'react';
import { Terminal, HardDrive, Cpu, Download, Sparkles, SlidersHorizontal, Palette, Shield, Database } from 'lucide-react';
import { useLatestRelease } from '../lib/useLatestRelease.ts';

const GithubIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export type TabKey =
  | 'overview'
  | 'studio'
  | 'install'
  | 'releases'
  | 'croc'
  | 'admin'
  | 'database'
  | 'architecture'
  | 'dependencies';

interface NavbarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const { version } = useLatestRelease();

  const navItems: { key: TabKey; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: 'overview', label: 'Overview', icon: <Sparkles size={16} /> },
    { key: 'studio', label: 'Bot Studio', icon: <Palette size={16} />, badge: 'CREATOR' },
    { key: 'install', label: 'One-Click Install', icon: <Terminal size={16} /> },
    { key: 'releases', label: 'Downloads', icon: <Download size={16} /> },
    { key: 'croc', label: 'C.R.O.C.', icon: <SlidersHorizontal size={16} /> },
    { key: 'admin', label: 'Admin Control', icon: <Shield size={16} /> },
    { key: 'database', label: 'Database & Sync', icon: <Database size={16} /> },
    { key: 'architecture', label: 'Multi-AI Core', icon: <Cpu size={16} /> },
    { key: 'dependencies', label: 'Specs', icon: <HardDrive size={16} /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-[#08090e]/90 border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex h-20 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 2xl:px-8">
        
        {/* Brand / Logo */}
        <div 
          className="group flex shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap"
          onClick={() => onTabChange('overview')}
        >
          <div className="relative flex items-center justify-center p-1">
            <img 
              src="/robot-icon.svg" 
              alt="Luminess Assist Mascot" 
              className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_0_18px_rgba(0,240,255,0.6)] transition-transform duration-300 group-hover:scale-110 sm:h-11 sm:w-11"
            />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="whitespace-nowrap text-base font-extrabold tracking-tight text-white transition-colors group-hover:text-cyan-300 sm:text-lg">
                Luminess Assist
              </span>
              <span className="whitespace-nowrap rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-cyan-300">
                v{version}
              </span>
            </div>
            <p className="whitespace-nowrap font-mono text-[10px] tracking-wider text-slate-400 sm:text-[11px]">DESKTOP AI COMPANION</p>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <nav className="hidden min-w-0 shrink items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 xl:flex">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-200 cursor-pointer 2xl:px-3 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_18px_rgba(56,189,248,0.35)] font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span className={isActive ? 'text-cyan-300' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-1.5 py-0.2 text-[9px] font-mono font-bold text-cyan-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onTabChange('studio')}
            className="hidden sm:flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-2 font-mono text-xs font-semibold text-purple-300 transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.2)]"
          >
            <Palette size={14} className="text-purple-400" />
            <span>CUSTOMIZER</span>
          </button>

          <a
            href="https://github.com/jasonhukom/Luminess-Assist"
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-xs font-medium text-slate-300 transition-all duration-200 hover:bg-white/[0.08] hover:text-white"
          >
            <GithubIcon size={15} />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          <button
            type="button"
            onClick={() => onTabChange('install')}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-2.5 font-mono text-xs font-bold tracking-wide text-slate-950 shadow-[0_0_22px_rgba(56,189,248,0.45)] transition-all duration-200 hover:from-cyan-300 hover:to-blue-400 hover:shadow-[0_0_30px_rgba(56,189,248,0.7)] cursor-pointer"
          >
            <Terminal size={15} />
            <span>QUICK START</span>
          </button>
        </div>

      </div>

      {/* Mobile Tab Scrollbar */}
      <div className="flex xl:hidden overflow-x-auto px-4 py-2.5 gap-1.5 border-t border-white/[0.05] bg-[#07080d]">
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
              {item.badge && (
                <span className="ml-1 rounded bg-cyan-500/20 border border-cyan-400/30 px-1 text-[9px] text-cyan-300">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
