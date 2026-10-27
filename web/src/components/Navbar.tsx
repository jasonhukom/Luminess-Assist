import React from 'react';
import { Terminal, HardDrive, Cpu, Download, Sparkles } from 'lucide-react';

const GithubIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export type TabKey = 'overview' | 'install' | 'dependencies' | 'architecture' | 'releases';

interface NavbarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Sparkles size={15} /> },
    { key: 'install', label: 'One-Click Install', icon: <Terminal size={15} /> },
    { key: 'dependencies', label: 'Dependencies & Size', icon: <HardDrive size={15} /> },
    { key: 'architecture', label: 'Multi-AI Core', icon: <Cpu size={15} /> },
    { key: 'releases', label: 'Downloads', icon: <Download size={15} /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-[#08090e]/85 border-b border-cyan-500/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onTabChange('overview')}
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/20 via-purple-500/20 to-blue-600/20 p-0.5 border border-cyan-400/30 group-hover:border-cyan-300 transition-all duration-300 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
            <div className="w-full h-full bg-[#0a0d18] rounded-[10px] flex items-center justify-center">
              <span className="font-mono text-cyan-400 font-bold text-sm">LA</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                Luminess Assist
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                v1.1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-wider font-mono">DESKTOP AI COMPANION</p>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_18px_rgba(56,189,248,0.35)] font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span className={isActive ? 'text-cyan-300' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/jasonhukom/Luminess-Assist"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all duration-200"
          >
            <GithubIcon size={14} />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          <button
            type="button"
            onClick={() => onTabChange('install')}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold font-mono tracking-wide bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.45)] hover:shadow-[0_0_28px_rgba(56,189,248,0.7)] transition-all duration-200 cursor-pointer"
          >
            <Terminal size={14} />
            <span>QUICK START</span>
          </button>
        </div>

      </div>

      {/* Mobile Tab Scrollbar */}
      <div className="flex md:hidden overflow-x-auto px-4 py-2 gap-1 border-t border-white/[0.05] bg-[#07080d]">
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
