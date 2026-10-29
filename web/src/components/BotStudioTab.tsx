import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Palette,
  Play,
  Pause,
  Layers,
  Video,
  Image as ImageIcon,
  Bot,
  Plus,
  Trash2,
  MessageSquare,
  GitFork,
  Send,
  Database,
  ExternalLink,
  Download,
  CheckCircle2,
  Radio,
  Wand2,
  Eye,
  Crown,
  Headphones,
} from 'lucide-react';
import {
  type BotProfile,
  type AppearanceConfig,
  type PersonalityConfig,
  type SpriteFrame,
  type PlatformUser,
  saveBotCreationToBackend,
  testBotChat,
} from '../lib/botPlatformStore.ts';
import { LivingRobot } from './LivingRobot.tsx';

const GithubIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export interface BotStudioTabProps {
  profile: BotProfile;
  currentUser?: PlatformUser | null;
  onUpdateProfile: (updated: BotProfile) => void;
  onSavedToCommunity?: (bot: BotProfile) => void;
  onOpenAuth?: () => void;
}

const COLOR_PRESETS = [
  { name: 'Cyber Cyan', hex: '#38bdf8', glow: 'rgba(56,189,248,0.5)' },
  { name: 'Neon Violet', hex: '#a855f7', glow: 'rgba(168,85,247,0.5)' },
  { name: 'Emerald Matrix', hex: '#10b981', glow: 'rgba(16,185,129,0.5)' },
  { name: 'Solar Amber', hex: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
  { name: 'Rose Quartz', hex: '#ec4899', glow: 'rgba(236,72,153,0.5)' },
  { name: 'Monochrome Void', hex: '#94a3b8', glow: 'rgba(148,163,184,0.4)' },
];

const ACCESSORIES = [
  { id: 'none', label: 'None', icon: null },
  { id: 'headphones', label: 'Headphones', icon: Headphones },
  { id: 'cat_ears', label: 'Cat Ears', icon: Radio },
  { id: 'wizard_hat', label: 'Wizard Hat', icon: Wand2 },
  { id: 'visor', label: 'AR Visor', icon: Eye },
  { id: 'halo', label: 'Angel Halo', icon: Crown },
];

const ARCHETYPES = [
  {
    id: 'study_buddy',
    title: 'Study Buddy',
    description: 'Pomodoro timer intervals, flashcards, and anti-distraction study coach.',
    tag: 'PRODUCTIVITY',
  },
  {
    id: 'coder',
    title: 'Coder Companion',
    description: 'Clipboard error debugger, syntax explainer, and refactoring aide.',
    tag: 'DEVELOPMENT',
  },
  {
    id: 'butler',
    title: 'System Butler',
    description: 'Organizes downloads, inspects CPU/RAM load, and keeps PC tidy.',
    tag: 'AUTOMATION',
  },
  {
    id: 'witty_hacker',
    title: 'Witty Hacker',
    description: 'Playfully snarky, witty cyber jokes, and playful commentary.',
    tag: 'CASUAL & FUN',
  },
  {
    id: 'custom',
    title: 'Custom Persona',
    description: 'Provide your own tailored system instruction and personality matrix.',
    tag: 'BESPOKE',
  },
];

const SAMPLE_FRAME_PRESETS = [
  {
    id: 'f_idle1',
    name: 'Idle Frame 1',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
    state: 'idle' as const,
  },
  {
    id: 'f_idle2',
    name: 'Idle Frame 2',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
    state: 'idle' as const,
  },
  {
    id: 'f_talk',
    name: 'Speaking Frame',
    url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=300&q=80',
    state: 'talking' as const,
  },
  {
    id: 'f_happy',
    name: 'Emote Happy',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
    state: 'happy' as const,
  },
];

const SAMPLE_VIDEOS = [
  { name: 'Cosmic Nebula Loop', url: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1610-large.mp4' },
  { name: 'Retro Neon Wave', url: 'https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-futuristic-neon-lights-42510-large.mp4' },
  { name: 'Digital Matrix Grid', url: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-code-31911-large.mp4' },
];

export const BotStudioTab: React.FC<BotStudioTabProps> = ({
  profile,
  currentUser,
  onUpdateProfile,
  onSavedToCommunity,
  onOpenAuth,
}) => {
  const [activeStep, setActiveStep] = useState<'look' | 'identity' | 'chat' | 'github'>('look');
  const [testEmotion, setTestEmotion] = useState<'idle' | 'joy' | 'puzzled' | 'love'>('idle');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Per-Frame Sprite Animation State
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlayingFrames, setIsPlayingFrames] = useState(true);
  const [frameFps, setFrameFps] = useState(4);

  // Live Chat Sandbox in Studio
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    {
      sender: 'bot',
      text: profile.greetingMessage || 'Hello Pilot! I am ready to assist.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isBotReplying, setIsBotReplying] = useState(false);

  // New Frame input state
  const [newFrameUrl, setNewFrameUrl] = useState('');
  const [newFrameName, setNewFrameName] = useState('');
  const [newFrameState, setNewFrameState] = useState<'idle' | 'talking' | 'happy' | 'thinking'>('idle');

  const appearance = profile.appearance || {
    model: 'robot',
    color: '#38bdf8',
    paletteName: 'Cyber Cyan',
    accessory: 'headphones',
    scale: 1.0,
  };
  const personality = profile.personality || {
    botName: profile.botName || 'Luminess',
    userName: 'Pilot',
    archetype: 'witty_hacker',
    formality: 3,
    humor: 8,
    verbosity: 4,
    customPrompt: '',
  };
  const frames = profile.framesConfig || [];

  // Frame cycle player
  useEffect(() => {
    if (profile.visualMode !== 'sprite_frames' || !isPlayingFrames || frames.length <= 1) return;
    const intervalMs = Math.round(1000 / frameFps);
    const timer = setInterval(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % frames.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [profile.visualMode, isPlayingFrames, frames.length, frameFps]);

  const updateVisualMode = (mode: BotProfile['visualMode']) => {
    const nextFrames = (mode === 'sprite_frames' && frames.length === 0) ? SAMPLE_FRAME_PRESETS : frames;
    const nextVideo = (mode === 'video' && !profile.videoUrl) ? SAMPLE_VIDEOS[0].url : profile.videoUrl;
    onUpdateProfile({
      ...profile,
      visualMode: mode,
      framesConfig: nextFrames,
      videoUrl: nextVideo,
    });
  };

  const updateAppearance = (patch: Partial<AppearanceConfig>) => {
    onUpdateProfile({
      ...profile,
      appearance: { ...appearance, ...patch },
    });
  };

  const updatePersonality = (patch: Partial<PersonalityConfig>) => {
    onUpdateProfile({
      ...profile,
      personality: { ...personality, ...patch },
      botName: patch.botName !== undefined ? patch.botName : profile.botName,
    });
  };

  const addFrame = () => {
    if (!newFrameUrl.trim()) return;
    const frameItem: SpriteFrame = {
      id: `f_${Date.now()}`,
      name: newFrameName.trim() || `Frame ${frames.length + 1}`,
      url: newFrameUrl.trim(),
      state: newFrameState,
    };
    onUpdateProfile({
      ...profile,
      framesConfig: [...frames, frameItem],
    });
    setNewFrameUrl('');
    setNewFrameName('');
  };

  const removeFrame = (frameId: string) => {
    onUpdateProfile({
      ...profile,
      framesConfig: frames.filter((f) => f.id !== frameId),
    });
  };

  const handleStudioChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isBotReplying) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setIsBotReplying(true);

    try {
      const res = await testBotChat(profile.id, userMsg, profile);
      setChatMessages((prev) => [...prev, { sender: 'bot', text: res.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `[${profile.botName}]: Got it, Pilot! Testing prompt response.` },
      ]);
    } finally {
      setIsBotReplying(false);
    }
  };

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const savedBot = await saveBotCreationToBackend({
        ...profile,
        userId: currentUser?.id || profile.userId,
        creator: currentUser ? {
          id: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
          githubUsername: currentUser.githubUsername,
          githubRepoUrl: currentUser.githubRepoUrl,
        } : profile.creator,
      });

      onUpdateProfile(savedBot);
      if (onSavedToCommunity) {
        onSavedToCommunity(savedBot);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const githubUser = currentUser?.githubUsername || currentUser?.username || 'jasonhukom';
  const forkRepo = `${githubUser}/Luminess-Assist`;
  const forkUrl = `https://github.com/${forkRepo}`;

  return (
    <div className="relative pt-28 pb-20 px-6 max-w-[1400px] mx-auto min-h-screen">
      
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-8 pb-6 border-b border-[#dad7d0]/60 dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-medium mb-3">
            <Sparkles size={13} />
            <span>Full Bot Customization &bull; MariaDB &bull; GitHub Fork</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#080503] dark:text-[#fafaf9]">
            Bot Creation Studio
          </h1>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] mt-1.5 max-w-2xl">
            Design your companion's visual look (per-frame sprite cycles, animated video loops, or interactive robots),
            customize chat behaviors and prompts, and synchronize with your forked GitHub repository.
          </p>
        </div>

        {/* Save to MariaDB CTA */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#080503] dark:bg-[#fafaf9] text-[#fafaf9] dark:text-[#080503] text-xs font-semibold tracking-wide hover:opacity-90 transition-all cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Database size={14} />
            <span>{isSaving ? 'Saving to MariaDB...' : 'Save to MariaDB Database'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>
              <strong>Saved to MariaDB Database!</strong> Your bot is now active and anyone can explore it in the Community Showcase.
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold">Pairing: {profile.pairingCode}</span>
        </div>
      )}

      {/* Main Studio Grid: Left Canvas & Live Preview / Right Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Live Visual Companion Canvas (5 cols) */}
        <div className="lg:col-span-5 sticky top-28 space-y-4">
          <div className="relative rounded-3xl bg-[#080503] border border-[#dad7d0]/40 dark:border-white/10 overflow-hidden shadow-2xl p-6 flex flex-col items-center justify-center min-h-[460px]">
            
            {/* Visual Look Canvas depending on mode */}
            {profile.visualMode === 'video' && profile.videoUrl ? (
              <div className="relative w-full h-[320px] rounded-2xl overflow-hidden shadow-inner">
                <video
                  src={profile.videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-mono text-white/80 flex items-center gap-1">
                  <Video size={11} className="text-purple-400" />
                  <span>Video Loop Player</span>
                </div>
              </div>
            ) : profile.visualMode === 'sprite_frames' && frames.length > 0 ? (
              <div className="relative w-full h-[320px] rounded-2xl overflow-hidden bg-black/40 flex flex-col items-center justify-center p-4">
                <img
                  src={frames[currentFrameIdx]?.url || frames[0].url}
                  alt={profile.botName}
                  className="max-h-60 max-w-full object-contain pixelated transition-all"
                />
                
                {/* Frame Playback Toolbar */}
                <div className="absolute bottom-3 left-3 right-3 p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-between text-[11px] font-mono text-white/90">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPlayingFrames(!isPlayingFrames)}
                      className="p-1 rounded hover:bg-white/20 transition-all cursor-pointer"
                    >
                      {isPlayingFrames ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <span>
                      Frame {currentFrameIdx + 1}/{frames.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] opacity-70">FPS:</span>
                    <input
                      type="range"
                      min="1"
                      max="16"
                      value={frameFps}
                      onChange={(e) => setFrameFps(Number(e.target.value))}
                      className="w-16 accent-[#38bdf8]"
                    />
                    <span className="text-[10px] w-4">{frameFps}</span>
                  </div>
                </div>
              </div>
            ) : profile.visualMode === 'image' && profile.avatarImageUrl ? (
              <div className="relative w-full h-[320px] rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center">
                <img
                  src={profile.avatarImageUrl}
                  alt={profile.botName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-[320px] flex items-center justify-center">
                <LivingRobot
                  currentEmotion={testEmotion === 'love' ? 'love' : testEmotion === 'joy' ? 'joy' : testEmotion === 'puzzled' ? 'thinking' : 'idle'}
                  size={240}
                />
              </div>
            )}

            {/* Canvas Identity Footer */}
            <div className="w-full mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/80">
              <div>
                <span className="font-display font-bold text-white text-sm">
                  {profile.botName}
                </span>
                <span className="text-[10px] font-mono text-white/60 ml-2">
                  Pairing: <strong className="text-[#38bdf8]">{profile.pairingCode}</strong>
                </span>
              </div>

              {/* Emotion triggers for test */}
              <div className="flex items-center gap-1">
                {(['idle', 'joy', 'puzzled', 'love'] as const).map((emo) => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => setTestEmotion(emo)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-all cursor-pointer ${
                      testEmotion === emo
                        ? 'bg-[#38bdf8] text-black font-bold'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick GitHub Connection Badge (like Vercel) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GithubIcon size={16} className="text-[#080503] dark:text-white" />
              <div>
                <span className="font-semibold text-[#080503] dark:text-white">GitHub Fork Status</span>
                <p className="text-[10px] font-mono text-[#5e534a] dark:text-[#a89c92]">
                  {forkRepo}
                </p>
              </div>
            </div>
            <a
              href={`https://github.com/jasonhukom/Luminess-Assist/fork`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#dad7d0] dark:border-white/15 text-[11px] font-semibold text-[#080503] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              <GitFork size={12} />
              <span>Fork Repo</span>
            </a>
          </div>
        </div>

        {/* Right Side: Step-by-Step Customization Panel (7 cols) */}
        <div className="lg:col-span-7 bg-[#fafaf9] dark:bg-[#120f0d] border border-[#dad7d0] dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
          
          {/* Step Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-[#dad7d0]/60 dark:border-white/10">
            {[
              { key: 'look', label: '1. Visual Look & Media', icon: Palette },
              { key: 'identity', label: '2. Name & Persona', icon: Bot },
              { key: 'chat', label: '3. Chat & Live Test', icon: MessageSquare },
              { key: 'github', label: '4. GitHub Fork', icon: GitFork },
            ].map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(step.key as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#080503] dark:bg-white text-white dark:text-black shadow-sm'
                      : 'text-[#5e534a] dark:text-[#a89c92] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* STEP 1: VISUAL LOOK & MEDIA */}
          {activeStep === 'look' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-3">
                  Visual Companion Engine
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'robot', label: 'Living Robot', icon: Bot, desc: 'Procedural 3D SVG' },
                    { id: 'sprite_frames', label: 'Per-Frame Sprites', icon: Layers, desc: 'Sprite frame cycles' },
                    { id: 'video', label: 'Video Loop', icon: Video, desc: 'MP4/WebM animation' },
                    { id: 'image', label: 'Custom Image', icon: ImageIcon, desc: 'Static avatar URL' },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = profile.visualMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateVisualMode(mode.id as any)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#38bdf8] bg-[#38bdf8]/10 text-[#080503] dark:text-white shadow-sm'
                            : 'border-[#dad7d0] dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 text-[#5e534a] dark:text-[#a89c92]'
                        }`}
                      >
                        <Icon size={18} className={isSelected ? 'text-[#38bdf8] mb-1.5' : 'mb-1.5'} />
                        <div className="text-xs font-bold text-[#080503] dark:text-white">{mode.label}</div>
                        <div className="text-[10px] opacity-70">{mode.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Per-Frame Sprite Manager */}
              {profile.visualMode === 'sprite_frames' && (
                <div className="p-4 rounded-2xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#080503] dark:text-white">
                        Frame-by-Frame Sprite Editor ({frames.length} frames)
                      </h4>
                      <p className="text-[11px] text-[#5e534a] dark:text-[#a89c92]">
                        Add frames for idle loop, talking states, and reaction emotes.
                      </p>
                    </div>
                  </div>

                  {/* Frame List */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {frames.map((frame, index) => (
                      <div
                        key={frame.id}
                        className={`relative p-2 rounded-xl border bg-black/5 dark:bg-white/5 flex flex-col items-center justify-between ${
                          currentFrameIdx === index ? 'border-[#38bdf8]' : 'border-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => removeFrame(frame.id)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-all cursor-pointer"
                        >
                          <Trash2 size={10} />
                        </button>
                        <img
                          src={frame.url}
                          alt={frame.name}
                          className="w-16 h-16 object-contain pixelated mb-1 rounded"
                        />
                        <span className="text-[10px] font-mono font-medium truncate w-full text-center text-[#080503] dark:text-white">
                          #{index + 1} {frame.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[#5e534a] dark:text-[#a89c92] capitalize">
                          {frame.state}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Add Frame Form */}
                  <div className="pt-3 border-t border-[#dad7d0]/60 dark:border-white/10 space-y-2">
                    <span className="text-[11px] font-semibold text-[#080503] dark:text-white">Add New Frame</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={newFrameName}
                        onChange={(e) => setNewFrameName(e.target.value)}
                        placeholder="Frame Name (e.g. Talk 2)"
                        className="px-3 py-1.5 text-xs bg-white dark:bg-black/50 border border-[#dad7d0] dark:border-white/10 rounded-xl text-[#080503] dark:text-white"
                      />
                      <input
                        type="text"
                        value={newFrameUrl}
                        onChange={(e) => setNewFrameUrl(e.target.value)}
                        placeholder="Image URL (PNG/WebP/GIF)"
                        className="px-3 py-1.5 text-xs bg-white dark:bg-black/50 border border-[#dad7d0] dark:border-white/10 rounded-xl text-[#080503] dark:text-white"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newFrameState}
                          onChange={(e) => setNewFrameState(e.target.value as any)}
                          className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-black/50 border border-[#dad7d0] dark:border-white/10 rounded-xl text-[#080503] dark:text-white"
                        >
                          <option value="idle">Idle</option>
                          <option value="talking">Talking</option>
                          <option value="happy">Happy</option>
                          <option value="thinking">Thinking</option>
                        </select>
                        <button
                          type="button"
                          onClick={addFrame}
                          disabled={!newFrameUrl.trim()}
                          className="px-3 py-1.5 rounded-xl bg-[#38bdf8] text-black text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Loop Manager */}
              {profile.visualMode === 'video' && (
                <div className="p-4 rounded-2xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-[#080503] dark:text-white">
                    Video Animation Loop URL (MP4 / WebM / GIF)
                  </h4>
                  <input
                    type="text"
                    value={profile.videoUrl || ''}
                    onChange={(e) => onUpdateProfile({ ...profile, videoUrl: e.target.value })}
                    placeholder="https://... (direct video loop URL)"
                    className="w-full px-4 py-2 text-xs bg-white dark:bg-black/50 border border-[#dad7d0] dark:border-white/10 rounded-xl text-[#080503] dark:text-white"
                  />
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-[10px] text-[#5e534a] dark:text-[#a89c92] self-center">Presets:</span>
                    {SAMPLE_VIDEOS.map((sv) => (
                      <button
                        key={sv.name}
                        type="button"
                        onClick={() => onUpdateProfile({ ...profile, videoUrl: sv.url })}
                        className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[10px] font-mono text-[#080503] dark:text-white cursor-pointer"
                      >
                        {sv.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Image Avatar Manager */}
              {profile.visualMode === 'image' && (
                <div className="p-4 rounded-2xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-[#080503] dark:text-white">
                    Custom Avatar Image URL
                  </h4>
                  <input
                    type="text"
                    value={profile.avatarImageUrl || ''}
                    onChange={(e) => onUpdateProfile({ ...profile, avatarImageUrl: e.target.value })}
                    placeholder="https://... (direct PNG / SVG / JPG URL)"
                    className="w-full px-4 py-2 text-xs bg-white dark:bg-black/50 border border-[#dad7d0] dark:border-white/10 rounded-xl text-[#080503] dark:text-white"
                  />
                </div>
              )}

              {/* Robot Colors & Accessories */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-3">
                  Color Accent & Glow Palette
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = appearance.color === preset.hex;
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => updateAppearance({ color: preset.hex, paletteName: preset.name })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#080503] dark:border-white bg-black/5 dark:bg-white/5'
                            : 'border-[#dad7d0] dark:border-white/10 hover:border-black/30'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full mx-auto mb-1.5 shadow-sm"
                          style={{ backgroundColor: preset.hex, boxShadow: `0 0 10px ${preset.glow}` }}
                        />
                        <span className="text-[10px] font-mono truncate block text-[#080503] dark:text-white">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accessory */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-3">
                  Accessory Attachment
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {ACCESSORIES.map((acc) => {
                    const Icon = acc.icon;
                    const isSelected = appearance.accessory === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => updateAppearance({ accessory: acc.id as any })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#080503] dark:border-white bg-black/5 dark:bg-white/5'
                            : 'border-[#dad7d0] dark:border-white/10 hover:border-black/30'
                        }`}
                      >
                        <div className="w-5 h-5 mx-auto mb-1 flex items-center justify-center text-[#080503] dark:text-white">
                          {Icon ? <Icon size={16} /> : <span className="text-xs">&mdash;</span>}
                        </div>
                        <span className="text-[10px] font-mono truncate block text-[#080503] dark:text-white">
                          {acc.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: NAME & IDENTITY */}
          {activeStep === 'identity' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1.5">
                  Bot Name
                </label>
                <input
                  type="text"
                  value={profile.botName}
                  onChange={(e) => {
                    onUpdateProfile({ ...profile, botName: e.target.value });
                    updatePersonality({ botName: e.target.value });
                  }}
                  placeholder="e.g. Luminess Prime"
                  className="w-full px-4 py-2.5 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1.5">
                  Tagline / Short Bio
                </label>
                <input
                  type="text"
                  value={profile.tagline || ''}
                  onChange={(e) => onUpdateProfile({ ...profile, tagline: e.target.value })}
                  placeholder="e.g. Frame-by-frame animated 16-bit study coach."
                  className="w-full px-4 py-2.5 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-3">
                  Personality Archetype
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ARCHETYPES.map((arch) => {
                    const isSelected = personality.archetype === arch.id;
                    return (
                      <button
                        key={arch.id}
                        type="button"
                        onClick={() => updatePersonality({ archetype: arch.id as any })}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#38bdf8] bg-[#38bdf8]/10 text-[#080503] dark:text-white shadow-sm'
                            : 'border-[#dad7d0] dark:border-white/10 hover:border-black/30 text-[#5e534a] dark:text-[#a89c92]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#080503] dark:text-white">{arch.title}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10">
                            {arch.tag}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed">{arch.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CHAT & LIVE SANDBOX */}
          {activeStep === 'chat' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1.5">
                  Greeting Message (First words spoken to user)
                </label>
                <input
                  type="text"
                  value={profile.greetingMessage || ''}
                  onChange={(e) => onUpdateProfile({ ...profile, greetingMessage: e.target.value })}
                  placeholder="e.g. Hello Pilot! Luminess is synchronized and standing by."
                  className="w-full px-4 py-2.5 text-sm bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] mb-1.5">
                  Custom AI System Prompt & Guardrails
                </label>
                <textarea
                  rows={3}
                  value={personality.customPrompt || ''}
                  onChange={(e) => updatePersonality({ customPrompt: e.target.value })}
                  placeholder="Define bespoke instructions, coding rules, or conversational tone..."
                  className="w-full px-4 py-2.5 text-xs bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10 rounded-xl focus:outline-none focus:border-[#38bdf8] text-[#080503] dark:text-white leading-relaxed"
                />
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono text-[10px] uppercase text-[#5e534a]">Formality</span>
                    <span className="font-mono font-bold">{personality.formality}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={personality.formality}
                    onChange={(e) => updatePersonality({ formality: Number(e.target.value) })}
                    className="w-full accent-[#38bdf8]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono text-[10px] uppercase text-[#5e534a]">Humor</span>
                    <span className="font-mono font-bold">{personality.humor}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={personality.humor}
                    onChange={(e) => updatePersonality({ humor: Number(e.target.value) })}
                    className="w-full accent-[#38bdf8]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono text-[10px] uppercase text-[#5e534a]">Verbosity</span>
                    <span className="font-mono font-bold">{personality.verbosity}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={personality.verbosity}
                    onChange={(e) => updatePersonality({ verbosity: Number(e.target.value) })}
                    className="w-full accent-[#38bdf8]"
                  />
                </div>
              </div>

              {/* Live Interactive Chat Sandbox */}
              <div className="p-4 rounded-2xl bg-white dark:bg-black/40 border border-[#dad7d0] dark:border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#38bdf8]" />
                    <span className="text-xs font-bold text-[#080503] dark:text-white">
                      Live Chat Sandbox Tester
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500">
                    &bull; Active
                  </span>
                </div>

                <div className="h-40 overflow-y-auto space-y-2 p-2 rounded-xl bg-black/5 dark:bg-black/60 mb-3 text-xs">
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-xl max-w-[85%] ${
                        m.sender === 'user'
                          ? 'ml-auto bg-[#080503] text-white dark:bg-white dark:text-black'
                          : 'bg-white dark:bg-white/10 text-[#080503] dark:text-white border border-[#dad7d0] dark:border-white/10'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                  {isBotReplying && (
                    <div className="text-[10px] font-mono text-[#5e534a] dark:text-[#a89c92]">
                      {profile.botName} is drafting reply...
                    </div>
                  )}
                </div>

                <form onSubmit={handleStudioChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Test chat with ${profile.botName}...`}
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-black/60 border border-[#dad7d0] dark:border-white/10 rounded-xl text-[#080503] dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isBotReplying}
                    className="px-3 py-1.5 rounded-xl bg-[#080503] dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* STEP 4: GITHUB FORK INTEGRATION */}
          {activeStep === 'github' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <GitFork size={18} className="text-[#38bdf8]" />
                  <h4 className="text-sm font-bold text-[#080503] dark:text-white">
                    GitHub Fork Architecture (like Vercel)
                  </h4>
                </div>
                <p className="text-xs text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
                  Every user bot connects fully to GitHub by forking{' '}
                  <span className="font-mono text-[#38bdf8]">jasonhukom/Luminess-Assist</span>. When you customize
                  bot frames, videos, or prompts, your configuration can be directly pushed or synced to your forked
                  repository so your local desktop companion can run it automatically.
                </p>

                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-xs space-y-1">
                  <div className="text-[#5e534a] dark:text-[#a89c92]">Base Upstream:</div>
                  <div className="text-[#080503] dark:text-white font-bold">
                    https://github.com/jasonhukom/Luminess-Assist
                  </div>
                  <div className="text-[#5e534a] dark:text-[#a89c92] pt-1">Your Fork:</div>
                  <div className="text-[#38bdf8] font-bold">
                    {forkUrl}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href="https://github.com/jasonhukom/Luminess-Assist/fork"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#080503] dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
                  >
                    <GitFork size={14} />
                    <span>Fork on GitHub (1-Click)</span>
                    <ExternalLink size={12} className="opacity-60" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const payload = JSON.stringify(profile, null, 2);
                      const blob = new Blob([payload], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `luminess-bot-${profile.pairingCode}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#dad7d0] dark:border-white/15 text-xs font-semibold text-[#080503] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Export Bot Config (.json)</span>
                  </button>
                </div>
              </div>

              {/* Pairing with Desktop App */}
              <div className="p-4 rounded-2xl bg-white dark:bg-black/30 border border-[#dad7d0] dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#080503] dark:text-white">Desktop Pairing Code</span>
                  <span className="text-xs font-mono font-bold text-[#38bdf8]">{profile.pairingCode}</span>
                </div>
                <p className="text-[11px] text-[#5e534a] dark:text-[#a89c92]">
                  Paste this code into the Luminess Assist desktop app to immediately switch to this bot's visual look,
                  per-frame sprites, video loop, and personality.
                </p>
              </div>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="mt-8 pt-6 border-t border-[#dad7d0]/60 dark:border-white/10 flex items-center justify-between">
            <span className="text-xs text-[#5e534a] dark:text-[#a89c92]">
              MariaDB Database Status: <span className="text-emerald-500 font-mono font-semibold">Ready</span>
            </span>

            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#080503] dark:bg-white text-white dark:text-black text-xs font-bold tracking-wide hover:opacity-90 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Database size={14} />
              <span>{isSaving ? 'Saving...' : 'Save & Publish to MariaDB'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotStudioTab;
