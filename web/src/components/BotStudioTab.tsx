import React, { useState } from 'react';
import {
  Sparkles,
  Palette,
  Volume2,
  Sliders,
  ShieldCheck,
  Download,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Laptop,
  Play,
  Heart,
  Smile,
  HelpCircle,
  Wand2,
  Headphones,
  Eye,
  Crown,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import {
  type BotProfile,
  type AppearanceConfig,
  type PersonalityConfig,
  type VoiceConfig,
  type BotPermissions,
  generatePairingCode,
} from '../lib/botPlatformStore.ts';

interface BotStudioTabProps {
  profile: BotProfile;
  onUpdateProfile: (updated: BotProfile) => void;
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
  { id: 'headphones', label: 'Studio Headphones', icon: Headphones },
  { id: 'cat_ears', label: 'Cyber Cat Ears', icon: Radio },
  { id: 'wizard_hat', label: 'Wizard Hat', icon: Wand2 },
  { id: 'visor', label: 'AR Cyber Visor', icon: Eye },
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

const VOICES = [
  { id: 'luna-neural', name: 'Luna Neural', desc: 'Female, expressive & crisp', defaultPitch: 1.1, defaultSpeed: 1.0 },
  { id: 'jarvis-male', name: 'Jarvis AI', desc: 'Male, calm & authoritative', defaultPitch: 0.9, defaultSpeed: 0.95 },
  { id: 'nova-cyber', name: 'Nova Synth', desc: 'Playful cyber synth robotic tone', defaultPitch: 1.25, defaultSpeed: 1.05 },
  { id: 'echo-soft', name: 'Echo Soft', desc: 'Gentle, soothing companion voice', defaultPitch: 1.0, defaultSpeed: 0.9 },
];

export const BotStudioTab: React.FC<BotStudioTabProps> = ({ profile, onUpdateProfile }) => {
  const [activeStep, setActiveStep] = useState<'appearance' | 'personality' | 'permissions' | 'sync'>('appearance');
  const [testEmotion, setTestEmotion] = useState<'idle' | 'joy' | 'puzzled' | 'love'>('idle');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const { appearance, personality, voice, permissions, pairingCode } = profile;

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
    });
  };

  const updateVoice = (patch: Partial<VoiceConfig>) => {
    onUpdateProfile({
      ...profile,
      voice: { ...voice, ...patch },
    });
  };

  const updatePermissions = (patch: Partial<BotPermissions>) => {
    onUpdateProfile({
      ...profile,
      permissions: { ...permissions, ...patch },
    });
  };

  const handleRegenerateCode = () => {
    onUpdateProfile({
      ...profile,
      pairingCode: generatePairingCode(),
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const deepLink = `luminess://sync?code=${pairingCode}`;
    navigator.clipboard.writeText(deepLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadConfig = () => {
    const payload = JSON.stringify(profile, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luminess-${profile.botName.toLowerCase().replace(/\s+/g, '-')}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePlayVoicePreview = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsPlayingAudio(true);

    const greeting =
      personality.archetype === 'witty_hacker'
        ? `Hey! I'm ${personality.botName}. Your desktop companion is online and ready to cause some orderly chaos.`
        : personality.archetype === 'study_buddy'
          ? `Hello ${personality.userName || 'there'}! I'm ${personality.botName}. Let's set a 25-minute Pomodoro timer and get to work!`
          : personality.archetype === 'coder'
            ? `Greetings! I am ${personality.botName}. Copy any error trace to your clipboard and I will diagnose it.`
            : `Hello! I am ${personality.botName}, your personal desktop assistant. Ready to manage your Windows tasks.`;

    const utterance = new SpeechSynthesisUtterance(greeting);
    utterance.pitch = voice.pitch;
    utterance.rate = voice.speed;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Studio Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] p-6 sm:p-8 shadow-sm crosshair-corner">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dad7d0] dark:border-white/15 bg-[#080503]/5 dark:bg-white/5 px-3 py-1 font-mono text-[10px] font-semibold text-[#080503] dark:text-[#fafaf9] mb-3 uppercase tracking-wider">
              <Sparkles size={12} />
              <span>BOT STUDIO &bull; COMPANION CREATOR</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
              Design Your Desktop{' '}
              <span className="editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
                AI Companion
              </span>
            </h1>
            <p className="mt-2 text-sm text-[#5e534a] dark:text-[#a89c92] max-w-2xl leading-relaxed">
              Customize visual looks, personality matrix, voice pitch, and Windows PC permissions. When you're ready, pair it instantly to your desktop companion with one click.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-white/5 text-xs font-mono font-medium text-[#080503] dark:text-[#fafaf9] hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copiedLink ? 'Deep Link Copied' : 'Copy Deep Link'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadConfig}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] hover:opacity-90 text-xs font-mono font-bold tracking-tight shadow-sm transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>Export Config</span>
            </button>
          </div>
        </div>

        {/* 4-Step Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-8 pt-6 border-t border-[#dad7d0]/60 dark:border-white/10">
          {[
            { id: 'appearance', label: '01. Appearance', icon: Palette, summary: appearance.paletteName },
            { id: 'personality', label: '02. C.R.O.C. Matrix', icon: Sliders, summary: personality.botName },
            { id: 'permissions', label: '03. PC Permissions', icon: ShieldCheck, summary: 'Windows Loadout' },
            { id: 'sync', label: '04. Sync & Deploy', icon: Laptop, summary: `Code: ${pairingCode}` },
          ].map((step) => {
            const isActive = activeStep === step.id;
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id as any)}
                className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#080503] dark:border-white bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] shadow-sm'
                    : 'border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] hover:border-[#080503]/30 text-[#5e534a] dark:text-[#a89c92]'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-white/20 dark:bg-black/20' : 'bg-black/5 dark:bg-white/10'}`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {step.label}
                  </div>
                  <div className={`text-[11px] truncate font-mono ${isActive ? 'opacity-80' : 'text-[#5e534a] dark:text-[#a89c92]'}`}>
                    {step.summary}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Viewport on Left/Top, Controls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Live Visual Mascot Viewport */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="relative rounded-3xl border border-white/10 bg-[#070913] p-6 shadow-2xl overflow-hidden flex flex-col items-center justify-center min-h-[380px]">
            {/* Ambient Background Grid and Glow */}
            <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
            <div
              className="absolute w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700"
              style={{ background: appearance.color, opacity: 0.2 }}
            />

            {/* Model Badge */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-slate-300 backdrop-blur-md">
                MODEL: {appearance.model.toUpperCase()}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 backdrop-blur-md">
                {appearance.paletteName}
              </span>
            </div>

            {/* LIVE MASCOT VISUAL RENDERER */}
            <div className="relative z-10 flex flex-col items-center justify-center transition-all duration-300 my-6" style={{ transform: `scale(${appearance.scale})` }}>
              
              {/* Accessory Rendering */}
              {appearance.accessory === 'wizard_hat' && (
                <div className="relative -mb-4 z-30 transition-transform animate-bounce-subtle">
                  <svg width="84" height="60" viewBox="0 0 100 80" className="filter drop-shadow-[0_0_12px_rgba(168,85,247,0.7)]">
                    <polygon points="50,5 20,65 80,65" fill="#581c87" stroke="#c084fc" strokeWidth="2.5" />
                    <ellipse cx="50" cy="65" rx="42" ry="8" fill="#3b0764" stroke="#c084fc" strokeWidth="2" />
                    <rect x="35" y="58" width="30" height="7" rx="2" fill="#facc15" />
                    <circle cx="50" cy="5" r="4" fill="#facc15" />
                  </svg>
                </div>
              )}

              {appearance.accessory === 'cat_ears' && (
                <div className="flex justify-between w-32 -mb-5 z-30 px-3">
                  <div className="w-7 h-8 bg-slate-900 border-2 rounded-t-lg transform -rotate-12" style={{ borderColor: appearance.color }}>
                    <div className="w-3 h-5 mx-auto mt-1 rounded-t-md opacity-80" style={{ background: appearance.color }} />
                  </div>
                  <div className="w-7 h-8 bg-slate-900 border-2 rounded-t-lg transform rotate-12" style={{ borderColor: appearance.color }}>
                    <div className="w-3 h-5 mx-auto mt-1 rounded-t-md opacity-80" style={{ background: appearance.color }} />
                  </div>
                </div>
              )}

              {appearance.accessory === 'halo' && (
                <div className="w-36 h-8 rounded-full border-2 border-amber-300 bg-amber-300/20 shadow-[0_0_20px_rgba(252,211,77,0.8)] -mb-4 z-30 animate-pulse" />
              )}

              {/* MODEL 1: 3D Robot Mascot */}
              {appearance.model === 'robot' && (
                <div className="relative w-40 h-40 flex items-center justify-center animate-bob">
                  {/* Head body */}
                  <div
                    className="relative w-36 h-32 rounded-3xl border-2 flex flex-col items-center justify-center p-3 shadow-2xl transition-all duration-300 bg-gradient-to-b from-slate-900 to-[#0e1322]"
                    style={{ borderColor: appearance.color, boxShadow: `0 0 35px ${appearance.color}40` }}
                  >
                    {/* Antenna */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full animate-ping" style={{ background: appearance.color }} />
                      <div className="w-1.5 h-4 bg-slate-700 -mt-1.5" />
                    </div>

                    {/* Visor Screen */}
                    <div className="w-full h-16 rounded-2xl bg-[#03050a] border border-white/10 flex items-center justify-around px-4 shadow-inner relative overflow-hidden">
                      {/* Scanline overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent pointer-events-none" />

                      {/* Visor Eyes based on Test Emotion */}
                      {testEmotion === 'idle' && (
                        <>
                          <div className="w-5 h-7 rounded-full shadow-[0_0_12px]" style={{ background: appearance.color, boxShadow: `0 0 15px ${appearance.color}` }} />
                          <div className="w-5 h-7 rounded-full shadow-[0_0_12px]" style={{ background: appearance.color, boxShadow: `0 0 15px ${appearance.color}` }} />
                        </>
                      )}
                      {testEmotion === 'joy' && (
                        <>
                          <div className="w-6 h-4 border-t-4 rounded-t-full" style={{ borderColor: appearance.color }} />
                          <div className="w-6 h-4 border-t-4 rounded-t-full" style={{ borderColor: appearance.color }} />
                        </>
                      )}
                      {testEmotion === 'puzzled' && (
                        <>
                          <div className="w-5 h-2 rounded-full" style={{ background: appearance.color }} />
                          <div className="w-6 h-6 rounded-full" style={{ background: appearance.color }} />
                        </>
                      )}
                      {testEmotion === 'love' && (
                        <>
                          <span className="text-xl animate-pulse">💖</span>
                          <span className="text-xl animate-pulse">💖</span>
                        </>
                      )}
                    </div>

                    {/* Speaker grill */}
                    <div className="flex gap-1.5 mt-2.5">
                      <div className="w-3 h-1 rounded-full bg-slate-700" />
                      <div className="w-5 h-1 rounded-full" style={{ background: appearance.color }} />
                      <div className="w-3 h-1 rounded-full bg-slate-700" />
                    </div>
                  </div>

                  {/* Headphones accessory */}
                  {appearance.accessory === 'headphones' && (
                    <div className="absolute inset-x-0 flex items-center justify-between -mx-3 z-30">
                      <div className="w-6 h-12 rounded-xl border-2 bg-slate-900 shadow-lg" style={{ borderColor: appearance.color }} />
                      <div className="w-6 h-12 rounded-xl border-2 bg-slate-900 shadow-lg" style={{ borderColor: appearance.color }} />
                    </div>
                  )}

                  {/* Cyber Visor accessory */}
                  {appearance.accessory === 'visor' && (
                    <div className="absolute top-12 inset-x-2 h-8 rounded-lg border bg-cyan-400/30 backdrop-blur-sm z-30 flex items-center justify-center font-mono text-[9px] text-cyan-200" style={{ borderColor: appearance.color }}>
                      &lt;SYS.HUD&gt;
                    </div>
                  )}
                </div>
              )}

              {/* MODEL 2: Minimalist Floating Energy Orb */}
              {appearance.model === 'orb' && (
                <div className="relative w-40 h-40 flex items-center justify-center animate-pulse">
                  {/* Outer Orbit Rings */}
                  <div className="absolute inset-0 rounded-full border border-dashed animate-spin-slow opacity-60" style={{ borderColor: appearance.color }} />
                  <div className="absolute inset-2 rounded-full border border-dotted animate-spin-reverse opacity-40" style={{ borderColor: appearance.color }} />
                  
                  {/* Energy Core */}
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl relative"
                    style={{ background: `radial-gradient(circle, ${appearance.color} 20%, #030712 90%)`, boxShadow: `0 0 50px ${appearance.color}` }}
                  >
                    <div className="w-10 h-10 rounded-full bg-white blur-sm opacity-90 animate-ping" />
                    <div className="absolute text-center font-mono text-[10px] font-bold text-white uppercase tracking-tighter">
                      {testEmotion === 'love' ? '💖' : testEmotion === 'joy' ? '⚡' : 'AURA'}
                    </div>
                  </div>
                </div>
              )}

              {/* MODEL 3: Pixel Art Sprite */}
              {appearance.model === 'pixel' && (
                <div className="w-36 h-36 border-4 bg-slate-950 p-3 shadow-2xl flex flex-col items-center justify-between font-mono relative" style={{ borderColor: appearance.color }}>
                  <div className="w-full flex justify-between px-2 pt-1 text-[10px]" style={{ color: appearance.color }}>
                    <span>[8-BIT]</span>
                    <span>100%</span>
                  </div>
                  <div className="w-28 h-16 bg-[#090d1a] border-2 border-white/20 flex items-center justify-around px-3" style={{ borderColor: appearance.color }}>
                    <div className="w-4 h-4" style={{ background: appearance.color }} />
                    <div className="w-4 h-4" style={{ background: appearance.color }} />
                  </div>
                  <div className="w-16 h-2" style={{ background: appearance.color }} />
                </div>
              )}

              {/* MODEL 4: 2D VTuber Anime Mascot */}
              {appearance.model === 'vtuber' && (
                <div className="relative w-36 h-36 rounded-full border-2 bg-gradient-to-tr from-[#110f26] to-[#1e1338] flex flex-col items-center justify-center shadow-2xl p-4 overflow-hidden" style={{ borderColor: appearance.color }}>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">✨</div>
                  <div className="w-16 h-16 rounded-full border border-white/30 flex items-center justify-around bg-black/40 px-2 mt-2">
                    <div className="w-3 h-5 rounded-full" style={{ background: appearance.color }} />
                    <div className="w-3 h-5 rounded-full" style={{ background: appearance.color }} />
                  </div>
                  <div className="w-8 h-2 rounded-full mt-2" style={{ background: appearance.color }} />
                </div>
              )}

            </div>

            {/* Emote Interactive Playground */}
            <div className="w-full pt-4 border-t border-white/[0.08] flex items-center justify-between z-20">
              <span className="text-[11px] font-mono text-slate-400">TEST EMOTION:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { key: 'idle', label: 'Idle', icon: Smile },
                  { key: 'joy', label: 'Joy', icon: Sparkles },
                  { key: 'puzzled', label: 'Puzzled', icon: HelpCircle },
                  { key: 'love', label: 'Love', icon: Heart },
                ].map((emo) => {
                  const Icon = emo.icon;
                  const isSelected = testEmotion === emo.key;
                  return (
                    <button
                      key={emo.key}
                      type="button"
                      onClick={() => setTestEmotion(emo.key as any)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon size={12} />
                      <span>{emo.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Quick Pairing Token Pill */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-cyan-300">
                #
              </div>
              <div>
                <div className="text-xs text-slate-400">Desktop Pairing Token</div>
                <div className="text-sm font-mono font-bold text-white tracking-widest">{pairingCode}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRegenerateCode}
                title="Generate new token"
                className="p-2 rounded-lg border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <RefreshCw size={14} />
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30 text-xs font-mono font-bold cursor-pointer"
              >
                {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedCode ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customizer Controls based on Active Step */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* STEP 1: APPEARANCE */}
          {activeStep === 'appearance' && (
            <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Palette className="text-cyan-400" size={18} />
                  <span>Choose Visual Avatar Model</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select your desktop companion's rendering engine and form factor.
                </p>
              </div>

              {/* Base Model Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'robot', name: '3D Luminess Robot', desc: 'Living expressive robot with animated visor eyes & antenna.' },
                  { id: 'orb', name: 'Minimalist Energy Orb', desc: 'Futuristic floating orb with pulsing orbital energy rings.' },
                  { id: 'pixel', name: 'Pixel Art Cyber Sprite', desc: '16-bit retro arcade robot mascot for vintage desktop aesthetics.' },
                  { id: 'vtuber', name: '2D VTuber Anime Hologram', desc: 'Stylized cyber anime hologram with digital reactive emotions.' },
                ].map((item) => {
                  const isSelected = appearance.model === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateAppearance({ model: item.id as any })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                          : 'border-white/[0.08] bg-black/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                          {item.name}
                        </span>
                        {isSelected && <CheckCircle2 size={16} className="text-cyan-400" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Color Palette Selector */}
              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <label className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider block">
                  Color Palette &amp; Glow Hue
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {COLOR_PRESETS.map((color) => {
                    const isSelected = appearance.color === color.hex;
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => updateAppearance({ color: color.hex, paletteName: color.name })}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected ? 'border-white bg-white/10' : 'border-white/[0.08] bg-black/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full border border-white/30 shrink-0" style={{ background: color.hex }} />
                        <span className="text-xs font-medium text-slate-200 truncate">{color.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accessories Selector */}
              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <label className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider block">
                  Companion Accessories
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ACCESSORIES.map((acc) => {
                    const isSelected = appearance.accessory === acc.id;
                    const Icon = acc.icon;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => updateAppearance({ accessory: acc.id as any })}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/[0.08] bg-black/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        {Icon ? <Icon size={16} className={isSelected ? 'text-cyan-300' : 'text-slate-400'} /> : <div className="w-4 h-4 rounded-full border border-slate-600" />}
                        <span className={`text-xs font-medium truncate ${isSelected ? 'text-cyan-200' : 'text-slate-300'}`}>{acc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scale Slider */}
              <div className="pt-4 border-t border-white/[0.08] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-300">COMPANION DISPLAY SCALE</span>
                  <span className="font-mono text-cyan-300 font-bold">{appearance.scale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.05"
                  value={appearance.scale}
                  onChange={(e) => updateAppearance({ scale: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStep('personality')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold cursor-pointer"
                >
                  <span>NEXT: PERSONALITY MATRIX</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PERSONALITY (C.R.O.C. FRAMEWORK) */}
          {activeStep === 'personality' && (
            <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="text-cyan-400" size={18} />
                  <span>C.R.O.C. Personality Matrix &amp; Voice</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Tune behavior archetypes, speech style sliders, and preview audio speech synthesis.
                </p>
              </div>

              {/* Bot and User Name inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-slate-300 uppercase block mb-1">Bot Name</label>
                  <input
                    type="text"
                    value={personality.botName}
                    onChange={(e) => updatePersonality({ botName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm outline-none focus:border-cyan-400"
                    placeholder="e.g. Luminess, AURA, Jarvis"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-slate-300 uppercase block mb-1">Call Me (Your Name)</label>
                  <input
                    type="text"
                    value={personality.userName}
                    onChange={(e) => updatePersonality({ userName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm outline-none focus:border-cyan-400"
                    placeholder="e.g. Pilot, Jason, Master"
                  />
                </div>
              </div>

              {/* Archetype Selector */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider block">
                  Role Archetype
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ARCHETYPES.map((arch) => {
                    const isSelected = personality.archetype === arch.id;
                    return (
                      <button
                        key={arch.id}
                        type="button"
                        onClick={() => updatePersonality({ archetype: arch.id as any })}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/[0.08] bg-black/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-white'}`}>{arch.title}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">{arch.tag}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{arch.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tone Sliders */}
              <div className="pt-4 border-t border-white/[0.08] space-y-4">
                <label className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider block">
                  Tone &amp; Attitude Sliders
                </label>

                {/* Sarcastic vs Polite */}
                <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-mono">HUMOR: Sarcastic (10) ↔ Polite (0)</span>
                    <span className="font-mono text-cyan-300 font-bold">{personality.humor}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={personality.humor}
                    onChange={(e) => updatePersonality({ humor: parseInt(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Gentle &amp; Polite</span>
                    <span>Witty / Sarcastic</span>
                  </div>
                </div>

                {/* Talkative vs Concise */}
                <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-mono">VERBOSITY: Concise (0) ↔ Detailed (10)</span>
                    <span className="font-mono text-cyan-300 font-bold">{personality.verbosity}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={personality.verbosity}
                    onChange={(e) => updatePersonality({ verbosity: parseInt(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1-2 Sentences</span>
                    <span>Deep Explanations</span>
                  </div>
                </div>
              </div>

              {/* Voice Selection & TTS Preview */}
              <div className="pt-4 border-t border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider block">
                    Text-To-Speech (TTS) Voice Engine
                  </label>
                  <button
                    type="button"
                    onClick={handlePlayVoicePreview}
                    disabled={isPlayingAudio}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/30 text-xs font-mono font-bold cursor-pointer transition-all"
                  >
                    {isPlayingAudio ? <Volume2 size={13} className="animate-spin" /> : <Play size={13} />}
                    <span>{isPlayingAudio ? 'Speaking...' : 'Test Voice Audio'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {VOICES.map((v) => {
                    const isSelected = voice.voiceId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => updateVoice({ voiceId: v.id, voiceName: v.name, pitch: v.defaultPitch, speed: v.defaultSpeed })}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/[0.08] bg-black/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="text-xs font-bold text-white">{v.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{v.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep('appearance')}
                  className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white font-mono text-xs cursor-pointer"
                >
                  ← BACK
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('permissions')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold cursor-pointer"
                >
                  <span>NEXT: PC PERMISSIONS</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PERMISSIONS */}
          {activeStep === 'permissions' && (
            <div className="rounded-3xl border border-white/10 bg-[#070912] p-6 sm:p-8 space-y-6 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="text-cyan-400" size={18} />
                  <span>Windows Skill &amp; Permission Loadout</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure what your desktop mascot is allowed to do on your Windows PC.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'canOpenApps', title: 'Allow Application Launching', desc: 'Can open notepad, browser tabs, steam games, or calculator when asked.' },
                  { key: 'canSortFiles', title: 'Allow File Management & Cleaning', desc: 'Can inspect Downloads and organize messy desktop files into subfolders.' },
                  { key: 'canReadSystemStats', title: 'Allow Hardware Monitoring', desc: 'Can check CPU, RAM usage, and advise you when heavy tasks slow down PC.' },
                  { key: 'canSetTimers', title: 'Allow Focus Timers & Pomodoro', desc: 'Can trigger visual countdown timers and alerts on your desktop.' },
                  { key: 'canReadClipboard', title: 'Read Clipboard Content', desc: 'Can inspect copied code snippets or error text for instant analysis.' },
                  { key: 'canWriteClipboard', title: 'Copy Text to Clipboard', desc: 'Can place generated code or solutions straight into your clipboard.' },
                  { key: 'canExecuteCommands', title: 'PowerShell Automation (Requires Prompts)', desc: 'Can run terminal scripts on your PC. Always prompts for approval before executing.' },
                ].map((perm) => {
                  const isChecked = (permissions as any)[perm.key] ?? false;
                  return (
                    <label
                      key={perm.key}
                      className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-white/[0.08] bg-black/20 hover:bg-white/[0.03] cursor-pointer transition-all"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">{perm.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{perm.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => updatePermissions({ [perm.key]: e.target.checked } as any)}
                        className="mt-1 w-4 h-4 rounded accent-cyan-400 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStep('personality')}
                  className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white font-mono text-xs cursor-pointer"
                >
                  ← BACK
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('sync')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold cursor-pointer"
                >
                  <span>NEXT: SYNC &amp; DEPLOY</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SYNC & DEPLOY */}
          {activeStep === 'sync' && (
            <div className="rounded-3xl border border-cyan-500/40 bg-[#070914] p-6 sm:p-8 space-y-6 shadow-2xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Laptop className="text-cyan-400" size={18} />
                  <span>Sync Customized Companion to Desktop</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect your web creation directly to the Windows application.
                </p>
              </div>

              {/* Pairing Token Card */}
              <div className="p-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-blue-950/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold block mb-1">
                      1-CLICK PAIRING TOKEN
                    </span>
                    <span className="text-3xl font-mono font-extrabold text-white tracking-widest">
                      {pairingCode}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      Type this code in your Luminess desktop settings to instantly adopt this bot.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-mono font-bold tracking-wide shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-pointer"
                  >
                    {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedCode ? 'COPIED TO CLIPBOARD!' : 'COPY PAIRING CODE'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Deploy Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <ExternalLink size={14} className="text-purple-400" />
                    <span>Deep Link Sync</span>
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    If Luminess is already installed on this PC, clicking below triggers the desktop protocol handler.
                  </p>
                  <a
                    href={`luminess://sync?code=${pairingCode}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30 text-xs font-mono font-bold mt-2 cursor-pointer"
                  >
                    <span>Launch `luminess://sync`</span>
                  </a>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Download size={14} className="text-cyan-400" />
                    <span>Export JSON Profile</span>
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Save the custom appearance, persona prompt, and permission flags as a portable config file.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadConfig}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30 text-xs font-mono font-bold mt-2 cursor-pointer"
                  >
                    <span>Download `luminess-bot.json`</span>
                  </button>
                </div>
              </div>

              {/* PowerShell 1-liner */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <span className="text-xs font-mono text-slate-300 uppercase block">
                  First-Time Install PowerShell Command (Pre-configured)
                </span>
                <div className="p-3 rounded-xl bg-black border border-white/10 font-mono text-xs text-cyan-300 flex items-center justify-between overflow-x-auto">
                  <code>
                    irm https://github.com/jasonhukom/Luminess-Assist/releases/latest/download/install.ps1 | iex
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        'irm https://github.com/jasonhukom/Luminess-Assist/releases/latest/download/install.ps1 | iex'
                      );
                    }}
                    className="ml-3 p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white shrink-0 cursor-pointer"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
