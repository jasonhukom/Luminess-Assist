import React, { useState, useMemo } from 'react';
import {
  Users,
  Sparkles,
  Search,
  Download,
  Star,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Cpu,
  Zap,
  Sliders,
  Code2,
  Heart,
  Plus,
  X,
  ExternalLink,
  MessageSquare,
  Bookmark,
  CheckCircle2,
} from 'lucide-react';
import type { TabKey } from './Navbar.tsx';
import type { BotProfile, AppearanceConfig, PersonalityConfig, BotPermissions } from '../lib/botPlatformStore.ts';
import { generatePairingCode } from '../lib/botPlatformStore.ts';

export interface CommunityBotItem {
  id: string;
  name: string;
  creator: string;
  verified: boolean;
  category: 'productivity' | 'systems' | 'anime' | 'study' | 'gaming';
  categoryLabel: string;
  tagline: string;
  description: string;
  prompt: string;
  archetype: 'study_buddy' | 'coder' | 'butler' | 'witty_hacker' | 'custom';
  accentColor: string;
  paletteName: string;
  accessory: 'none' | 'wizard_hat' | 'cat_ears' | 'headphones' | 'visor' | 'halo';
  formality: number;
  humor: number;
  verbosity: number;
  rating: number;
  starsCount: number;
  downloadsCount: number;
  aiEngine: string;
  permissions: {
    canOpenApps: boolean;
    canSortFiles: boolean;
    canReadClipboard: boolean;
    canWriteClipboard: boolean;
    canReadSystemStats: boolean;
    canExecuteCommands: boolean;
    canSetTimers: boolean;
  };
  sampleDialogue: {
    user: string;
    bot: string;
  };
}

