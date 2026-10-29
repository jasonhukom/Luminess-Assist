import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  Download,
  FileText,
  Keyboard,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react';
import type { TabKey } from './Navbar.tsx';

interface DocumentationTabProps {
  onNavigateTab: (tab: TabKey) => void;
}

const installCommand = 'irm https://raw.githubusercontent.com/jasonhukom/Luminess-Assist/main/install.ps1 | iex';

const documentationSections = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'installation', label: 'Installation', icon: Terminal },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'ai-setup', label: 'AI provider setup', icon: Sparkles },
  { id: 'controls', label: 'Controls & shortcuts', icon: Keyboard },
  { id: 'delete', label: 'Delete', icon: Trash2 },
  { id: 'privacy', label: 'Privacy & permissions', icon: ShieldCheck },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: CircleHelp },
];

const sectionLabelClass =
  'mb-3 block font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5e534a] dark:text-[#a89c92]';
const headingClass =
  'mb-4 text-2xl sm:text-3xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]';
const bodyClass = 'text-sm sm:text-[15px] leading-7 text-[#5e534a] dark:text-[#a89c92]';
const cardClass =
  'rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white/70 dark:bg-[#120f0d]/70 p-5 sm:p-6';

export const DocumentationTab: React.FC<DocumentationTabProps> = ({ onNavigateTab }) => {
  const [copied, setCopied] = useState(false);

  const copyInstallCommand = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="relative py-10 lg:py-14 border-t border-[#dad7d0] dark:border-white/10 blueprint-grid">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 lg:mb-12 pb-8 border-b border-[#dad7d0]/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#5e534a] dark:text-[#a89c92]">
            <BookOpen size={14} />
            <span>Documentation</span>
            <span className="opacity-50">/</span>
            <span>Guides & reference</span>
          </div>
          <h1 className="max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
            Luminess, explained.
            <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
              A guide to your desktop companion.
            </span>
          </h1>
          <p className="mt-5 max-w-3xl text-base sm:text-lg leading-relaxed text-[#5e534a] dark:text-[#a89c92]">
            Setup instructions, downloads, keyboard controls, AI provider configuration, and safety notes for using Luminess Assist on Windows.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[245px_minmax(0,1fr)] gap-7 lg:gap-12 items-start">
          <aside className="lg:sticky lg:top-28 h-fit rounded-2xl border border-[#dad7d0]/80 dark:border-white/10 bg-white/65 dark:bg-[#120f0d]/65 backdrop-blur-2xl shadow-[0_12px_40px_rgba(8,5,3,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.2)] p-3">
            <div className="px-3 py-3 mb-2 border-b border-[#dad7d0]/70 dark:border-white/10">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5e534a] dark:text-[#a89c92]">
                On this page
              </span>
              <p className="mt-1 text-sm font-semibold text-[#080503] dark:text-[#fafaf9]">
                Read the docs
              </p>
            </div>
            <nav aria-label="Documentation sections" className="space-y-1">
              {documentationSections.map((item, index) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#5e534a] dark:text-[#a89c92] transition-all hover:bg-[#080503]/[0.045] hover:text-[#080503] dark:hover:bg-white/[0.06] dark:hover:text-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e534a]/50"
                  >
                    <Icon size={15} className="shrink-0 opacity-75 group-hover:opacity-100" />
                    <span className="flex-1">{item.label}</span>
                    <span className="font-mono text-[9px] opacity-35">{String(index + 1).padStart(2, '0')}</span>
                  </a>
                );
              })}
            </nav>
            <div className="mt-3 border-t border-[#dad7d0]/70 dark:border-white/10 p-3">
              <p className="text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">
                Need the interactive setup flow?
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('install')}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#080503] dark:text-[#fafaf9] hover-underline"
              >
                Open Installation <ArrowRight size={12} />
              </button>
            </div>
          </aside>

          <article className="min-w-0 space-y-12 sm:space-y-16">
            <section id="overview" className="scroll-mt-28">
              <span className={sectionLabelClass}>01 / Orientation</span>
              <h2 className={headingClass}>Meet your desktop companion</h2>
              <p className={bodyClass}>
                Luminess Assist is a lightweight Windows desktop companion built with React, TypeScript, Tauri, and Rust. Its transparent, always-on-top robot can stay beside your other apps while you chat with an AI provider and request help with supported desktop tasks.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={cardClass}>
                  <Terminal size={17} className="mb-4 text-[#5e534a] dark:text-[#a89c92]" />
                  <h3 className="mb-2 text-sm font-semibold text-[#080503] dark:text-[#fafaf9]">Native desktop</h3>
                  <p className="text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">Designed for Windows 10 and 11, with a floating companion window.</p>
                </div>
                <div className={cardClass}>
                  <Sparkles size={17} className="mb-4 text-[#5e534a] dark:text-[#a89c92]" />
                  <h3 className="mb-2 text-sm font-semibold text-[#080503] dark:text-[#fafaf9]">Your AI provider</h3>
                  <p className="text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">Configure a supported Gemini, Claude, or OpenAI connection.</p>
                </div>
                <div className={cardClass}>
                  <ShieldCheck size={17} className="mb-4 text-[#5e534a] dark:text-[#a89c92]" />
                  <h3 className="mb-2 text-sm font-semibold text-[#080503] dark:text-[#fafaf9]">Permission first</h3>
                  <p className="text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">Review desktop-action prompts before allowing changes to your PC.</p>
                </div>
              </div>
            </section>

            <section id="installation" className="scroll-mt-28 border-t border-[#dad7d0]/80 dark:border-white/10 pt-10">
              <span className={sectionLabelClass}>02 / Getting started</span>
              <h2 className={headingClass}>Installation</h2>
              <p className={bodyClass}>
                The dedicated Installation page contains the one-click installer and the developer source-build option. For most users, the PowerShell installer is the simplest route.
              </p>
              <ol className="mt-5 space-y-4">
                {[
                  ['Open a terminal', 'Launch PowerShell or Windows Terminal on your Windows PC.'],
                  ['Run the installer', 'Copy the command below, review the script first if you prefer, then run it in the terminal.'],
                  ['Complete setup', 'Follow the installer prompts, launch Luminess Assist, and choose an AI provider.'],
                ].map(([title, description], index) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#dad7d0] dark:border-white/15 font-mono text-[11px] font-semibold text-[#080503] dark:text-[#fafaf9]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-[#080503] dark:text-[#fafaf9]">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[#5e534a] dark:text-[#a89c92]">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#080503] text-[#fafaf9]">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#a89c92]">
                    <Terminal size={13} />
                    PowerShell
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyInstallCommand()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors hover:bg-white/10"
                  >
                    {copied ? <Check size={12} /> : <FileText size={12} />}
                    {copied ? 'COPIED' : 'COPY COMMAND'}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all p-4 text-xs leading-relaxed text-emerald-300"><code>{installCommand}</code></pre>
              </div>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-600/20 bg-amber-500/[0.06] p-4 text-xs leading-relaxed text-[#5e534a] dark:text-[#c6b7a8]">
                <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                This command downloads and runs the installer script from this repository. Review <a className="underline underline-offset-4" href="https://github.com/jasonhukom/Luminess-Assist/blob/main/install.ps1" target="_blank" rel="noopener noreferrer">install.ps1 on GitHub</a> before running it if you want to inspect what it does.
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('install')}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#080503] px-5 py-3 font-mono text-xs font-semibold text-[#fafaf9] transition-opacity hover:opacity-85 dark:bg-[#fafaf9] dark:text-[#080503]"
              >
                Open Installation page <ArrowRight size={14} />
              </button>
            </section>

            <section id="downloads" className="scroll-mt-28 border-t border-[#dad7d0]/80 dark:border-white/10 pt-10">
              <span className={sectionLabelClass}>03 / Release packages</span>
              <h2 className={headingClass}>Downloads live with Installation</h2>
              <p className={bodyClass}>
                To keep setup instructions and release files together, choose a package from the Downloads section at the bottom of the Installation page. Releases are published through GitHub; filenames and availability can change between versions.
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={cardClass}>
                  <div className="mb-3 inline-flex rounded-full bg-[#080503]/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#5e534a] dark:bg-white/10 dark:text-[#a89c92]">Recommended</div>
                  <h3 className="text-base font-semibold text-[#080503] dark:text-[#fafaf9]">Windows installer (.exe)</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5e534a] dark:text-[#a89c92]">The standard setup wizard for most Windows users.</p>
                </div>
                <div className={cardClass}>
                  <div className="mb-3 inline-flex rounded-full bg-[#080503]/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#5e534a] dark:bg-white/10 dark:text-[#a89c92]">IT / deployment</div>
                  <h3 className="text-base font-semibold text-[#080503] dark:text-[#fafaf9]">Windows Installer (.msi)</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5e534a] dark:text-[#a89c92]">An alternate Windows Installer package for managed deployment workflows.</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab('install')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#080503] px-5 py-3 font-mono text-xs font-semibold text-[#fafaf9] transition-opacity hover:opacity-85 dark:bg-[#fafaf9] dark:text-[#080503]"
                >
                  View downloads in Installation <Download size={14} />
                </button>
                <a
                  href="https://github.com/jasonhukom/Luminess-Assist/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-mono font-semibold text-[#080503] dark:text-[#fafaf9] hover-underline"
                >
                  All GitHub releases <ArrowUpRight size={13} />
                </a>
              </div>
            </section>

            <section id="ai-setup" className="scroll-mt-28 border-t border-[#dad7d0]/80 dark:border-white/10 pt-10">
              <span className={sectionLabelClass}>04 / Connection setup</span>
              <h2 className={headingClass}>Connect an AI provider</h2>
              <p className={bodyClass}>
                On first launch, select a supported provider and configure the credentials it requires. A Google account login and a Gemini API key are not necessarily interchangeable; follow the setup flow and provider requirements shown in the app.
              </p>
              <div className="mt-5 divide-y divide-[#dad7d0]/70 dark:divide-white/10 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white/60 dark:bg-[#120f0d]/60">
                {[
                  { name: 'Google Gemini', detail: 'Create or manage an API key in Google AI Studio.', url: 'https://aistudio.google.com/app/apikey', link: 'Google AI Studio' },
                  { name: 'Anthropic Claude', detail: 'Manage API access in the Claude Console.', url: 'https://console.anthropic.com/settings/keys', link: 'Anthropic Console' },
                  { name: 'OpenAI API', detail: 'Create and manage API keys from the OpenAI platform.', url: 'https://platform.openai.com/api-keys', link: 'OpenAI Platform' },
                ].map((provider) => (
                  <div key={provider.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:px-5">
                    <div>
                      <h3 className="text-sm font-semibold text-[#080503] dark:text-[#fafaf9]">{provider.name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">{provider.detail}</p>
                    </div>
                    <a href={provider.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-mono font-semibold text-[#080503] dark:text-[#fafaf9] hover-underline">
                      {provider.link} <ArrowUpRight size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </section>

            <section id="controls" className="scroll-mt-28 border-t border-[#dad7d0]/80 dark:border-white/10 pt-10">
              <span className={sectionLabelClass}>05 / Everyday use</span>
              <h2 className={headingClass}>Controls & keyboard shortcuts</h2>
              <p className={bodyClass}>
                Use the robot directly for quick interactions, or use shortcuts to position it and control the chat panel.
              </p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-[#dad7d0] dark:border-white/10">
                {[
                  ['Click the robot', 'Open or close the chat panel'],
                  ['Click and drag', 'Move the robot around the screen'],
                  ['Mouse wheel over the robot', 'Change the robot size'],
                  ['Alt + left-click', 'Summon the robot at the cursor'],
                  ['Win + Shift + C', 'Toggle the chat panel'],
                  ['Win + Esc', 'Immediately terminate Luminess Assist'],
                  ['Page Up / Page Down', 'Change the robot docking position'],
                  ['Ctrl + arrow keys', 'Move the robot'],
                  ['Arrow keys', 'Adjust the chat bubble position'],
                ].map(([shortcut, description], index) => (
                  <div key={shortcut} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:px-5 ${index % 2 === 0 ? 'bg-white/60 dark:bg-white/[0.025]' : 'bg-transparent'} ${index ? 'border-t border-[#dad7d0]/60 dark:border-white/10' : ''}`}>
                    <span className="text-sm font-medium text-[#080503] dark:text-[#fafaf9]">{shortcut}</span>
                    <span className="text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92] sm:text-right">{description}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="delete" className="scroll-mt-28 border-t border-[#dad7d0]/80 dark:border-white/10 pt-10">
              <span className={sectionLabelClass}>06 / Desktop actions</span>
              <h2 className={headingClass}>Deleting files safely</h2>
              <p className={bodyClass}>
                Depending on the request and supported desktop tools, Luminess may help inspect, create, edit, copy, move, or delete files. These actions can affect real files on your Windows system, so review the target and the requested operation before approving it.
              </p>
              <div className="mt-5 rounded-2xl border border-rose-700/20 bg-rose-500/[0.045] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <Trash2 size={18} className="mt-0.5 shrink-0 text-rose-700 dark:text-rose-300" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#080503] dark:text-[#fafaf9]">Before deleting anything</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#5e534a] dark:text-[#a89c92]">
                      <li>• Confirm the exact file or folder path and check that the target is correct.</li>
                      <li>• Keep a backup of important files before making destructive changes.</li>
                      <li>• Read the permission prompt and deny the request if the target or consequence is unclear.</li>
                      <li>• Do not enable automatic approval for file operations unless you fully understand the trade-off.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section id="privacy" className="scroll-mt-28 border-t border-[#dad7d0]/80 dark:border-white/10 pt-10">
              <span className={sectionLabelClass}>07 / Trust & control</span>
              <h2 className={headingClass}>Privacy & permissions</h2>
              <div className="space-y-4">
                <p className={bodyClass}>
                  Prompts sent to an AI provider are handled by the provider you select. Avoid sending sensitive information unless you understand that provider's privacy terms and data policies.
                </p>
                <p className={bodyClass}>
                  Provider selection, API keys, and some authentication state are stored in local app or WebView storage. This storage is not an encrypted credential vault, so use a trusted Windows account and do not share a device while keys are configured.
                </p>
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white/60 dark:bg-[#120f0d]/60 p-5">
                <LockKeyhole size={17} className="mt-0.5 shrink-0 text-[#5e534a] dark:text-[#a89c92]" />
                <p className="text-sm leading-relaxed text-[#5e534a] dark:text-[#a89c92]">
                  Keep approval prompts enabled for desktop actions. AI-generated commands and file operations should be reviewed before they run.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-28 border-t border-[#dad7d0]/80 dark:border-white/10 pt-10">
              <span className={sectionLabelClass}>08 / Troubleshooting</span>
              <h2 className={headingClass}>When something goes wrong</h2>
              <div className="space-y-3">
                {[
                  { title: 'The robot is not visible', body: 'Check the Windows system tray to confirm the app is running. Quit it from the tray and launch it again if needed.' },
                  { title: 'The AI provider cannot connect', body: 'Confirm you chose the matching provider, the API key is valid, and the provider account has API access. Check the error shown in the app.' },
                  { title: 'The installer will not run', body: 'Try the latest package from the Downloads section on the Installation page, or inspect the installer script and download manually from GitHub Releases.' },
                  { title: 'The desktop build fails', body: 'For a source build, install Node.js, Rust, and the Microsoft C++ Build Tools, then install dependencies and retry the build.' },
                ].map((item) => (
                  <details key={item.title} className="group rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white/60 dark:bg-[#120f0d]/60 p-4 sm:p-5">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[#080503] dark:text-[#fafaf9] marker:hidden">
                      <span className="flex items-center justify-between gap-4">
                        {item.title}
                        <ArrowRight size={14} className="shrink-0 transition-transform group-open:rotate-90" />
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-[#5e534a] dark:text-[#a89c92]">{item.body}</p>
                  </details>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-[#080503] text-[#fafaf9] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <CircleHelp size={18} className="mt-0.5 shrink-0 text-[#a89c92]" />
                  <div>
                    <h3 className="text-sm font-semibold">Still stuck?</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#a89c92]">Check the source, look for an existing report, or open an issue on GitHub with the steps that reproduce the problem.</p>
                    <a href="https://github.com/jasonhukom/Luminess-Assist/issues" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-white hover-underline">
                      Report an issue <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </article>
        </div>
      </div>
    </section>
  );
};

export default DocumentationTab;
