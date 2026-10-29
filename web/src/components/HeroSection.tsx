import React, { useState } from 'react';
import { LivingRobot, MascotEmotion } from './LivingRobot.tsx';
import {
  Download,
  Terminal,
  ArrowRight,
  Check,
  Copy,
  Zap,
  ShieldCheck,
  Cpu,
  Sparkles,
  Command,
  MousePointer,
  Keyboard,
  Users,
} from 'lucide-react';
import type { TabKey } from './Navbar.tsx';
import { useLatestRelease } from '../lib/useLatestRelease.ts';

interface HeroSectionProps {
  onNavigateTab: (tab: TabKey) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigateTab }) => {
  const [activeEmotion, setActiveEmotion] = useState<MascotEmotion>('idle');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [activePromptSample, setActivePromptSample] = useState(0);
  const { tagName, exeAsset, msiAsset } = useLatestRelease();

  const installCmd = 'irm https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/install.ps1 | iex';

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(installCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2200);
  };

  const PROMPT_SAMPLES = [
    {
      query: "Organize my Downloads folder by file extension",
      reply: "Scanning ~/Downloads: 14 PDFs, 8 ZIPs, and 23 images sorted into ~/Downloads/Sorted/ with zero disk clutter.",
      emotion: 'joy' as MascotEmotion,
      engine: 'Gemini 2.5 Flash',
    },
    {
      query: "What's my current CPU and RAM usage?",
      reply: "Luminess is consuming 41.8 MB RAM (0.02% CPU). System memory: 12.4 GB / 32 GB available.",
      emotion: 'thinking' as MascotEmotion,
      engine: 'Rust Win32 Core',
    },
    {
      query: "Explain the changes in my active git repository",
      reply: "Detected branch 'main' ahead by 1 commit with Community Bot Hub and live companion pairing ready to ship.",
      emotion: 'curiosity' as MascotEmotion,
      engine: 'Claude 3.5 Sonnet',
    },
  ];

  return (
    <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-32 overflow-hidden blueprint-grid">
      
      {/* Optimus Subtle Architectural Grid Lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute h-px bg-[#080503]/10 dark:bg-white/10" style={{ top: '15%', left: 0, right: 0 }} />
        <div className="absolute h-px bg-[#080503]/10 dark:bg-white/10" style={{ top: '55%', left: 0, right: 0 }} />
        <div className="absolute h-px bg-[#080503]/10 dark:bg-white/10" style={{ top: '85%', left: 0, right: 0 }} />
        <div className="absolute w-px bg-[#080503]/10 dark:bg-white/10" style={{ left: '10%', top: 0, bottom: 0 }} />
        <div className="absolute w-px bg-[#080503]/10 dark:bg-white/10" style={{ left: '90%', top: 0, bottom: 0 }} />
      </div>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 relative z-10">
        
        {/* Eyebrow Header (Optimus style: Horizontal rule + Monospace text) */}
        <div className="mb-6 flex items-center gap-3 animate-fade-in">
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
          <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
            Windows AI Desktop Mascot &bull; Tauri v2 &amp; Rust &bull; {tagName}
          </span>
        </div>

        {/* Massive Editorial Headline */}
        <div className="mb-10 max-w-5xl">
          <h1 className="text-[clamp(2.75rem,7.5vw,7.25rem)] font-display font-bold leading-[0.94] tracking-tight text-[#080503] dark:text-[#fafaf9]">
            The living AI companion
            <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
              to elevate your desktop flow.
            </span>
          </h1>
        </div>

        {/* Split Two-Column: Product Description & Primary Windows Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16 pb-12 border-b border-[#dad7d0] dark:border-white/10">
          
          <div className="lg:col-span-7">
            <p className="text-lg lg:text-xl text-[#5e534a] dark:text-[#a89c92] leading-relaxed max-w-2xl">
              Luminess Assist is a frameless, transparent companion robot designed for Windows. 
              Engineered with <strong className="text-[#080503] dark:text-white font-semibold">Tauri v2 and Rust</strong> for an ultra-compact 2.11 MB binary footprint, 11 emotional expressions, local PC automation, and multi-model intelligence across Gemini 2.5, Claude 3.5, and OpenAI.
            </p>

            {/* Quick Specs Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-6 text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#080503]/5 dark:bg-white/5 border border-[#dad7d0] dark:border-white/10">
                <Zap size={13} className="text-amber-500" />
                <span>2.11 MB Ultra-Compact</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#080503]/5 dark:bg-white/5 border border-[#dad7d0] dark:border-white/10">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>100% Client-Side Local Keys</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#080503]/5 dark:bg-white/5 border border-[#dad7d0] dark:border-white/10">
                <Cpu size={13} className="text-blue-500" />
                <span>Zero Background Drag</span>
              </div>
            </div>
          </div>

          {/* Action CTAs Column */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            
            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Primary Download Pill */}
              <a
                href={exeAsset.url}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] hover:opacity-90 font-mono text-xs font-bold tracking-tight shadow-sm transition-all"
              >
                <Download size={14} />
                <span>DOWNLOAD {tagName} (.EXE)</span>
              </a>

              {/* MSI Installer Pill */}
              <a
                href={msiAsset.url}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-white/5 text-[#080503] dark:text-[#fafaf9] hover:bg-[#080503]/5 dark:hover:bg-white/10 font-mono text-xs font-medium transition-all"
              >
                <span>.MSI INSTALLER</span>
              </a>
            </div>

            {/* Quick Community Bot Hub Pill (Big CTA Button in Hero) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('community')}
                className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-full border-2 border-[#080503] dark:border-white bg-[#080503]/5 dark:bg-white/10 hover:bg-[#080503] hover:text-[#fafaf9] dark:hover:bg-white dark:hover:text-[#080503] text-xs font-mono font-bold text-[#080503] dark:text-[#fafaf9] transition-all cursor-pointer shadow-sm group"
              >
                <Users size={14} className="text-cyan-600 dark:text-cyan-400 group-hover:text-inherit" />
                <span>COMMUNITY BOTS &bull; 24+ MASCOTS</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('install')}
                className="px-3.5 py-3 rounded-full border border-[#dad7d0] dark:border-white/15 hover:border-[#080503] dark:hover:border-white text-xs font-mono text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-[#fafaf9] transition-all cursor-pointer"
                title="Installation Guide"
              >
                <Terminal size={13} />
              </button>
            </div>

            {/* PowerShell Snippet Box with 1-Click Copy */}
            <div className="mt-1 flex items-center justify-between p-2.5 rounded-xl border border-[#dad7d0] dark:border-white/10 bg-[#f3f2ee] dark:bg-[#120f0d] text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="text-[#080503] dark:text-[#fafaf9] font-bold select-none">&gt;</span>
                <span className="truncate select-all">{installCmd}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyInstall}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] text-[11px] font-mono hover:opacity-85 transition-opacity shrink-0 cursor-pointer"
              >
                {copiedCmd ? (
                  <>
                    <Check size={12} />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* =========================================================================
            LIVING PRODUCT DEMONSTRATION SHOWCASE (Optimus Architectural Frame)
           ========================================================================= */}
        <div className="relative rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] shadow-sm overflow-hidden crosshair-corner">
          
          {/* Mockup Frame Header */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-[#dad7d0] dark:border-white/10 bg-[#f3f2ee] dark:bg-[#171411] text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
            
            {/* Window Dots & Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dad7d0] dark:bg-white/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#dad7d0] dark:bg-white/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#dad7d0] dark:bg-white/20" />
              </div>
              <span className="font-semibold text-[#080503] dark:text-[#fafaf9]">
                Luminess-Assist.exe
              </span>
              <span className="hidden sm:inline text-[11px] opacity-60">
                [FRAMELESS TRANSPARENT RUNTIME]
              </span>
            </div>

            {/* Right Telemetry info */}
            <div className="flex items-center gap-4 text-[11px]">
              <span className="hidden md:inline">
                STATUS: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">ONLINE</strong>
              </span>
              <span>
                MEMORY: <strong className="text-[#080503] dark:text-[#fafaf9] font-mono">41.8 MB</strong>
              </span>
              <span className="hidden lg:inline">
                FPS: <strong className="text-[#080503] dark:text-[#fafaf9] font-mono">60.0</strong>
              </span>
            </div>

          </div>

          {/* Mockup Body Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10 items-center blueprint-grid-dense">
            
            {/* Left: The Mascot Robot & Emotion Controller */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-xl border border-[#dad7d0]/60 dark:border-white/5 bg-[#fafaf9] dark:bg-[#0c0907] relative">
              
              <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92]">
                Interactive Eye-Tracking
              </div>

              {/* The Robot Mascot */}
              <div className="my-2">
                <LivingRobot
                  currentEmotion={activeEmotion}
                  onEmotionChange={setActiveEmotion}
                  size={220}
                  interactive={true}
                />
              </div>

              {/* Emotion Selector Chips */}
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {(['idle', 'joy', 'curiosity', 'love', 'surprise', 'thinking'] as MascotEmotion[]).map((emo) => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => setActiveEmotion(emo)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono capitalize transition-all cursor-pointer ${
                      activeEmotion === emo
                        ? 'bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] font-semibold'
                        : 'bg-[#080503]/5 dark:bg-white/5 text-[#5e534a] dark:text-[#a89c92] hover:bg-[#080503]/10 dark:hover:bg-white/10'
                    }`}
                  >
                    {emo}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-center font-mono text-[#5e534a] dark:text-[#a89c92]">
                Hover to test eye tracking &bull; Click robot for audio chirp
              </p>

            </div>

            {/* Right: Live Interactive Companion Dialogue & Keyboard Shortcuts HUD */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Prompt Scenario Selector */}
              <div>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] block mb-2">
                  Sample Desktop Instructions (Click to Test):
                </span>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_SAMPLES.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActivePromptSample(idx);
                        setActiveEmotion(sample.emotion);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono text-left transition-all cursor-pointer border ${
                        activePromptSample === idx
                          ? 'border-[#080503] dark:border-white bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] font-semibold'
                          : 'border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#171411] text-[#5e534a] dark:text-[#a89c92] hover:border-[#080503]/40'
                      }`}
                    >
                      {sample.query}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulated Live Response Box */}
              <div className="p-5 rounded-xl border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-1.5 font-bold text-[#080503] dark:text-[#fafaf9]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    LUMINESS RESPONSE
                  </span>
                  <span className="text-[11px] text-[#5e534a] dark:text-[#a89c92] px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                    Model: {PROMPT_SAMPLES[activePromptSample].engine}
                  </span>
                </div>
                
                <p className="text-sm font-sans text-[#080503] dark:text-[#fafaf9] leading-relaxed">
                  {PROMPT_SAMPLES[activePromptSample].reply}
                </p>

                <div className="flex items-center gap-2 pt-2 border-t border-[#dad7d0]/60 dark:border-white/5 text-[11px] font-mono text-[#5e534a] dark:text-[#a89c92]">
                  <span>Execution: 12ms</span>
                  <span>&bull;</span>
                  <span>Sandbox Security: Verified</span>
                  <span>&bull;</span>
                  <span>Win32 API: Hooked</span>
                </div>
              </div>

              {/* Real Shortcuts HUD (From Latest App Features) */}
              <div>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#5e534a] dark:text-[#a89c92] block mb-2">
                  Windows Companion Shortcuts:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  
                  <div className="p-2.5 rounded-lg border border-[#dad7d0]/80 dark:border-white/10 bg-white dark:bg-[#171411] flex items-center justify-between">
                    <span className="text-[#5e534a] dark:text-[#a89c92]">Move bot to cursor</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#080503]/5 dark:bg-white/10 border border-[#dad7d0] dark:border-white/20 font-bold text-[#080503] dark:text-white">
                      Alt + Left Click
                    </kbd>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#dad7d0]/80 dark:border-white/10 bg-white dark:bg-[#171411] flex items-center justify-between">
                    <span className="text-[#5e534a] dark:text-[#a89c92]">Toggle chat window</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#080503]/5 dark:bg-white/10 border border-[#dad7d0] dark:border-white/20 font-bold text-[#080503] dark:text-white">
                      Win + Shift + C
                    </kbd>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#dad7d0]/80 dark:border-white/10 bg-white dark:bg-[#171411] flex items-center justify-between">
                    <span className="text-[#5e534a] dark:text-[#a89c92]">Dock vertical flip</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#080503]/5 dark:bg-white/10 border border-[#dad7d0] dark:border-white/20 font-bold text-[#080503] dark:text-white">
                      Page Up / Down
                    </kbd>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#dad7d0]/80 dark:border-white/10 bg-white dark:bg-[#171411] flex items-center justify-between">
                    <span className="text-[#5e534a] dark:text-[#a89c92]">Terminate Luminess</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#080503]/5 dark:bg-white/10 border border-[#dad7d0] dark:border-white/20 font-bold text-[#080503] dark:text-white">
                      Win + Esc
                    </kbd>
                  </div>

                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
