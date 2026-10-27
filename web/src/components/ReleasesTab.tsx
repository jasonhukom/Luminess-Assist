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

export const ReleasesTab: React.FC = () => {
  const assets = [
    {
      name: 'Luminess.Assist_1.1.0_x64-setup.exe',
      title: 'Windows NSIS Setup (.exe)',
      tag: 'Recommended for Most Users',
      size: '2.11 MB',
      type: 'Standalone Self-Extractor',
      color: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300',
      btnColor: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.4)]',
      url: 'https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.0/Luminess.Assist_1.1.0_x64-setup.exe',
      desc: 'Standard setup wizard with automatic desktop and start menu shortcut generation.',
    },
    {
      name: 'Luminess.Assist_1.1.0_x64_en-US.msi',
      title: 'Windows Installer Package (.msi)',
      tag: 'Enterprise & IT Admin',
      size: '3.12 MB',
      type: 'Wix MSI Package',
      color: 'border-purple-500/30 bg-purple-950/20 text-purple-300',
      btnColor: 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]',
      url: 'https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.0/Luminess.Assist_1.1.0_x64_en-US.msi',
      desc: 'Windows Installer package supporting group policy deployment and silent enterprise rollouts.',
    },
  ];

  const highlights = [
    '✨ Multi-Provider AI Engine (Google Gemini, Anthropic Claude, OpenAI Codex)',
    '🎨 Sleek Glassmorphic Setup Console with interactive robot preview & hidden scrollbars',
    '💫 Aura Cyberpunk Boot Telemetry & Onboarding sequence',
    '🦾 Physical inertia & flick gestures with bounce-back boundary guard',
    '🔒 Zero-cloud API credential persistence (client-side only)',
    '⚙️ Auto-approve and interactive permission dialogs for desktop tool commands',
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
          Download Luminess Assist v1.1.0
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
              CHANGELOG // VERSION 1.1.0 RELEASE NOTES
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={13} />
              October 2026
            </span>
            <a
              href="https://github.com/jasonhukom/Luminess-Assist/releases/tag/v1.1.0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>GitHub Release</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {highlights.map((item, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs text-slate-300 flex items-start gap-2">
              <CheckCircle2 size={15} className="text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* System Requirements Footnote */}
      <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-4">
        <div className="flex items-center gap-2 text-slate-300">
          <Monitor size={15} className="text-cyan-400" />
          <span>Compatible with Windows 10 &amp; Windows 11 (64-bit architecture)</span>
        </div>
        <div className="flex items-center gap-3">
          <span>RAM: ~35 MB idle</span>
          <span>•</span>
          <span>Storage: ~10 MB</span>
          <span>•</span>
          <span>Tauri v2.12</span>
        </div>
      </div>

    </div>
  );
};
