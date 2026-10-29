import React from 'react';
import {
  Users,
  Sparkles,
  ArrowRight,
  Star,
  CheckCircle2,
  Code2,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import type { TabKey } from './Navbar.tsx';
import type { BotProfile } from '../lib/botPlatformStore.ts';
import { COMMUNITY_BOTS_DATA } from './CommunityBotTab.tsx';

interface CommunityBotsOverviewProps {
  onNavigateTab: (tab: TabKey) => void;
  onAdoptBot?: (profile: BotProfile) => void;
}

export const CommunityBotsOverview: React.FC<CommunityBotsOverviewProps> = ({
  onNavigateTab,
  onAdoptBot,
}) => {
  // Take top 3 curated community bots for the overview teaser
  const featuredBots = COMMUNITY_BOTS_DATA.slice(0, 3);

  return (
    <section className="relative rounded-3xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] p-8 sm:p-14 shadow-sm overflow-hidden crosshair-corner">
      
      {/* Background Architectural Grid Accent */}
      <div className="absolute inset-0 blueprint-grid opacity-35 pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
            <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
              COMMUNITY ECOSYSTEM // 24+ USER-CRAFTED MASCOTS
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
            Community Bots.
            <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
              Crafted by pilots, installed in one click.
            </span>
          </h2>

          <p className="mt-4 text-base text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
            Don't configure from scratch. Choose from our curated catalog of community-built companions with tuned prompts, specialized system permissions, and unique emotional physics.
          </p>
        </div>

        {/* 3-Bot Featured Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {featuredBots.map((bot) => (
            <div
              key={bot.id}
              className="p-6 rounded-2xl border border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] flex flex-col justify-between hover:border-[#080503]/40 dark:hover:border-white/30 transition-all shadow-sm group"
            >
              <div>
                
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: `${bot.accentColor}20` }}
                    >
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: bot.accentColor }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display font-bold text-base text-[#080503] dark:text-white">
                          {bot.name}
                        </h3>
                        {bot.verified && (
                          <CheckCircle2 size={13} className="text-cyan-500 shrink-0" />
                        )}
                      </div>
                      <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                        {bot.creator}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span className="font-bold text-[#080503] dark:text-white">{bot.rating}</span>
                  </div>
                </div>

                {/* Tagline */}
                <p className="text-xs font-medium text-[#080503] dark:text-white mb-2 leading-relaxed">
                  {bot.tagline}
                </p>

                {/* Short Prompt Snippet */}
                <p className="text-xs text-[#5e534a] dark:text-[#a89c92] leading-relaxed line-clamp-2 mb-4">
                  {bot.description}
                </p>

                {/* Engine Tag */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                    {bot.aiEngine}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#080503]/5 dark:bg-white/5 text-[#5e534a] dark:text-[#a89c92]">
                    {bot.categoryLabel}
                  </span>
                </div>

              </div>

              {/* Bot Teaser Footer */}
              <div className="pt-3 border-t border-[#dad7d0]/60 dark:border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-[#5e534a] dark:text-[#a89c92]">
                  {bot.downloadsCount.toLocaleString()} pilots
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('community');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="font-semibold text-[#080503] dark:text-white flex items-center gap-1 hover-underline cursor-pointer"
                >
                  <span>View Details</span>
                  <ArrowRight size={11} />
                </button>
              </div>

            </div>
          ))}
        </div>

        {/* =========================================================================
            THE BIG BUTTON IN OVERVIEW (User Request Highlight)
           ========================================================================= */}
        <div className="flex flex-col items-center justify-center text-center pt-4 pb-2 border-t border-[#dad7d0]/60 dark:border-white/10">
          
          <div className="mb-4 flex items-center gap-2 text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
            <Sparkles size={14} className="text-amber-500" />
            <span>Discover developer wingmen, anime mascots, sysadmin guards, and study companions</span>
          </div>

          {/* MASSIVE BIG BUTTON */}
          <button
            type="button"
            onClick={() => {
              onNavigateTab('community');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-4 px-10 py-5 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] hover:opacity-95 font-mono text-sm sm:text-base font-bold tracking-tight shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group border border-black/10 dark:border-white/20"
          >
            <div className="w-7 h-7 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center">
              <Users size={16} className="text-white dark:text-[#080503] group-hover:scale-110 transition-transform" />
            </div>
            <span>EXPLORE ALL COMMUNITY BOTS</span>
            <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform text-amber-400 dark:text-amber-600" />
          </button>

          <span className="mt-3 text-[11px] font-mono text-[#5e534a] dark:text-[#a89c92]">
            24+ Community Bots &bull; Zero Cloud Telemetry &bull; 1-Click Windows App Pairing
          </span>

        </div>

      </div>

    </section>
  );
};
