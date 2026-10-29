import React, { useState, useEffect } from 'react';
import { Navbar, TabKey } from './components/Navbar.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { FeaturesBento } from './components/FeaturesBento.tsx';
import { InstallationTab } from './components/InstallationTab.tsx';
import { DocumentationTab } from './components/DocumentationTab.tsx';
import { DependenciesTab } from './components/DependenciesTab.tsx';
import { ArchitectureTab } from './components/ArchitectureTab.tsx';
import { ReleasesTab } from './components/ReleasesTab.tsx';
import { CommunityBotTab } from './components/CommunityBotTab.tsx';
import { CommunityBotsOverview } from './components/CommunityBotsOverview.tsx';
import { DatabaseSchemaTab } from './components/DatabaseSchemaTab.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { useLatestRelease } from './lib/useLatestRelease.ts';
import { useTheme } from './lib/useTheme.ts';
import {
  getInitialPlatformState,
  savePlatformState,
  fetchPlatformStateFromBackend,
  type PlatformState,
  type BotProfile,
  type PlatformUser,
} from './lib/botPlatformStore.ts';
import { ArrowUpRight } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const { version, tagName } = useLatestRelease();
  const { theme, toggleTheme } = useTheme();
  const [platformState, setPlatformState] = useState<PlatformState>(getInitialPlatformState);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Sync state with Django MariaDB database on initial mount
  useEffect(() => {
    fetchPlatformStateFromBackend().then((remoteState) => {
      if (remoteState) {
        setPlatformState((prev) => ({
          ...prev,
          currentProfile: remoteState.currentProfile || prev.currentProfile,
          communityBots: remoteState.communityBots && remoteState.communityBots.length > 0 ? remoteState.communityBots : prev.communityBots,
          featureFlags: remoteState.featureFlags || prev.featureFlags,
          releases: remoteState.releases || prev.releases,
          globalConfig: remoteState.globalConfig || prev.globalConfig,
          users: remoteState.users || prev.users,
          memories: remoteState.memories || prev.memories,
        }));
      }
    });
  }, []);

  const handleUpdateProfile = (updated: BotProfile) => {
    setPlatformState((prev) => {
      const nextBots = prev.communityBots.map((b) => (b.id === updated.id ? updated : b));
      if (!nextBots.some((b) => b.id === updated.id)) {
        nextBots.unshift(updated);
      }
      const nextState: PlatformState = {
        ...prev,
        currentProfile: updated,
        communityBots: nextBots,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleSavedToCommunity = (savedBot: BotProfile) => {
    setPlatformState((prev) => {
      const nextBots = [savedBot, ...prev.communityBots.filter((b) => b.id !== savedBot.id)];
      const nextState: PlatformState = {
        ...prev,
        currentProfile: savedBot,
        communityBots: nextBots,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleUpdateBotLikes = (botId: string, newCount: number) => {
    setPlatformState((prev) => {
      const nextBots = prev.communityBots.map((b) =>
        b.id === botId ? { ...b, likesCount: newCount } : b
      );
      const nextState: PlatformState = { ...prev, communityBots: nextBots };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleCreateNewBot = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'LUMI-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newBot: BotProfile = {
      id: `bot_${Date.now().toString(36)}`,
      userId: platformState.currentUser?.id || 'usr_01jk984',
      creator: platformState.currentUser ? {
        id: platformState.currentUser.id,
        username: platformState.currentUser.username,
        displayName: platformState.currentUser.displayName,
        avatarUrl: platformState.currentUser.avatarUrl,
        githubUsername: platformState.currentUser.githubUsername,
        githubRepoUrl: platformState.currentUser.githubRepoUrl,
      } : undefined,
      botName: 'New Custom Bot',
      tagline: 'Custom desktop companion created on Luminess Studio',
      isActive: false,
      isPublic: true,
      pairingCode: code,
      visualMode: 'robot',
      avatarImageUrl: '',
      videoUrl: '',
      framesConfig: [],
      appearance: {
        model: 'robot',
        color: '#38bdf8',
        paletteName: 'Cyber Cyan',
        accessory: 'headphones',
        scale: 1.0,
      },
      greetingMessage: 'Hello Pilot! I am ready to assist your productivity.',
      personality: {
        botName: 'New Custom Bot',
        userName: 'Pilot',
        archetype: 'witty_hacker',
        formality: 3,
        humor: 8,
        verbosity: 4,
        customPrompt: 'Focus on snappy desktop automation and friendly productivity reminders.',
      },
      voice: {
        voiceId: 'luna-neural',
        voiceName: 'Luna Neural',
        pitch: 1.05,
        speed: 1.0,
      },
      permissions: {
        canOpenApps: true,
        canSortFiles: true,
        canReadClipboard: false,
        canWriteClipboard: true,
        canReadSystemStats: true,
        canExecuteCommands: false,
        canSetTimers: true,
      },
      githubRepo: `${platformState.currentUser?.githubUsername || 'user'}/Luminess-Assist`,
      githubRepoUrl: `https://github.com/${platformState.currentUser?.githubUsername || 'user'}/Luminess-Assist`,
      forkedFrom: 'jasonhukom/Luminess-Assist',
      githubBranch: 'main',
      githubSyncStatus: 'synced',
      likesCount: 0,
      viewsCount: 1,
      createdAt: new Date().toISOString().split('T')[0],
    };

    handleUpdateProfile(newBot);
    setActiveTab('community');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectBotForStudio = (bot: BotProfile) => {
    handleUpdateProfile(bot);
    setActiveTab('community');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (user: PlatformUser) => {
    setPlatformState((prev) => {
      const nextUsers = prev.users.some((u) => u.id === user.id)
        ? prev.users.map((u) => (u.id === user.id ? user : u))
        : [user, ...prev.users];
      const nextState: PlatformState = {
        ...prev,
        currentUser: user,
        users: nextUsers,
      };
      savePlatformState(nextState);
      return nextState;
    });
  };

  const handleLogout = () => {
    setPlatformState((prev) => {
      const nextState: PlatformState = {
        ...prev,
        currentUser: null,
      };
      savePlatformState(nextState);
      return nextState;
    });
    setProfileModalOpen(false);
  };

  const userBots = platformState.currentUser
    ? platformState.communityBots.filter(
        (b) =>
          b.userId === platformState.currentUser?.id ||
          b.creator?.username === platformState.currentUser?.username
      )
    : [];

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
        currentUser={platformState.currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      {/* Main Tab Routing */}
      <main className="flex-1">
        
        {/* Overview Tab (Full Landing Page with Optimus Flow + Community Bot Showcase + Big Button) */}
        {activeTab === 'overview' && (
          <div className="space-y-16">
            <HeroSection onNavigateTab={setActiveTab} />
            <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
              <CommunityBotsOverview
                onNavigateTab={setActiveTab}
                onAdoptBot={handleUpdateProfile}
              />
            </div>
            <FeaturesBento onNavigateTab={setActiveTab} />
            <InstallationTab />
            <DependenciesTab />
            <ReleasesTab />
          </div>
        )}

        {/* Dedicated Community Bot Hub Page */}
        {activeTab === 'community' && (
          <div className="pt-24 max-w-[1400px] mx-auto px-6 lg:px-8">
            <CommunityBotTab
              onAdoptBot={handleUpdateProfile}
              onNavigateTab={setActiveTab}
            />
          </div>
        )}

        {/* MariaDB Database Architecture & Docker Compose Monitor */}
        {activeTab === 'database' && (
          <DatabaseSchemaTab
            platformState={platformState}
            onUpdateMemories={(memories) => {
              setPlatformState((prev) => {
                const nextState = { ...prev, memories };
                savePlatformState(nextState);
                return nextState;
              });
            }}
            onUpdateGlobalConfig={(config) => {
              setPlatformState((prev) => {
                const nextState = { ...prev, globalConfig: config };
                savePlatformState(nextState);
                return nextState;
              });
            }}
          />
        )}

        {/* Installation and Downloads share one dedicated destination */}
        {activeTab === 'install' && (
          <div className="pt-24">
            <InstallationTab />
            <div id="downloads" className="scroll-mt-24">
              <ReleasesTab />
            </div>
          </div>
        )}

        {/* Dedicated Documentation */}
        {activeTab === 'docs' && (
          <div className="pt-24">
            <DocumentationTab onNavigateTab={setActiveTab} />
          </div>
        )}

        {/* Dedicated Architecture & Multi-AI Core */}
        {activeTab === 'architecture' && (
          <div className="pt-24">
            <ArchitectureTab />
          </div>
        )}

      </main>

      {/* Auth Modal (Sign Up & Login) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* User Profile Modal (like GitHub profile / Vercel projects view) */}
      <UserProfileModal
        user={platformState.currentUser}
        userBots={userBots}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onLogout={handleLogout}
        onCreateNewBot={handleCreateNewBot}
        onSelectBot={handleSelectBotForStudio}
      />

      {/* Editorial Footer */}
      <footer className="w-full border-t border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] mt-24 py-16">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-16 border-b border-[#dad7d0]/60 dark:border-white/10">
            
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
                Autonomous AI desktop companion connected to MariaDB, Docker Compose, Vercel, and GitHub repository fork synchronization.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#080503] dark:text-[#fafaf9] font-bold mb-4">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs text-[#5e534a] dark:text-[#a89c92]">
                <li><button type="button" onClick={() => setActiveTab('community')} className="hover:underline cursor-pointer">Explore Community Bots</button></li>
                <li><button type="button" onClick={() => setActiveTab('install')} className="hover:underline cursor-pointer">One-Click Install</button></li>
                <li><button type="button" onClick={() => setActiveTab('database')} className="hover:underline cursor-pointer">MariaDB Schema & Docker</button></li>
                <li><button type="button" onClick={() => setActiveTab('docs')} className="hover:underline cursor-pointer">Documentation</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#080503] dark:text-[#fafaf9] font-bold mb-4">
                GitHub Network
              </h4>
              <ul className="space-y-2.5 text-xs text-[#5e534a] dark:text-[#a89c92]">
                <li><a href="https://github.com/jasonhukom/Luminess-Assist" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">Upstream Repo <ArrowUpRight size={11} /></a></li>
                <li><a href="https://github.com/jasonhukom/Luminess-Assist/fork" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">Fork Template <ArrowUpRight size={11} /></a></li>
                <li><a href="https://github.com/jasonhukom/Luminess-Assist/releases" target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">GitHub Releases <ArrowUpRight size={11} /></a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#080503] dark:text-[#fafaf9] font-bold mb-4">
                Infrastructure
              </h4>
              <ul className="space-y-2.5 text-xs text-[#5e534a] dark:text-[#a89c92]">
                <li>MariaDB 11.4 Engine</li>
                <li>Adminer Web GUI (Port 8080)</li>
                <li>Docker & Docker Compose</li>
                <li>Vercel Serverless Ready</li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
            <p>&copy; {new Date().getFullYear()} Luminess Assist. Open source under MIT License.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                MariaDB Engine Online
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
