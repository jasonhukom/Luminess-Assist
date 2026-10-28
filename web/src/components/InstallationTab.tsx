import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Download,
  ShieldCheck,
  FolderPlus,
  Monitor,
  Code2,
  ArrowRight,
  Sparkles,
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
    <section className="py-16 lg:py-24 border-t border-[#dad7d0] dark:border-white/10">
      
      {/* Eyebrow and Section Headline (Optimus Style) */}
      <div className="max-w-4xl mx-auto mb-12 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
          <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
            AUTOMATED INSTALLATION PIPELINE
          </span>
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
          One command.
          <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
            Zero configuration needed.
          </span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-[#5e534a] dark:text-[#a89c92] max-w-2xl mx-auto leading-relaxed">
          Open Windows PowerShell and paste the command below. The verified installer downloads the latest release binary, creates a Desktop shortcut, and boots the frameless companion in seconds.
        </p>
      </div>

      {/* Method Switcher Pills */}
      <div className="flex justify-center mb-10">
        <div className="p-1 rounded-full border border-[#dad7d0] dark:border-white/10 bg-[#f3f2ee] dark:bg-[#120f0d] flex items-center gap-1">
          <button
            type="button"
            onClick={() => setInstallMethod('powershell')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-mono transition-all cursor-pointer ${
              installMethod === 'powershell'
                ? 'bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] font-semibold shadow-sm'
                : 'text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-[#fafaf9]'
            }`}
          >
            <Terminal size={13} />
            <span>One-Click PowerShell (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={() => setInstallMethod('source')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-mono transition-all cursor-pointer ${
              installMethod === 'source'
                ? 'bg-[#080503] text-[#fafaf9] dark:bg-[#fafaf9] dark:text-[#080503] font-semibold shadow-sm'
                : 'text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-[#fafaf9]'
            }`}
          >
            <Code2 size={13} />
            <span>Compile from Source (Developer)</span>
          </button>
        </div>
      </div>

      {/* Main Terminal Box */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] shadow-sm overflow-hidden crosshair-corner">
          
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#dad7d0] dark:border-white/10 bg-[#f3f2ee] dark:bg-[#171411]">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dad7d0] dark:bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#dad7d0] dark:bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#dad7d0] dark:bg-white/20" />
              <span className="ml-2 font-mono text-xs text-[#5e534a] dark:text-[#a89c92]">
                {installMethod === 'powershell' ? 'powershell.exe' : 'bash — developer workspace'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(installMethod === 'powershell' ? psOneLiner : devSourceScript, 'terminal')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] text-xs font-mono font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              {copiedKey === 'terminal' ? (
                <>
                  <Check size={12} />
                  <span>COPIED TO CLIPBOARD</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>COPY COMMAND</span>
                </>
              )}
            </button>
          </div>

          {/* Terminal Body */}
          <div className="p-6 font-mono text-xs sm:text-sm bg-[#fafaf9] dark:bg-[#0c0907] overflow-x-auto text-[#080503] dark:text-[#fafaf9] leading-relaxed">
            {installMethod === 'powershell' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-[#5e534a] dark:text-[#a89c92] select-none font-bold">PS &gt;</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold select-all break-all">
                    {psOneLiner}
                  </span>
                </div>
                <div className="pt-2 text-xs text-[#5e534a] dark:text-[#a89c92] space-y-1 select-none border-t border-[#dad7d0]/60 dark:border-white/5">
                  <p>&bull; Target Directory: %LOCALAPPDATA%\Luminess-Assist</p>
                  <p>&bull; Binary: Luminess-Assist.exe (x64 Windows Portable / MSI)</p>
                  <p>&bull; Architecture: Rust + Tauri 2 + WebView2 runtime</p>
                </div>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap select-all text-xs sm:text-sm">
                {devSourceScript}
              </pre>
            )}
          </div>

        </div>
      </div>

      {/* Step-by-Step Execution Pipeline (3 Cards) */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="p-6 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] relative crosshair-corner">
          <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92] block mb-3">
            01 &bull; VERIFY &amp; FETCH
          </span>
          <h3 className="text-lg font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
            GitHub Release Handshake
          </h3>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
            The installer queries GitHub's official API for the latest production tag (`v1.1.2`), verifies SHA-256 asset checksums, and pulls the lightweight 2.11 MB executable directly.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] relative crosshair-corner">
          <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92] block mb-3">
            02 &bull; DESKTOP SHORTCUT
          </span>
          <h3 className="text-lg font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
            Local Windows Pin
          </h3>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
            A standard `.lnk` shortcut is automatically written to your Windows Desktop and Start Menu, enabling immediate keyboard search and launch via `Win + S` &rarr; "Luminess".
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] relative crosshair-corner">
          <span className="font-mono text-xs font-bold text-[#5e534a] dark:text-[#a89c92] block mb-3">
            03 &bull; FRAMELESS BOOT
          </span>
          <h3 className="text-lg font-bold text-[#080503] dark:text-[#fafaf9] mb-2">
            Live Companion Window
          </h3>
          <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
            The companion appears gracefully floating above your workspace. Configure your Gemini, Claude, or OpenAI key locally with zero telemetry relays.
          </p>
        </div>

      </div>

    </section>
  );
};