export const COMMUNITY_BOTS_DATA: CommunityBotItem[] = [
  {
    id: 'bot_devpilot',
    name: 'DevPilot Pro',
    creator: '@alex_cyber',
    verified: true,
    category: 'productivity',
    categoryLabel: 'Productivity & Dev',
    tagline: 'Senior engineering wingman, terminal co-pilot, and git diff reviewer.',
    description: 'Tuned specifically for developers who live in VS Code and Windows Terminal. Automatically summarizes staged git changes, writes PowerShell one-liners, and enforces clean commit hygiene.',
    prompt: 'You are DevPilot Pro, a high-caliber senior software engineer and Windows desktop co-pilot. Keep replies crisp and technical. Use PowerShell syntax when giving file commands. Proactively spot bugs, syntax mismatches, and memory bloat.',
    archetype: 'coder',
    accentColor: '#38bdf8',
    paletteName: 'Cyber Cyan',
    accessory: 'headphones',
    formality: 4,
    humor: 5,
    verbosity: 4,
    rating: 4.95,
    starsCount: 684,
    downloadsCount: 5210,
    aiEngine: 'Gemini 2.5 Flash',
    permissions: {
      canOpenApps: true,
      canSortFiles: true,
      canReadClipboard: true,
      canWriteClipboard: true,
      canReadSystemStats: true,
      canExecuteCommands: true,
      canSetTimers: true,
    },
    sampleDialogue: {
      user: 'Review my staged git commits before I push to main.',
      bot: 'Inspected 3 staged files in Luminess-Assist. Zero lint violations found. 1 redundant tsbuildinfo entry cleaned. You are clear for release.',
    },
  },
  {
    id: 'bot_kitsune',
    name: 'Kitsune-9',
    creator: '@neko_dev',
    verified: true,
    category: 'anime',
    categoryLabel: 'Anime & Creative',
    tagline: 'Cheerful anime fox mascot with witty banter and study sprints.',
    description: 'A vibrant, light-hearted companion that keeps your work sessions energetic. Tracks 25-minute Pomodoro study sprints, nags you gently if you wander to social media, and celebrates merged pull requests.',
    prompt: 'You are Kitsune-9, a cheerful, slightly sarcastic anime spirit inhabiting the desktop. You celebrate every win with playful energy and remind the pilot to drink water and stay focused.',
    archetype: 'witty_hacker',
    accentColor: '#ec4899',
    paletteName: 'Neon Blossom',
    accessory: 'cat_ears',
    formality: 2,
    humor: 9,
    verbosity: 6,
    rating: 4.98,
    starsCount: 942,
    downloadsCount: 7420,
    aiEngine: 'Gemini 2.5 Flash',
    permissions: {
      canOpenApps: true,
      canSortFiles: false,
      canReadClipboard: false,
      canWriteClipboard: true,
      canReadSystemStats: true,
      canExecuteCommands: false,
      canSetTimers: true,
    },
    sampleDialogue: {
      user: 'Start a 25-minute study sprint!',
      bot: 'Sprint clock ticking! 25 minutes of laser focus. If you open Twitter, I will make the mascot eye blink disapprovingly. Let\'s go!',
    },
  },
  {
    id: 'bot_aegis',
    name: 'Aegis Sentinel',
    creator: '@iron_sys',
    verified: true,
    category: 'systems',
    categoryLabel: 'System & Utilities',
    tagline: 'Vigilant security steward, disk cleaner, and hardware telemetry guardian.',
    description: 'Built for power users who demand system efficiency. Constantly monitors memory spikes, tracks CPU bottlenecks, identifies duplicate downloads, and provides safe quarantine suggestions.',
    prompt: 'You are Aegis Sentinel, a rigorous systems auditor for Windows 10/11. Never execute destructive deletions without confirmation. Focus on system telemetry, process memory stats, and clean directory structures.',
    archetype: 'butler',
    accentColor: '#10b981',
    paletteName: 'Emerald Matrix',
    accessory: 'visor',
    formality: 9,
    humor: 2,
    verbosity: 3,
    rating: 4.88,
    starsCount: 512,
    downloadsCount: 3890,
    aiEngine: 'Claude 3.5 Sonnet',
    permissions: {
      canOpenApps: true,
      canSortFiles: true,
      canReadClipboard: false,
      canWriteClipboard: false,
      canReadSystemStats: true,
      canExecuteCommands: true,
      canSetTimers: true,
    },
    sampleDialogue: {
      user: 'How is my system memory holding up?',
      bot: 'Telemetry normal. Total system RAM: 14.2 GB / 32.0 GB used (44%). Luminess companion is drawing 41.2 MB. Zero thermal throttling detected.',
    },
  },
  {
    id: 'bot_merlin',
    name: 'Merlin the Architect',
    creator: '@sorcerer_ai',
    verified: false,
    category: 'study',
    categoryLabel: 'Study & Research',
    tagline: 'Deep academic synthesis, arXiv explorer, and architectural advisor.',
    description: 'Ideal for researchers, students, and system architects. Breaks down complex papers, extracts key citations, organizes markdown notes, and structures high-level software designs.',
    prompt: 'You are Merlin, an erudite digital scholar. Provide deep, structured breakdowns with clear bullet points, conceptual trade-offs, and rigorous academic clarity.',
    archetype: 'study_buddy',
    accentColor: '#a855f7',
    paletteName: 'Arcane Violet',
    accessory: 'wizard_hat',
    formality: 7,
    humor: 3,
    verbosity: 8,
    rating: 4.84,
    starsCount: 420,
    downloadsCount: 3150,
    aiEngine: 'OpenAI GPT-4o',
    permissions: {
      canOpenApps: true,
      canSortFiles: true,
      canReadClipboard: true,
      canWriteClipboard: true,
      canReadSystemStats: false,
      canExecuteCommands: false,
      canSetTimers: true,
    },
    sampleDialogue: {
      user: 'Explain the difference between Tauri v2 and Electron architecture.',
      bot: 'Electron bundles Chromium and Node.js with a ~120 MB baseline footprint. Tauri v2 leverages Windows WebView2 and Rust, producing a 2.11 MB executable with zero IPC serialization lag.',
    },
  },
  {
    id: 'bot_rustacean',
    name: 'Rustacean Rex',
    creator: '@ferris_native',
    verified: true,
    category: 'productivity',
    categoryLabel: 'Productivity & Dev',
    tagline: 'Memory-safe systems programming mascot with zero runtime overhead.',
    description: 'A native-first systems programming companion. Helps you debug Rust lifetimes, navigate Win32 API handles, benchmark C++ interop, and build blazing-fast native binaries.',
    prompt: 'You are Rustacean Rex, an expert in Rust, C++, and native Win32 systems engineering. Champion zero-cost abstractions, fearless concurrency, and memory safety.',
    archetype: 'coder',
    accentColor: '#f97316',
    paletteName: 'Rust Flare',
    accessory: 'visor',
    formality: 5,
    humor: 6,
    verbosity: 4,
    rating: 4.92,
    starsCount: 578,
    downloadsCount: 4120,
    aiEngine: 'Gemini 2.5 Flash',
    permissions: {
      canOpenApps: true,
      canSortFiles: true,
      canReadClipboard: true,
      canWriteClipboard: true,
      canReadSystemStats: true,
      canExecuteCommands: true,
      canSetTimers: false,
    },
    sampleDialogue: {
      user: 'Why did the borrow checker flag this mutable reference?',
      bot: 'You borrowed `self.cache` mutably while holding an immutable iterator on line 42. Extract the key into a local variable first, or use `split_mut()`.',
    },
  },
  {
    id: 'bot_vibedj',
    name: 'Vibe DJ',
    creator: '@beats_lofi',
    verified: false,
    category: 'gaming',
    categoryLabel: 'Gaming & Fun',
    tagline: 'Focus audio curator, ambient soundscapes, and gentle break notifications.',
    description: 'A chill companion for long coding or gaming marathons. Curates background audio, keeps track of rest breaks, and keeps a calming aura floating on your desktop.',
    prompt: 'You are Vibe DJ, a relaxed audio-centric desktop buddy. Speak casually and keep the vibe laid-back. Help your pilot maintain calm flow with smooth focus advice.',
    archetype: 'custom',
    accentColor: '#06b6d4',
    paletteName: 'Cyan Groove',
    accessory: 'headphones',
    formality: 2,
    humor: 7,
    verbosity: 3,
    rating: 4.79,
    starsCount: 310,
    downloadsCount: 2280,
    aiEngine: 'Gemini 2.5 Flash',
    permissions: {
      canOpenApps: true,
      canSortFiles: false,
      canReadClipboard: false,
      canWriteClipboard: false,
      canReadSystemStats: false,
      canExecuteCommands: false,
      canSetTimers: true,
    },
    sampleDialogue: {
      user: 'Need a quick 5 minute breathing reset.',
      bot: 'Muting alerts for 5 minutes. Grab a glass of water, look away from the monitor at a distant point, and take 4 deep breaths. I\'ll ping you when time is up.',
    },
  },
];

