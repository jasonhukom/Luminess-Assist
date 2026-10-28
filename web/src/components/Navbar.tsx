import React, { useState, useEffect } from 'react';
import { Download, Sun, Moon, ArrowUpRight, Menu, X, Sparkles, Terminal } from 'lucide-react';
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
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  theme = 'light',
  onToggleTheme,
}) => {
  const { version, exeAsset } = useLatestRelease();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems: { key: TabKey; label: string; badge?: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'studio', label: 'Bot Studio', badge: 'Creator' },
    { key: 'install', label: 'Installation' },
    { key: 'releases', label: 'Downloads' },
    { key: 'croc', label: 'C.R.O.C.' },
    { key: 'architecture', label: 'Multi-AI Core' },
    { key: 'dependencies', label: 'Specs' },
    { key: 'admin', label: 'Admin' },
    { key: 'database', label: 'Database' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#fafaf9]/90 dark:bg-[#080503]/90 backdrop-blur-md border-b border-[#dad7d0]/60 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
          : 'bg-transparent border-b border-[#dad7d0]/30 dark:border-white/5'
      }`}
    >
      <nav className="mx-auto max-w-[1400px] px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          
          {/* Brand Wordmark (Optimus Style) */}
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => {
              onTabChange('overview');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] transition-transform duration-300 group-hover:scale-105 shadow-sm">
              <img
                src="/robot-icon.svg"
                alt="Luminess Mascot"
                className="w-5 h-5 object-contain filter invert dark:invert-0"
              />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
                Luminess
              </span>
              <span className="text-[10px] font-mono font-medium text-[#5e534a] dark:text-[#a89c92] tracking-wider uppercase">
                v{version}
              </span>
            </div>
          </div>

          {/* Desktop Horizontal Navigation Links */}
          <div className="hidden xl:flex items-center gap-7">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTabChange(item.key)}
                  className={`relative text-sm tracking-tight transition-colors duration-200 cursor-pointer py-1 group flex items-center gap-1.5 ${
                    isActive
                      ? 'text-[#080503] dark:text-[#fafaf9] font-semibold'
                      : 'text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-[#fafaf9]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-[#080503]/5 dark:bg-white/10 px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-wider text-[#080503] dark:text-[#fafaf9]">
                      {item.badge}
                    </span>
                  )}
                  {/* Optimus Animated Slide-in Underline */}
                  <span
                    className={`absolute -bottom-1 left-0 h-[1.5px] bg-[#080503] dark:bg-[#fafaf9] transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Controls & CTAs */}
          <div className="flex items-center gap-3">
            
            {/* Theme Toggle (Light / Dark) */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="w-9 h-9 rounded-full flex items-center justify-center border border-[#dad7d0] dark:border-white/10 text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-white hover:bg-[#080503]/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}

            {/* GitHub Repo Link */}
            <a
              href="https://github.com/jasonhukom/Luminess-Assist"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 h-9 px-3.5 rounded-full border border-[#dad7d0] dark:border-white/15 text-xs font-mono font-medium text-[#080503] dark:text-[#fafaf9] hover:bg-[#080503]/5 dark:hover:bg-white/10 transition-all"
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
              <ArrowUpRight size={12} className="opacity-60" />
            </a>

            {/* Solid Pill CTA Button (Optimus signature) */}
            <a
              href={exeAsset.url}
              className="flex items-center gap-2 h-9 px-4 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] hover:opacity-90 transition-all font-mono text-xs font-semibold tracking-tight shadow-sm cursor-pointer"
            >
              <Download size={13} />
              <span>DOWNLOAD</span>
            </a>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden w-9 h-9 rounded-full flex items-center justify-center border border-[#dad7d0] dark:border-white/10 text-[#080503] dark:text-[#fafaf9] cursor-pointer"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] py-4 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onTabChange(item.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                    isActive
                      ? 'bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] font-medium'
                      : 'text-[#5e534a] dark:text-[#a89c92] hover:bg-[#080503]/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="pt-3 border-t border-[#dad7d0]/40 dark:border-white/10 flex items-center justify-between px-3">
              <a
                href="https://github.com/jasonhukom/Luminess-Assist"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-[#5e534a] dark:text-[#a89c92]"
              >
                <GithubIcon size={14} />
                <span>jasonhukom/Luminess-Assist</span>
              </a>
              <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">v{version}</span>
            </div>
          </div>
        )}

      </nav>
    </header>
  );
};
