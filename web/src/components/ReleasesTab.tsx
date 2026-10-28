import React from 'react';
import { 
  Download, 
  Tag, 
  Sparkles, 
  FileCheck, 
  ExternalLink, 
  HardDrive, 
  CheckCircle2, 
  Clock, 
  Monitor
} from 'lucide-react';
import { useLatestRelease } from '../lib/useLatestRelease.ts';

export const ReleasesTab: React.FC = () => {
  const { version, tagName, publishedAt, htmlUrl, assets } = useLatestRelease();

  const highlights = [
    '✨ Persistent Companion Personality & Adaptive Relationship Memory engine',
    '🕹️ Continuous real-time keyboard locomotion with diagonal vectoring & conflict resolution',
    '🔄 Automatic viewport bounce-back & dynamic chat window screen auto-flip',
    '🔍 Mouse-anchored precision zooming with persistent scaling',
    '🚀 Smart multi-tier Windows desktop app launcher with heuristic search',
    '🎨 Glassmorphic setup console with live emotion telemetry & zero cloud telemetry',
  ];

  return (
    <div className="py-8 space-y-10">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-mono">
          <Tag size={14} />
          <span>PRODUCTION BINARIES</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Download Luminess Assist {tagName}
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          All binaries are compiled directly from source and verified. Choose the installer format that suits your system.
        </p>
      </div>

      {/* Asset Download Cards */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {assets.map((asset) => (
          <div
            key={asset.name}
            className={`p-6 rounded-2xl border ${asset.color} backdrop-blur-xl flex flex-col justify-between space-y-6 shadow-[0_15px_35px_rgba(0,0,0,0.6)]`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-white">
                  {asset.tag}
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  {asset.size}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-1">{asset.title}</h3>
                <code className="text-xs font-mono text-slate-400 block mb-2">{asset.name}</code>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {asset.desc}
                </p>
              </div>
            </div>

            <a
              href={asset.url}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-mono text-xs font-bold transition-all ${asset.btnColor}`}
            >
              <Download size={15} />
              <span>DOWNLOAD {asset.size}</span>
            </a>
          </div>
        ))}
      </div>

      {/* Changelog & Release Notes */}
      <div className="max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl bg-[#090b14] border border-white/[0.08] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h3 className="text-base font-bold text-white font-mono">
              CHANGELOG // VERSION {version} RELEASE NOTES
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {publishedAt}
            </span>
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span>GitHub Release</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-slate-200">Key Enhancements:</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                <CheckCircle2 size={15} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <FileCheck size={14} className="text-emerald-400" />
            <span>Target: Windows 10/11 x64 (x86_64-pc-windows-msvc)</span>
          </div>
          <a
            href="https://github.com/jasonhukom/Luminess-Assist/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline"
          >
            Browse all past releases →
          </a>
        </div>
      </div>

    </div>
  );
};