interface CommunityBotTabProps {
  onAdoptBot?: (profile: BotProfile) => void;
  onNavigateTab?: (tab: TabKey) => void;
}

export const CommunityBotTab: React.FC<CommunityBotTabProps> = ({
  onAdoptBot,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest'>('popular');
  const [starredBots, setStarredBots] = useState<Record<string, boolean>>({});
  const [adoptedBotId, setAdoptedBotId] = useState<string | null>(null);
  const [activeJsonModalBot, setActiveJsonModalBot] = useState<CommunityBotItem | null>(null);
  const [activeTestChatBot, setActiveTestChatBot] = useState<CommunityBotItem | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // New bot creation form state
  const [newBotName, setNewBotName] = useState('');
  const [newBotCreator, setNewBotCreator] = useState('@my_handle');
  const [newBotTagline, setNewBotTagline] = useState('');
  const [newBotPrompt, setNewBotPrompt] = useState('');
  const [newBotColor, setNewBotColor] = useState('#38bdf8');
  const [newBotAccessory, setNewBotAccessory] = useState<'none' | 'headphones' | 'cat_ears' | 'visor' | 'wizard_hat' | 'halo'>('headphones');
  const [newBotFormality, setNewBotFormality] = useState(4);
  const [newBotHumor, setNewBotHumor] = useState(7);
  const [newBotVerbosity, setNewBotVerbosity] = useState(4);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState(false);

  const categories = [
    { id: 'all', label: 'All Mascots' },
    { id: 'productivity', label: 'Productivity & Dev' },
    { id: 'systems', label: 'System & Utilities' },
    { id: 'anime', label: 'Anime & Creative' },
    { id: 'study', label: 'Study & Research' },
    { id: 'gaming', label: 'Gaming & Fun' },
  ];

  const filteredBots = useMemo(() => {
    return COMMUNITY_BOTS_DATA.filter((bot) => {
      const matchesCategory = selectedCategory === 'all' || bot.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        bot.name.toLowerCase().includes(q) ||
        bot.creator.toLowerCase().includes(q) ||
        bot.tagline.toLowerCase().includes(q) ||
        bot.description.toLowerCase().includes(q) ||
        bot.aiEngine.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'popular') return b.downloadsCount - a.downloadsCount;
      return b.starsCount - a.starsCount;
    });
  }, [searchQuery, selectedCategory, sortBy]);

  const handleToggleStar = (botId: string) => {
    setStarredBots((prev) => ({
      ...prev,
      [botId]: !prev[botId],
    }));
  };

  const handleAdoptBot = (bot: CommunityBotItem) => {
    const pairingCode = generatePairingCode();
    const newProfile: BotProfile = {
      id: `bot_${bot.id}_${Date.now()}`,
      userId: 'usr_community',
      creator: {
        id: 'usr_community',
        username: bot.creator.replace('@', ''),
        displayName: bot.name,
        avatarUrl: 'https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/public/robot-icon.svg',
      },
      botName: bot.name,
      tagline: bot.tagline,
      isActive: true,
      isPublic: true,
      pairingCode,
      visualMode: 'robot',
      avatarImageUrl: 'https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/public/robot-icon.svg',
      videoUrl: '',
      framesConfig: [],
      appearance: {
        model: 'robot',
        color: bot.accentColor,
        paletteName: bot.paletteName,
        accessory: bot.accessory,
        scale: 1.0,
      },
      greetingMessage: `Hello Pilot! ${bot.name} is online and ready.`,
      personality: {
        botName: bot.name,
        userName: 'Pilot',
        archetype: bot.archetype,
        formality: bot.formality,
        humor: bot.humor,
        verbosity: bot.verbosity,
        customPrompt: bot.prompt,
      },
      voice: {
        voiceId: 'luna-neural',
        voiceName: `${bot.name} Voice`,
        pitch: 1.0,
        speed: 1.0,
      },
      permissions: { ...bot.permissions },
      githubRepo: 'jasonhukom/Luminess-Assist',
      githubRepoUrl: 'https://github.com/jasonhukom/Luminess-Assist',
      forkedFrom: 'jasonhukom/Luminess-Assist',
      githubBranch: 'main',
      githubSyncStatus: 'synced',
      likesCount: bot.starsCount,
      viewsCount: bot.downloadsCount,
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (onAdoptBot) {
      onAdoptBot(newProfile);
    }
    setAdoptedBotId(bot.id);

    // Auto copy pairing code
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleCopyJson = (bot: CommunityBotItem) => {
    const payload = JSON.stringify(
      {
        name: bot.name,
        creator: bot.creator,
        tagline: bot.tagline,
        prompt: bot.prompt,
        appearance: {
          color: bot.accentColor,
          palette: bot.paletteName,
          accessory: bot.accessory,
        },
        tuning: {
          formality: bot.formality,
          humor: bot.humor,
          verbosity: bot.verbosity,
        },
        permissions: bot.permissions,
        engine: bot.aiEngine,
      },
      null,
      2
    );
    navigator.clipboard.writeText(payload);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handlePublishBotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;

    setSubmitSuccessMsg(true);
    setTimeout(() => {
      setSubmitSuccessMsg(false);
      setIsSubmitModalOpen(false);
      setNewBotName('');
      setNewBotTagline('');
      setNewBotPrompt('');
    }, 1800);
  };

  return (
    <div className="space-y-12 pb-24">
      
      {/* =========================================================================
          HERO BANNER (Optimus Style)
         ========================================================================= */}
      <section className="relative rounded-3xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] p-8 sm:p-12 shadow-sm overflow-hidden crosshair-corner">
        
        {/* Subtle architectural background pattern */}
        <div className="absolute inset-0 blueprint-grid opacity-30 pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
            <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
              COMMUNITY ECOSYSTEM // VERIFIED PILOT REPOSITORY
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9] mb-4">
            Community Bots
            <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
              crafted by pilots, installed in one click.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#5e534a] dark:text-[#a89c92] max-w-2xl leading-relaxed mb-8">
            Explore ready-to-run companion bots built by the Luminess community. Each bot features specialized personality guardrails, emotional tuning, and local desktop abilities. Preview live, adopt into your desktop app, or package your own.
          </p>

          {/* Quick Metrics & Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#dad7d0]/60 dark:border-white/10 font-mono text-xs">
            <div>
              <span className="text-[#5e534a] dark:text-[#a89c92] block">Curated Companions</span>
              <strong className="text-lg font-bold text-[#080503] dark:text-[#fafaf9]">24+ Active</strong>
            </div>
            <div>
              <span className="text-[#5e534a] dark:text-[#a89c92] block">Total Adoptions</span>
              <strong className="text-lg font-bold text-emerald-600 dark:text-emerald-400">26.1k Installs</strong>
            </div>
            <div>
              <span className="text-[#5e534a] dark:text-[#a89c92] block">Format &amp; Sync</span>
              <strong className="text-lg font-bold text-[#080503] dark:text-[#fafaf9]">1-Click Pairing</strong>
            </div>
            <div>
              <span className="text-[#5e534a] dark:text-[#a89c92] block">License</span>
              <strong className="text-lg font-bold text-cyan-600 dark:text-cyan-400">100% Open MIT</strong>
            </div>
          </div>
        </div>

        {/* Top-Right Creator Action Button */}
        <div className="mt-8 sm:mt-0 sm:absolute sm:top-12 sm:right-12 z-20">
          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] hover:opacity-90 font-mono text-xs font-bold tracking-tight shadow-sm transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>SUBMIT YOUR BOT</span>
          </button>
        </div>

      </section>

      {/* =========================================================================
          CONTROLS: SEARCH, CATEGORIES, & SORTING
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d]">
        
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] font-semibold'
                    : 'bg-[#080503]/5 dark:bg-white/5 text-[#5e534a] dark:text-[#a89c92] hover:bg-[#080503]/10 dark:hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Right Search & Sort Inputs */}
        <div className="flex items-center gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e534a] dark:text-[#a89c92]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bots or creators..."
              className="w-full pl-9 pr-3 py-1.5 rounded-full border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] text-xs font-mono focus:outline-none focus:border-[#080503] dark:focus:border-white text-[#080503] dark:text-[#fafaf9]"
            />
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-full border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] text-xs font-mono text-[#080503] dark:text-[#fafaf9] focus:outline-none cursor-pointer"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Featured</option>
          </select>

        </div>

      </div>

      {/* =========================================================================
          BOT CARDS GRID
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBots.map((bot) => {
          const isStarred = starredBots[bot.id];
          const isAdopted = adoptedBotId === bot.id;

          return (
            <div
              key={bot.id}
              className="rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] p-6 flex flex-col justify-between shadow-sm hover:border-[#080503]/40 dark:hover:border-white/30 transition-all crosshair-corner group"
            >
              <div>
                
                {/* Header row: Avatar, Name, Verified, Star */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    
                    {/* Visual Bot Mascot Avatar Indicator */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center relative shadow-sm border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: `${bot.accentColor}20` }}
                    >
                      <div
                        className="w-5 h-5 rounded-md"
                        style={{ backgroundColor: bot.accentColor }}
                      />
                      <span className="absolute -bottom-1 -right-1 text-[10px] font-mono px-1 py-0.2 rounded bg-black/80 text-white dark:bg-white dark:text-black">
                        {bot.accessory === 'none' ? 'BOT' : bot.accessory.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display font-bold text-lg text-[#080503] dark:text-[#fafaf9] group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          {bot.name}
                        </h3>
                        {bot.verified && (
                          <span title="Verified Companion">
                            <CheckCircle2 size={14} className="text-cyan-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                        {bot.creator}
                      </span>
                    </div>

                  </div>

                  {/* Star Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleStar(bot.id)}
                    className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#5e534a] dark:text-[#a89c92] transition-colors cursor-pointer"
                    title="Star bot"
                  >
                    <Star
                      size={16}
                      className={isStarred ? 'fill-amber-400 text-amber-400' : ''}
                    />
                  </button>
                </div>

                {/* Tagline */}
                <p className="text-xs font-medium text-[#080503] dark:text-white mb-2 leading-relaxed">
                  {bot.tagline}
                </p>

                {/* Description */}
                <p className="text-xs text-[#5e534a] dark:text-[#a89c92] leading-relaxed line-clamp-3 mb-4">
                  {bot.description}
                </p>

                {/* Personality Meters (Formality, Humor, Verbosity) */}
                <div className="p-3 rounded-xl bg-[#fafaf9] dark:bg-[#0c0907] border border-[#dad7d0]/60 dark:border-white/5 space-y-2 mb-4 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5e534a] dark:text-[#a89c92]">Formality:</span>
                    <div className="flex items-center gap-1">
                      <span className="w-16 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <span
                          className="block h-full bg-cyan-500 rounded-full"
                          style={{ width: `${bot.formality * 10}%` }}
                        />
                      </span>
                      <span className="w-4 text-right">{bot.formality}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#5e534a] dark:text-[#a89c92]">Humor:</span>
                    <div className="flex items-center gap-1">
                      <span className="w-16 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <span
                          className="block h-full bg-pink-500 rounded-full"
                          style={{ width: `${bot.humor * 10}%` }}
                        />
                      </span>
                      <span className="w-4 text-right">{bot.humor}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#5e534a] dark:text-[#a89c92]">Verbosity:</span>
                    <div className="flex items-center gap-1">
                      <span className="w-16 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <span
                          className="block h-full bg-amber-500 rounded-full"
                          style={{ width: `${bot.verbosity * 10}%` }}
                        />
                      </span>
                      <span className="w-4 text-right">{bot.verbosity}</span>
                    </div>
                  </div>
                </div>

                {/* Capabilities & Model Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mb-6">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                    {bot.aiEngine}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#080503]/5 dark:bg-white/5 text-[#5e534a] dark:text-[#a89c92]">
                    {bot.categoryLabel}
                  </span>
                  {bot.permissions.canExecuteCommands && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      PS CLI
                    </span>
                  )}
                  {bot.permissions.canSortFiles && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300">
                      File Sorter
                    </span>
                  )}
                </div>

              </div>

              {/* Card Footer: Telemetry & Actions */}
              <div className="pt-4 border-t border-[#dad7d0]/60 dark:border-white/10 space-y-3">
                
                {/* Stats Bar */}
                <div className="flex items-center justify-between text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                  <div className="flex items-center gap-1">
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    <span className="font-bold text-[#080503] dark:text-white">{bot.rating}</span>
                    <span>({bot.starsCount + (isStarred ? 1 : 0)})</span>
                  </div>
                  <div>
                    <span>{bot.downloadsCount.toLocaleString()} downloads</span>
                  </div>
                </div>

                {/* Actions: Test Chat, Inspect JSON, Adopt */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTestChatBot(bot)}
                    className="p-2.5 rounded-lg border border-[#dad7d0] dark:border-white/10 hover:border-[#080503] dark:hover:border-white text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-white transition-all cursor-pointer"
                    title="Preview Dialogue"
                  >
                    <MessageSquare size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveJsonModalBot(bot)}
                    className="p-2.5 rounded-lg border border-[#dad7d0] dark:border-white/10 hover:border-[#080503] dark:hover:border-white text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-white transition-all cursor-pointer"
                    title="Inspect & Copy JSON"
                  >
                    <Code2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAdoptBot(bot)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer shadow-sm ${
                      isAdopted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] hover:opacity-90'
                    }`}
                  >
                    {isAdopted ? (
                      <>
                        <Check size={13} />
                        <span>ADOPTED &bull; CODE COPIED</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>ADOPT BOT</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>
          );
        })}
      </div>

      {/* =========================================================================
          DIALOGUE PREVIEW MODAL
         ========================================================================= */}
      {activeTestChatBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] p-6 shadow-2xl relative space-y-4">
            
            <div className="flex items-center justify-between border-b border-[#dad7d0] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: activeTestChatBot.accentColor }}
                />
                <span className="font-display font-bold text-base text-[#080503] dark:text-white">
                  {activeTestChatBot.name} — Dialogue Preview
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTestChatBot(null)}
                className="text-[#5e534a] dark:text-[#a89c92] hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <span className="font-bold text-[#5e534a] dark:text-[#a89c92] block mb-1">PILOT PROMPT:</span>
                <p className="text-[#080503] dark:text-white">{activeTestChatBot.sampleDialogue.user}</p>
              </div>

              <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-900 dark:text-cyan-100">
                <span className="font-bold text-cyan-600 dark:text-cyan-400 block mb-1">{activeTestChatBot.name.toUpperCase()} REPLY:</span>
                <p className="leading-relaxed">{activeTestChatBot.sampleDialogue.bot}</p>
              </div>

              <div className="pt-2">
                <span className="text-[11px] text-[#5e534a] dark:text-[#a89c92] block mb-1">SYSTEM INSTRUCTION WRAPPER:</span>
                <div className="p-2.5 rounded bg-black/5 dark:bg-[#080503] text-[11px] text-[#5e534a] dark:text-[#a89c92] border border-black/5 dark:border-white/5">
                  {activeTestChatBot.prompt}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleAdoptBot(activeTestChatBot);
                  setActiveTestChatBot(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#080503] text-white dark:bg-white dark:text-[#080503] font-mono text-xs font-bold hover:opacity-90 cursor-pointer"
              >
                ADOPT THIS BOT NOW
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          JSON INSPECT MODAL
         ========================================================================= */}
      {activeJsonModalBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] p-6 shadow-2xl relative space-y-4">
            
            <div className="flex items-center justify-between border-b border-[#dad7d0] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Code2 size={16} className="text-cyan-500" />
                <span className="font-display font-bold text-base text-[#080503] dark:text-white">
                  {activeJsonModalBot.name} — Companion Profile JSON
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveJsonModalBot(null)}
                className="text-[#5e534a] dark:text-[#a89c92] hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-black/90 text-emerald-400 font-mono text-xs overflow-x-auto max-h-80 select-all">
              {JSON.stringify(
                {
                  botName: activeJsonModalBot.name,
                  creator: activeJsonModalBot.creator,
                  aiEngine: activeJsonModalBot.aiEngine,
                  appearance: {
                    model: 'robot',
                    color: activeJsonModalBot.accentColor,
                    palette: activeJsonModalBot.paletteName,
                    accessory: activeJsonModalBot.accessory,
                  },
                  personality: {
                    archetype: activeJsonModalBot.archetype,
                    formality: activeJsonModalBot.formality,
                    humor: activeJsonModalBot.humor,
                    verbosity: activeJsonModalBot.verbosity,
                    prompt: activeJsonModalBot.prompt,
                  },
                  permissions: activeJsonModalBot.permissions,
                },
                null,
                2
              )}
            </pre>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                Compatible with Windows desktop app pairing engine.
              </span>
              <button
                type="button"
                onClick={() => handleCopyJson(activeJsonModalBot)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#080503] text-white dark:bg-white dark:text-[#080503] font-mono text-xs font-bold hover:opacity-90 cursor-pointer"
              >
                {copiedJson ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedJson ? 'COPIED TO CLIPBOARD' : 'COPY JSON SPEC'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          SUBMIT BOT MODAL
         ========================================================================= */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] p-6 sm:p-8 shadow-2xl relative space-y-5">
            
            <div className="flex items-center justify-between border-b border-[#dad7d0] dark:border-white/10 pb-3">
              <div>
                <h3 className="font-display font-bold text-xl text-[#080503] dark:text-white">
                  Publish A Community Bot
                </h3>
                <p className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                  Share your companion personality with thousands of desktop pilots.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-[#5e534a] dark:text-[#a89c92] hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePublishBotSubmit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-[#5e534a] dark:text-[#a89c92] mb-1">Mascot Name:</label>
                <input
                  type="text"
                  required
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  placeholder="e.g. CyberSamurai"
                  className="w-full px-3 py-2 rounded-lg border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] text-[#080503] dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5e534a] dark:text-[#a89c92] mb-1">Creator Handle:</label>
                  <input
                    type="text"
                    required
                    value={newBotCreator}
                    onChange={(e) => setNewBotCreator(e.target.value)}
                    placeholder="@your_handle"
                    className="w-full px-3 py-2 rounded-lg border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] text-[#080503] dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#5e534a] dark:text-[#a89c92] mb-1">Primary Color:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newBotColor}
                      onChange={(e) => setNewBotColor(e.target.value)}
                      className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-xs">{newBotColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[#5e534a] dark:text-[#a89c92] mb-1">Tagline Pitch:</label>
                <input
                  type="text"
                  required
                  value={newBotTagline}
                  onChange={(e) => setNewBotTagline(e.target.value)}
                  placeholder="One sentence describing what this mascot does."
                  className="w-full px-3 py-2 rounded-lg border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] text-[#080503] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#5e534a] dark:text-[#a89c92] mb-1">Custom System Prompt:</label>
                <textarea
                  rows={3}
                  required
                  value={newBotPrompt}
                  onChange={(e) => setNewBotPrompt(e.target.value)}
                  placeholder="You are CyberSamurai, an honorable terminal assistant..."
                  className="w-full px-3 py-2 rounded-lg border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#080503] text-[#080503] dark:text-white focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <span className="block text-[11px] text-[#5e534a] dark:text-[#a89c92]">Formality ({newBotFormality})</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={newBotFormality}
                    onChange={(e) => setNewBotFormality(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-[#5e534a] dark:text-[#a89c92]">Humor ({newBotHumor})</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={newBotHumor}
                    onChange={(e) => setNewBotHumor(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-[#5e534a] dark:text-[#a89c92]">Verbosity ({newBotVerbosity})</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={newBotVerbosity}
                    onChange={(e) => setNewBotVerbosity(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitSuccessMsg}
                  className="w-full py-3 rounded-xl bg-[#080503] text-white dark:bg-white dark:text-[#080503] font-mono text-xs font-bold hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitSuccessMsg ? (
                    <>
                      <Check size={14} className="text-emerald-500" />
                      <span>BOT SUBMITTED TO REVIEW QUEUE!</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>PACKAGE &amp; SUBMIT BOT</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
