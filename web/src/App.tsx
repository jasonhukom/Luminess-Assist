import React, { useState } from 'react';
import { Navbar, TabKey } from './components/Navbar.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { InstallationTab } from './components/InstallationTab.tsx';
import { DependenciesTab } from './components/DependenciesTab.tsx';
import { ArchitectureTab } from './components/ArchitectureTab.tsx';
import { ReleasesTab } from './components/ReleasesTab.tsx';
import { CrocBuilderTab } from './components/CrocBuilderTab.tsx';
import { Sparkles, Heart, Terminal, HardDrive, Cpu, Download } from 'lucide-react';
import { useLatestRelease } from './lib/useLatestRelease.ts';

const GithubIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const { version } = useLatestRelease();

  return (
    <div className="min-h-screen flex flex-col bg-[#06070a] text-slate-100 cyber-grid relative selection:bg-cyan-500/25 selection:text-cyan-200">
      
      {/* Ambient Top Glow Orbs */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-cyan-500/10 via-purple-600/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Navbar */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-10">
        
        {/* Render Tab based on state */}
        {activeTab === 'overview' && (
          <div className="space-y-16">
            <HeroSection onNavigateTab={setActiveTab} />
            <InstallationTab />
            <DependenciesTab />
          </div>
        )}

        {activeTab === 'install' && (
          <InstallationTab />
        )}

        {activeTab === 'dependencies' && (
          <DependenciesTab />
        )}

        {activeTab === 'architecture' && (
          <ArchitectureTab />
        )}

        {activeTab === 'releases' && (
          <ReleasesTab />
        )}

        {activeTab === 'croc' && (
          <CrocBuilderTab />
        )}

      </main>

      {/* Futuristic Cyber Footer */}
      <footer className="w-full border-t border-white/[0.08] bg-[#07080f]/90 backdrop-blur-xl mt-20 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/[0.06]">
            
            {/* Col 1: Brand */}
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <img 
                  src="/robot-icon.svg" 
                  alt="Luminess Assist Mascot" 
                  className="w-7 h-7 object-contain filter drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]"
                />
                <span className="font-bold text-white text-base">Luminess Assist</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
                  v{version}
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                A living, lightweight AI mascot for Windows desktops. Powered by Tauri v2, Rust, and multi-model AI routing with zero background bloat.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="https://github.com/jasonhukom/Luminess-Assist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
                >
                  <GithubIcon size={14} />
                  <span>jasonhukom/Luminess-Assist</span>
                </a>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-2.5">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                Quick Navigation
              </span>
              <ul className="space-y-1.5 text-xs text-slate-400 font-mono">
                <li>
                  <button type="button" onClick={() => setActiveTab('overview')} className="hover:text-cyan-300 transition-colors">
                    &gt; Overview &amp; Mascot
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('install')} className="hover:text-cyan-300 transition-colors">
                    &gt; One-Click PowerShell
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('dependencies')} className="hover:text-cyan-300 transition-colors">
                    &gt; Storage Calculator
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('architecture')} className="hover:text-cyan-300 transition-colors">
                    &gt; Multi-AI Core
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('croc')} className="hover:text-cyan-300 transition-colors">
                    &gt; C.R.O.C. Web Builder
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Resources */}
            <div className="space-y-2.5">
              <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider block">
                Resources
              </span>
              <ul className="space-y-1.5 text-xs text-slate-400 font-mono">
                <li>
                  <a href="https://github.com/jasonhukom/Luminess-Assist/releases" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition-colors">
                    &gt; GitHub Releases
                  </a>
                </li>
                <li>
                  <a href="https://tauri.app" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition-colors">
                    &gt; Tauri 2 Docs
                  </a>
                </li>
                <li>
                  <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition-colors">
                    &gt; Google AI Studio
                  </a>
                </li>
                <li>
                  <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="hover:text-purple-300 transition-colors">
                    &gt; Anthropic Console
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
            <div className="flex items-center gap-1.5">
              <span>Crafted for Windows with</span>
              <Heart size={13} className="text-pink-500 fill-current animate-pulse" />
              <span>and Rust</span>
            </div>
            <div>
              <span>Luminess Assist &bull; Open Source under MIT</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

export default App;
