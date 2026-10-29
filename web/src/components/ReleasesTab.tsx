import React from 'react';
import {
  Download,
  Tag,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  ArrowUpRight,
} from 'lucide-react';
import { useLatestRelease } from '../lib/useLatestRelease.ts';

export const ReleasesTab: React.FC = () => {
  const { version, tagName, publishedAt, htmlUrl, assets } = useLatestRelease();

  const highlights = [
    'Intelligent AI Authentication with normalized error recovery for Google, Claude, and OpenAI',
    'Antigravity CLI local detection and supported process bridge',
    'Adaptive desktop companion shortcuts: Alt + Click (magnet move), Win + Shift + C (chat), Page Up/Down (dock flip)',
    'Persistent relationship memory engine with long-term cross-session fact storage',
    'Smooth vector locomotion with keyboard conflict resolution and viewport boundary bounce',
    'Automated Community Bot pairing tokens and custom prompt synchronization',
  ];

  return (
    <section className="py-16 lg:py-24 border-t border-[#dad7d0] dark:border-white/10">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-12 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
          <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
            VERIFIED WINDOWS BINARIES &bull; {tagName}
          </span>
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
          Direct download.
          <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
            Signed, audited, and lightweight.
          </span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-[#5e534a] dark:text-[#a89c92] max-w-2xl mx-auto leading-relaxed">
          Every Luminess release is compiled natively with Rust and Tauri v2. Choose the standard Windows installer (`.msi`) or the standalone portable executable (`.exe`).
        </p>
      </div>

      {/* Download Asset Cards */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {assets.map((asset) => (
          <div
            key={asset.name}
            className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] flex flex-col justify-between space-y-6 shadow-sm crosshair-corner"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#080503]/5 dark:bg-white/10 text-[#080503] dark:text-[#fafaf9] font-semibold uppercase tracking-wider">
                  {asset.tag}
                </span>
                <span className="text-xs font-mono font-bold text-[#080503] dark:text-[#fafaf9]">
                  {asset.size}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-1">
                  {asset.title}
                </h3>
                <code className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92] block mb-3 break-all">
                  {asset.name}
                </code>
                <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
                  {asset.desc}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#dad7d0]/60 dark:border-white/10 flex items-center justify-between">
              <a
                href={asset.url}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] hover:opacity-90 font-mono text-xs font-bold tracking-tight transition-all shadow-sm cursor-pointer"
              >
                <Download size={14} />
                <span>DOWNLOAD {asset.size}</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Changelog & Release Notes */}
      <div className="max-w-4xl mx-auto p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] space-y-6">
        
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#dad7d0]/60 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-mono text-sm font-bold text-[#080503] dark:text-[#fafaf9] uppercase tracking-wider">
              Changelog &bull; Release {tagName}
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              {publishedAt}
            </span>
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#080503] dark:text-white hover:underline transition-colors"
            >
              <span>GitHub Release</span>
              <ArrowUpRight size={12} />
            </a>
          </div>
        </div>

        {/* Highlights List */}
        <div className="space-y-3">
          {highlights.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 text-sm text-[#5e534a] dark:text-[#a89c92]">
              <span className="font-mono text-xs text-[#080503] dark:text-[#fafaf9] font-bold select-none mt-0.5">
                0{idx + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </div>
          ))}
        </div>

        {/* SHA-256 Verification Guarantee */}
        <div className="pt-4 border-t border-[#dad7d0]/60 dark:border-white/10 flex items-center gap-2 text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Binary integrity guaranteed via GitHub Actions automated release pipeline with SHA-256 validation.
          </span>
        </div>

      </div>

    </section>
  );
};
