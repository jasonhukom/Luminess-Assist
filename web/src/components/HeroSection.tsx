import React, { useState } from 'react';
import { LivingRobot, MascotEmotion } from './LivingRobot.tsx';
import { 
  Sparkles, 
  Terminal, 
  Download, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  Zap, 
  Eye, 
  Compass,
  ArrowRight
} from 'lucide-react';
import type { TabKey } from './Navbar.tsx';
import { useLatestRelease } from '../lib/useLatestRelease.ts';

interface HeroSectionProps {
  onNavigateTab: (tab: TabKey) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigateTab }) => {
  const [activeEmotion, setActiveEmotion] = useState<MascotEmotion>('idle');
  const { tagName, exeAsset } = useLatestRelease();

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:py-20">
      
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/15 via-purple-500/15 to-blue-500/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-[280px] h-[280px] bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            
            {/* Top Chip */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 text-xs font-mono tracking-wide shadow-[0_0_16px_rgba(56,189,248,0.2)]">
              <Sparkles size={14} className="text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="font-semibold">RELEASE {tagName} IS LIVE</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">Tauri 2 + Multi-AI Engine</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              The Living AI Mascot{' '}
              <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-purple-400 bg-clip-text text-transparent text-glow-cyan">
                on Your Desktop
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
              Luminess Assist is a floating, transparent companion robot for Windows. Powered by 
              <strong className="text-cyan-300 font-medium"> Gemini 2.5</strong>, 
              <strong className="text-orange-300 font-medium"> Claude 3.5</strong>, and 
              <strong className="text-emerald-300 font-medium"> OpenAI Codex</strong>. 
              Zero background drag, 11 emotional expressions, and native PC task execution.
            </p>

            {/* Quick Feature Badges */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <Zap size={14} className="text-amber-400" />
                <span>2.11 MB Ultra-Lightweight</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Client-Side Local API Keys</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <Cpu size={14} className="text-cyan-400" />
                <span>Native Rust + Tauri v2</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <button
                type="button"
                onClick={() => onNavigateTab('install')}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 font-mono font-bold text-sm tracking-wide shadow-[0_0_28px_rgba(56,189,248,0.5)] hover:shadow-[0_0_36px_rgba(56,189,248,0.7)] transition-all duration-200 cursor-pointer"
              >
                <Terminal size={17} />
                <span>RUN POWERSHELL INSTALLER</span>
                <ArrowRight size={15} />
              </button>

              <a
                href={exeAsset.url}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.12] hover:border-cyan-400/40 text-slate-200 hover:text-white font-mono text-sm transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.4)]"
              >
                <Download size={16} className="text-cyan-400" />
                <span>Download {tagName} (.exe)</span>
              </a>
            </div>

            {/* Quick Terminal snippet preview */}
            <div className="pt-2">
              <div 
                onClick={() => onNavigateTab('install')}
                className="p-3 rounded-xl bg-[#090b14]/90 border border-cyan-500/20 max-w-xl mx-auto lg:mx-0 flex items-center justify-between gap-3 text-xs font-mono text-slate-400 hover:border-cyan-400/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-cyan-400 font-bold">$</span>
                  <span className="truncate text-slate-300">
                    irm https://raw.githubusercontent.com/.../install.ps1 | iex
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                  Click to View & Copy
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Living Robot Showcase */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.06] via-white/[0.02] to-transparent border border-white/[0.1] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] w-full max-w-md flex flex-col items-center">
              
              {/* Corner decorative cyberpunk ticks */}
              <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-cyan-400/60" />
              <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-cyan-400/60" />
              <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-cyan-400/60" />
              <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-cyan-400/60" />

              {/* Header inside card */}
              <div className="w-full flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  MASCOT SIMULATOR
                </span>
                <span>DESKTOP PREVIEW</span>
              </div>

              {/* The Robot */}
              <LivingRobot
                currentEmotion={activeEmotion}
                onEmotionChange={setActiveEmotion}
                size={240}
                interactive={true}
              />

              {/* Hint badge */}
              <p className="mt-4 text-[11px] text-center text-slate-400 font-mono">
                💡 <span className="text-slate-300">Hover & move your cursor</span> to watch Luminess track your eyes. Click to trigger audio feedback and emotion shifts!
              </p>

            </div>
          </div>

        </div>

        {/* Feature Grid Spotlight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-12 border-t border-white/[0.06]">
          
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07] hover:border-cyan-500/30 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 border border-cyan-500/20">
              <Compass size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Frameless & Transparent</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Lives gracefully above your editor, browser, or games. Drag it anywhere, resize with your mouse wheel, or let it glide back with smooth physics.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07] hover:border-purple-500/30 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 border border-purple-500/20">
              <Cpu size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">3 AI Engines in One</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Switch on the fly between Google Gemini, Anthropic Claude, and OpenAI Codex/GPT. Save credentials locally without sending tokens to third-party relays.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07] hover:border-emerald-500/30 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Local Desktop Tools</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Supported actions include inspecting directory trees, opening files, and executing PowerShell commands—protected by mandatory permission approval dialogues.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
