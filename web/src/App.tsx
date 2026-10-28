import React, { useState } from 'react';
import { Navbar, TabKey } from './components/Navbar.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { FeaturesBento } from './components/FeaturesBento.tsx';
import { InstallationTab } from './components/InstallationTab.tsx';
import { DependenciesTab } from './components/DependenciesTab.tsx';
import { ArchitectureTab } from './components/ArchitectureTab.tsx';
import { ReleasesTab } from './components/ReleasesTab.tsx';
import { CrocBuilderTab } from './components/CrocBuilderTab.tsx';
import { BotStudioTab } from './components/BotStudioTab.tsx';
import { AdminPanelTab } from './components/AdminPanelTab.tsx';
import { DatabaseSchemaTab } from './components/DatabaseSchemaTab.tsx';
import { useLatestRelease } from './lib/useLatestRelease.ts';
import { useTheme } from './lib/useTheme.ts';
import {
  getInitialPlatformState,
  savePlatformState,
  type PlatformState,
  type BotProfile,
  type AppRelease,
  type FeatureFlags,
  type GlobalConfigItem,
  type BotMemory,
} from './lib/botPlatformStore.ts';
import { ArrowUpRight, Heart, ShieldCheck, Terminal, Cpu } from 'lucide-react';

const GithubIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const { version, tagName } = useLatestRelease();
  const { theme, toggleTheme } = useTheme();
  const [platformState, setPlatformState] = useState<PlatformState>(getInitialPlatformState);

  const activeProfile = platformState.currentProfile;

  const handleUpdateProfile = (updated: BotProfile) => {
    setPlatformState((prev) => {
      const nextState: PlatformState = {
        ...prev,
        currentProfile: updated,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleUpdateReleases = (releases: AppRelease[]) => {
    setPlatformState((prev) => {
      const nextState: PlatformState = {
        ...prev,
        releases,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleUpdateFeatureFlags = (flags: FeatureFlags) => {
    setPlatformState((prev) => {
      const nextState: PlatformState = {
        ...prev,
        featureFlags: flags,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleUpdateGlobalConfig = (config: GlobalConfigItem[]) => {
    setPlatformState((prev) => {
      const nextState: PlatformState = {
        ...prev,
        globalConfig: config,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleUpdateMemories = (memories: BotMemory[]) => {
    setPlatformState((prev) => {
      const nextState: PlatformState = {
        ...prev,
        memories,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf9] text-[#080503] dark:bg-[#080503] dark:text-[#fafaf9] transition-colors duration-300">
      
      {/* Top Fixed Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 lg:px-8">
        
        {/* Overview Tab (Full Landing Page with Optimus Flow) */}
        {activeTab === 'overview' && (
          <div className="space-y-12">
            <HeroSection onNavigateTab={setActiveTab} />
            <FeaturesBento onNavigateTab={setActiveTab} />
            <InstallationTab />
            <DependenciesTab />
            <ReleasesTab />
          </div>
        )}

        {/* Dedicated Bot Studio */}
        {activeTab === 'studio' && activeProfile && (
          <div className="pt-24">
            <BotStudioTab
              profile={activeProfile}
              onUpdateProfile={handleUpdateProfile}
            />
          </div>
        )}

        {/* Dedicated Installation Guide */}
        {activeTab === 'install' && (
          <div className="pt-24">
            <InstallationTab />
          </div>
        )}

        {/* Dedicated Specs & Storage Breakdown */}
        {activeTab === 'dependencies' && (
          <div className="pt-24">
            <DependenciesTab />
          </div>
        )}

        {/* Dedicated Architecture & Multi-AI Core */}
        {activeTab === 'architecture' && (
          <div className="pt-24">
            <ArchitectureTab />
          </div>
        )}

        {/* Dedicated Downloads & Releases Vault */}
        {activeTab === 'releases' && (
          <div className="pt-24">
            <ReleasesTab />
          </div>
        )}

        {/* Dedicated C.R.O.C. System Prompt Studio */}
        {activeTab === 'croc' && (
          <div className="pt-24">
            <CrocBuilderTab />
          </div>
        )}

        {/* Admin Control Center */}
        {activeTab === 'admin' && (
          <div className="pt-24">
            <AdminPanelTab
              releases={platformState.releases}
              featureFlags={platformState.featureFlags}
              globalConfig={platformState.globalConfig}
              onUpdateReleases={handleUpdateReleases}
              onUpdateFeatureFlags={handleUpdateFeatureFlags}
              onUpdateGlobalConfig={handleUpdateGlobalConfig}
            />
          </div>
        )}

        {/* Database Schema & Sync Engine */}
        {activeTab === 'database' && (
          <div className="pt-24">
            <DatabaseSchemaTab
              platformState={platformState}
              onUpdateMemories={handleUpdateMemories}
              onUpdateGlobalConfig={handleUpdateGlobalConfig}
            />
          </div>
        )}

      </main>

      {/* =========================================================================
          OPTIMUS EDITORIAL FOOTER
         ========================================================================= */}
      <footer className="w-full border-t border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] mt-24 py-16">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-16 border-b border-[#dad7d0]/60 dark:border-white/10">
            
            {/* Col 1: Brand & Bio */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#080503] dark:bg-[#fafaf9] text-white dark:text-[#080503] flex items-center justify-center">
                  <img
                    src="/robot-icon.svg"
                    alt="Luminess Mascot"
                    className="w-4 h-4 object-contain filter invert dark:invert-0"
                  />
                </div>
                <span className="font-display font-bold text-lg text-[#080503] dark:text-[#fafaf9]">
                  Luminess Assist
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#5e534a] dark:text-[#a89c92]">
                  {tagName}
                </span>
              </div>
              <p className="text-sm text-[#5e534a] dark:text-[#a89c92] max-w-sm leading-relaxed">
                A living, lightweight AI desktop companion for Windows. Built natively in Rust and Tauri v2 with multi-model intelligence and zero background bloat.
              </p>
              <div className="pt-2">
                <a
                  href="https://github.com/jasonhukom/Luminess-Assist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#080503] dark:text-[#fafaf9] hover-underline"
                >
                  <GithubIcon size={14} />
                  <span>jasonhukom/Luminess-Assist</span>
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-3 font-mono text-xs">
              <span className="font-bold text-[#080503] dark:text-white uppercase tracking-wider block">
                Platform
              </span>
              <ul className="space-y-2 text-[#5e534a] dark:text-[#a89c92]">
                <li>
                  <button type="button" onClick={() => setActiveTab('overview')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    Overview
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('studio')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    Bot Studio (Creator)
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('install')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    One-Click Install
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('releases')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    Downloads &amp; Releases
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('croc')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    C.R.O.C. Prompt Studio
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Technical */}
            <div className="space-y-3 font-mono text-xs">
              <span className="font-bold text-[#080503] dark:text-white uppercase tracking-wider block">
                Architecture
              </span>
              <ul className="space-y-2 text-[#5e534a] dark:text-[#a89c92]">
                <li>
                  <button type="button" onClick={() => setActiveTab('architecture')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    Multi-AI Core
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('dependencies')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    Specs &amp; Storage Calculator
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('admin')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    Admin Control Center
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveTab('database')} className="hover:text-[#080503] dark:hover:text-white transition-colors">
                    Database Schema Explorer
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Ecosystem */}
            <div className="space-y-3 font-mono text-xs">
              <span className="font-bold text-[#080503] dark:text-white uppercase tracking-wider block">
                Ecosystem
              </span>
              <ul className="space-y-2 text-[#5e534a] dark:text-[#a89c92]">
                <li>
                  <a href="https://github.com/jasonhukom/Luminess-Assist/releases" target="_blank" rel="noopener noreferrer" className="hover:text-[#080503] dark:hover:text-white transition-colors flex items-center gap-1">
                    <span>GitHub Releases</span>
                    <ArrowUpRight size={11} />
                  </a>
                </li>
                <li>
                  <a href="https://tauri.app" target="_blank" rel="noopener noreferrer" className="hover:text-[#080503] dark:hover:text-white transition-colors flex items-center gap-1">
                    <span>Tauri 2 Runtime</span>
                    <ArrowUpRight size={11} />
                  </a>
                </li>
                <li>
                  <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#080503] dark:hover:text-white transition-colors flex items-center gap-1">
                    <span>Google AI Studio</span>
                    <ArrowUpRight size={11} />
                  </a>
                </li>
                <li>
                  <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#080503] dark:hover:text-white transition-colors flex items-center gap-1">
                    <span>Anthropic Console</span>
                    <ArrowUpRight size={11} />
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#5e534a] dark:text-[#a89c92] font-mono gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Windows 10/11 x64 Native &bull; Rust Core &bull; MIT License</span>
            </div>
            <div>
              <span>&copy; {new Date().getFullYear()} Luminess Assist &bull; Open Source Project</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

export default App;
