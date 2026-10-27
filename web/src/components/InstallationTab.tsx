import React, { useState } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Sparkles, 
  Download, 
  Play, 
  ArrowRight, 
  ShieldCheck, 
  FolderPlus, 
  Monitor,
  CheckCircle2,
  Code2
} from 'lucide-react';

export const InstallationTab: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [installMethod, setInstallMethod] = useState<'powershell' | 'source'>('powershell');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const psOneLiner = `powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/install.ps1 | iex"`;
  
  const devSourceScript = `# 1. Clone the repository
git clone https://github.com/jasonhukom/Luminess-Assist.git
cd Luminess-Assist

# 2. Install dependencies
npm install

# 3. Launch live companion in developer mode
npm run tauri dev`;

  return (
    <div className="py-8 space-y-10">
      
      {/* Tab Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-mono">
          <Terminal size={14} />
          <span>ZERO-CONFIG AUTOMATION</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Install Luminess in One Paste
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Copy the single-line command below, open your Windows PowerShell or Command Prompt, and press Enter. 
          The script downloads the release, generates a Desktop shortcut, and starts Luminess instantly.
        </p>
      </div>

      {/* Method Switcher */}
      <div className="flex justify-center">
        <div className="p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setInstallMethod('powershell')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              installMethod === 'powershell'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.3)] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal size={14} />
            <span>One-Click PowerShell (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={() => setInstallMethod('source')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
              installMethod === 'source'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-[0_0_16px_rgba(168,85,247,0.3)] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 size={14} />
            <span>Compile from Source (Developer)</span>
          </button>
        </div>
      </div>

      {/* Main Terminal Box */}
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#090b14] shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_-5px_rgba(56,189,248,0.25)]">
          
          {/* Terminal Window Chrome */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0d101d] border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-3 text-xs font-mono text-slate-400">
                {installMethod === 'powershell' ? 'Windows PowerShell / Terminal' : 'Git Bash / Command Prompt'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(installMethod === 'powershell' ? psOneLiner : devSourceScript, 'main-code')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 text-xs font-mono transition-all cursor-pointer"
            >
              {copiedKey === 'main-code' ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">COPIED TO CLIPBOARD!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>COPY COMMAND</span>
                </>
              )}
            </button>
          </div>

          {/* Terminal Code Content */}
          <div className="p-6 font-mono text-sm sm:text-base leading-relaxed overflow-x-auto">
            {installMethod === 'powershell' ? (
              <div className="space-y-3">
                <p className="text-slate-500 text-xs">// Run in Windows PowerShell (Win + X &gt; Terminal / PowerShell):</p>
                <div className="flex items-start gap-3">
                  <span className="text-cyan-400 select-none font-bold text-lg leading-none pt-1">&gt;</span>
                  <code className="text-cyan-200 break-all select-all font-semibold">
                    {psOneLiner}
                  </code>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-500 text-xs">// Build Luminess Assist from source with Rust &amp; Node:</p>
                <pre className="text-purple-200 text-xs sm:text-sm whitespace-pre-wrap select-all">
                  {devSourceScript}
                </pre>
              </div>
            )}
          </div>

          {/* Footer Note inside Terminal */}
          <div className="px-6 py-3 bg-[#0c0e1a] border-t border-white/[0.05] flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={14} />
              Verified SHA-256 for release v1.1.0
            </span>
            <span className="text-slate-500">Requires Windows 10 / 11 64-bit</span>
          </div>

        </div>
      </div>

      {/* Automated Pipeline Walkthrough (What Happens Next) */}
      <div className="max-w-4xl mx-auto space-y-4 pt-6">
        <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
          <Sparkles size={18} className="text-cyan-400" />
          <span>WHAT THIS ONE-LINER DOES AUTOMATICALLY:</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] relative">
            <div className="text-cyan-400 font-mono text-xs font-bold mb-1">STEP 01</div>
            <div className="font-semibold text-white text-sm mb-1 flex items-center gap-1.5">
              <Download size={14} className="text-cyan-400" />
              <span>Release Fetch</span>
            </div>
            <p className="text-xs text-slate-400">
              Downloads the official 2.11 MB setup bundle (<code className="text-cyan-300">v1.1.0</code>) directly from GitHub releases.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] relative">
            <div className="text-cyan-400 font-mono text-xs font-bold mb-1">STEP 02</div>
            <div className="font-semibold text-white text-sm mb-1 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Silent Install</span>
            </div>
            <p className="text-xs text-slate-400">
              Installs binary and dependencies into your local user folder without requiring admin rights.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] relative">
            <div className="text-cyan-400 font-mono text-xs font-bold mb-1">STEP 03</div>
            <div className="font-semibold text-white text-sm mb-1 flex items-center gap-1.5">
              <Monitor size={14} className="text-purple-400" />
              <span>Desktop Shortcut</span>
            </div>
            <p className="text-xs text-slate-400">
              Creates <strong className="text-slate-200">"Luminess Assist.lnk"</strong> on your Windows Desktop with the high-res robot icon.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] relative">
            <div className="text-cyan-400 font-mono text-xs font-bold mb-1">STEP 04</div>
            <div className="font-semibold text-white text-sm mb-1 flex items-center gap-1.5">
              <Play size={14} className="text-amber-400" />
              <span>Instant Launch</span>
            </div>
            <p className="text-xs text-slate-400">
              Starts Luminess immediately above your current apps. Whenever you want to reopen it, simply double-click the desktop shortcut!
            </p>
          </div>

        </div>
      </div>

      {/* Manual Fallback Downloads Card */}
      <div className="max-w-4xl mx-auto p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white mb-1">Prefer manual installation?</h4>
          <p className="text-xs text-slate-400">
            You can download the Windows Setup (.exe) or Windows Installer (.msi) files directly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.0/Luminess.Assist_1.1.0_x64-setup.exe"
            className="px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 font-mono text-xs font-medium transition-all"
          >
            Download .exe (2.11 MB)
          </a>
          <a
            href="https://github.com/jasonhukom/Luminess-Assist/releases/download/v1.1.0/Luminess.Assist_1.1.0_x64_en-US.msi"
            className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-300 font-mono text-xs font-medium transition-all"
          >
            Download .msi (3.12 MB)
          </a>
        </div>
      </div>

    </div>
  );
};
