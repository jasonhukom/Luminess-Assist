import React, { useState } from 'react';
import {
  Cpu,
  Zap,
  Terminal,
  MousePointer,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  ArrowRight,
  Command,
  Sliders,
  Layers,
  Code2,
  HardDrive,
} from 'lucide-react';
import type { TabKey } from './Navbar.tsx';

interface FeaturesBentoProps {
  onNavigateTab: (tab: TabKey) => void;
}

export const FeaturesBento: React.FC<FeaturesBentoProps> = ({ onNavigateTab }) => {
  const [copiedCmd, setCopiedCmd] = useState(false);

  const installCmd = 'irm https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/install.ps1 | iex';

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-24 lg:space-y-32">
      
      {/* =========================================================================
          SECTION 2: "Everything you need. Nothing you don't." (Optimus Bento)
         ========================================================================= */}
      <section className="relative">
        
        {/* Section Header */}
        <div className="max-w-4xl mx-auto mb-16 text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
            <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
              CAPABILITIES &amp; CORE ARCHITECTURE
            </span>
            <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
            Everything you need.
            <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
              Nothing you don't.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5e534a] dark:text-[#a89c92] max-w-2xl mx-auto leading-relaxed">
            Engineered from first principles for Windows. No background web servers, no electron wrappers, and no subscription barriers.
          </p>
        </div>

        {/* 4-Card Bento Grid */}
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 01 */}
          <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] flex flex-col justify-between space-y-8 crosshair-corner shadow-sm hover:border-[#080503]/40 dark:hover:border-white/30 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92]">
                  01 // ROUTING
                </span>
                <span className="w-8 h-8 rounded-full border border-[#dad7d0] dark:border-white/10 flex items-center justify-center text-[#080503] dark:text-[#fafaf9]">
                  <Cpu size={15} />
                </span>
              </div>
              <h3 className="text-xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
                Multi-Model Intelligence
              </h3>
              <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
                Seamlessly toggle between Google Gemini 2.5, Anthropic Claude 3.5 Sonnet, and OpenAI. Stored locally without cloud relays.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('architecture')}
              className="text-xs font-mono font-semibold text-[#080503] dark:text-[#fafaf9] flex items-center gap-1.5 hover-underline cursor-pointer"
            >
              <span>Explore Multi-AI Core</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Card 02 */}
          <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] flex flex-col justify-between space-y-8 crosshair-corner shadow-sm hover:border-[#080503]/40 dark:hover:border-white/30 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92]">
                  02 // FOOTPRINT
                </span>
                <span className="w-8 h-8 rounded-full border border-[#dad7d0] dark:border-white/10 flex items-center justify-center text-[#080503] dark:text-[#fafaf9]">
                  <Zap size={15} />
                </span>
              </div>
              <h3 className="text-xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
                2.11 MB Rust Core
              </h3>
              <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
                Built with Tauri v2 and native Win32 APIs. Reuses Windows WebView2 with under 45 MB of RAM and zero GPU tax.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('dependencies')}
              className="text-xs font-mono font-semibold text-[#080503] dark:text-[#fafaf9] flex items-center gap-1.5 hover-underline cursor-pointer"
            >
              <span>View Specs &amp; Memory</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Card 03 */}
          <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] flex flex-col justify-between space-y-8 crosshair-corner shadow-sm hover:border-[#080503]/40 dark:hover:border-white/30 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92]">
                  03 // ACTIONS
                </span>
                <span className="w-8 h-8 rounded-full border border-[#dad7d0] dark:border-white/10 flex items-center justify-center text-[#080503] dark:text-[#fafaf9]">
                  <Terminal size={15} />
                </span>
              </div>
              <h3 className="text-xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
                Desktop Automation
              </h3>
              <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
                Direct PowerShell scripting, file sorting, clipboard manipulation, and directory inspection protected by confirmation dialogues.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('install')}
              className="text-xs font-mono font-semibold text-[#080503] dark:text-[#fafaf9] flex items-center gap-1.5 hover-underline cursor-pointer"
            >
              <span>Review Install Guide</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Card 04 */}
          <div className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] flex flex-col justify-between space-y-8 crosshair-corner shadow-sm hover:border-[#080503]/40 dark:hover:border-white/30 transition-all">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92]">
                  04 // PERSONALITY
                </span>
                <span className="w-8 h-8 rounded-full border border-[#dad7d0] dark:border-white/10 flex items-center justify-center text-[#080503] dark:text-[#fafaf9]">
                  <Sparkles size={15} />
                </span>
              </div>
              <h3 className="text-xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
                Living Mascot Physics
              </h3>
              <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
                Frameless transparent window with 11 dynamic emotions, eye tracking, keyboard shortcuts, and smooth viewport collision physics.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('studio')}
              className="text-xs font-mono font-semibold text-[#080503] dark:text-[#fafaf9] flex items-center gap-1.5 hover-underline cursor-pointer"
            >
              <span>Open Bot Studio</span>
              <ArrowRight size={12} />
            </button>
          </div>

        </div>

      </section>

      {/* =========================================================================
          SECTION 3: "Three steps. Infinite possibilities." (High-Contrast Inverted Canvas)
         ========================================================================= */}
      <section className="rounded-3xl bg-[#080503] text-[#fafaf9] py-20 px-6 sm:px-12 lg:px-16 shadow-lg border border-white/10 relative overflow-hidden">
        
        {/* Subtle coordinate grid lines inside dark canvas */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute h-px bg-white/20" style={{ top: '25%', left: 0, right: 0 }} />
          <div className="absolute h-px bg-white/20" style={{ top: '75%', left: 0, right: 0 }} />
          <div className="absolute w-px bg-white/20" style={{ left: '33.33%', top: 0, bottom: 0 }} />
          <div className="absolute w-px bg-white/20" style={{ left: '66.66%', top: 0, bottom: 0 }} />
        </div>

        <div className="max-w-[1400px] mx-auto relative z-10">
          
          {/* Header */}
          <div className="max-w-3xl mb-16">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="w-8 h-px bg-white/40" />
              <span className="font-mono text-xs font-semibold tracking-widest text-[#a89c92] uppercase">
                GETTING STARTED IN SECONDS
              </span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-white">
              Three steps.
              <span className="block editorial-serif font-normal text-[#a89c92]">
                Infinite desktop automation.
              </span>
            </h2>
            <p className="mt-4 text-base text-[#a89c92] leading-relaxed">
              From fresh Windows installation to a live desktop companion in under thirty seconds.
            </p>
          </div>

          {/* 3 Step Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.03] space-y-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[#a89c92] block mb-3">
                  STEP 01
                </span>
                <h3 className="text-xl font-bold text-white mb-2">
                  One-Click Install
                </h3>
                <p className="text-xs text-[#a89c92] leading-relaxed mb-4">
                  Run our official PowerShell script. It pulls the release from GitHub and pins a desktop icon.
                </p>
                <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-xs text-emerald-400 break-all select-all">
                  {installCmd}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-white text-[#080503] hover:bg-white/90 font-mono text-xs font-bold transition-all cursor-pointer"
              >
                {copiedCmd ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedCmd ? 'COPIED TO CLIPBOARD' : 'COPY SCRIPT'}</span>
              </button>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.03] space-y-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[#a89c92] block mb-3">
                  STEP 02
                </span>
                <h3 className="text-xl font-bold text-white mb-2">
                  Provide Your Keys
                </h3>
                <p className="text-xs text-[#a89c92] leading-relaxed mb-4">
                  Add your Google Gemini, Anthropic Claude, or OpenAI key. Free tiers work immediately. Or detect Google Antigravity CLI locally.
                </p>
                <div className="space-y-1.5 font-mono text-xs text-[#a89c92] border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <span>Google Gemini</span>
                    <span className="text-emerald-400">Supported</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Anthropic Claude</span>
                    <span className="text-emerald-400">Supported</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>OpenAI Codex</span>
                    <span className="text-emerald-400">Supported</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Antigravity CLI</span>
                    <span className="text-cyan-400">Bridge</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('architecture')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-white/20 hover:border-white text-white font-mono text-xs font-medium transition-all cursor-pointer"
              >
                <span>REVIEW AI ENGINES</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.03] space-y-6 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[#a89c92] block mb-3">
                  STEP 03
                </span>
                <h3 className="text-xl font-bold text-white mb-2">
                  Glide &amp; Automate
                </h3>
                <p className="text-xs text-[#a89c92] leading-relaxed mb-4">
                  Use intuitive hotkeys to magnet-drag the companion, toggle chat, and run automations.
                </p>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5">
                    <span className="text-[#a89c92]">Move to cursor</span>
                    <span className="text-white font-bold">Alt + Click</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5">
                    <span className="text-[#a89c92]">Toggle chat</span>
                    <span className="text-white font-bold">Win + Shift + C</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5">
                    <span className="text-[#a89c92]">Dock vertical flip</span>
                    <span className="text-white font-bold">Page Up / Down</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('studio')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-white text-[#080503] hover:bg-white/90 font-mono text-xs font-bold transition-all cursor-pointer"
              >
                <span>OPEN BOT STUDIO</span>
                <ArrowRight size={13} />
              </button>
            </div>

          </div>

        </div>

      </section>

    </div>
  );
};
