import React from 'react';
import {
  Cpu,
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  ExternalLink,
  ArrowUpRight,
  Server,
  Layers,
  Terminal,
} from 'lucide-react';

export const ArchitectureTab: React.FC = () => {
  const providers = [
    {
      name: 'Google Gemini',
      tag: 'Default Provider',
      model: 'gemini-2.5-flash / Pro',
      badge: 'Free Tier Available',
      keyUrl: 'https://aistudio.google.com/app/apikey',
      keyLabel: 'Google AI Studio',
      description: 'Ultra-low latency multimodel inference, function calling, and structured JSON output. Supports Google Sign-In or local API keys.',
      features: ['Native tool & function calling', 'Sub-300ms token generation', 'High free-tier quota'],
    },
    {
      name: 'Anthropic Claude',
      tag: 'Reasoning Engine',
      model: 'claude-3-5-sonnet',
      badge: 'Analytical Precision',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keyLabel: 'Anthropic Console',
      description: 'Superior coding reasoning, complex workflow orchestration, and deep analytical problem-solving directly on your desktop.',
      features: ['Nuanced conversational tone', 'Advanced codebase debugging', 'Direct Anthropic SDK routing'],
    },
    {
      name: 'OpenAI Codex',
      tag: 'System Automation',
      model: 'gpt-4o / Codex',
      badge: 'General Automation',
      keyUrl: 'https://platform.openai.com/api-keys',
      keyLabel: 'OpenAI Platform',
      description: 'Battle-tested general-purpose model with broad tool execution fidelity and precise Windows command generation.',
      features: ['PowerShell command synthesis', 'Extensive knowledge base', 'Reliable tool parsing'],
    },
  ];

  return (
    <section className="py-16 lg:py-24 border-t border-[#dad7d0] dark:border-white/10">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-16 text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
          <span className="font-mono text-xs font-semibold tracking-widest text-[#5e534a] dark:text-[#a89c92] uppercase">
            MULTI-MODEL AI ARCHITECTURE
          </span>
          <span className="w-8 h-px bg-[#080503]/40 dark:bg-white/40" />
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
          Provider-agnostic.
          <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
            Zero vendor lock-in.
          </span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-[#5e534a] dark:text-[#a89c92] max-w-2xl mx-auto leading-relaxed">
          Luminess Assist connects directly from your Windows desktop to your model provider. 
          Your API keys never route through third-party proxy servers, ensuring absolute confidentiality and zero markup.
        </p>
      </div>

      {/* 3 Provider Cards */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {providers.map((p) => (
          <div
            key={p.name}
            className="p-8 rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] flex flex-col justify-between space-y-6 shadow-sm crosshair-corner"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#080503]/5 dark:bg-white/10 text-[#080503] dark:text-[#fafaf9] font-semibold uppercase tracking-wider">
                  {p.tag}
                </span>
                <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92]">
                  {p.badge}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-display font-bold text-[#080503] dark:text-[#fafaf9] mb-1">
                  {p.name}
                </h3>
                <span className="text-xs font-mono text-[#5e534a] dark:text-[#a89c92] block mb-3">
                  {p.model}
                </span>
                <p className="text-sm text-[#5e534a] dark:text-[#a89c92] leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="space-y-2 pt-3 border-t border-[#dad7d0]/60 dark:border-white/10">
                {p.features.map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-xs text-[#5e534a] dark:text-[#a89c92]">
                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#dad7d0]/60 dark:border-white/10">
              <a
                href={p.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-[#dad7d0] dark:border-white/15 hover:border-[#080503] dark:hover:border-white text-xs font-mono font-medium text-[#080503] dark:text-[#fafaf9] hover:bg-[#080503]/5 dark:hover:bg-white/5 transition-all"
              >
                <span>Get Key &bull; {p.keyLabel}</span>
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* System Architecture Blueprint (Inverted Canvas Section) */}
      <div className="max-w-4xl mx-auto rounded-2xl bg-[#080503] text-[#fafaf9] p-8 sm:p-10 shadow-sm crosshair-corner border border-white/10">
        
        <div className="mb-6 flex items-center gap-3">
          <span className="w-6 h-px bg-white/40" />
          <span className="font-mono text-xs font-semibold tracking-widest text-[#a89c92] uppercase">
            LOCAL SYSTEM EXECUTION GUARANTEES
          </span>
        </div>

        <h3 className="text-2xl font-display font-bold tracking-tight text-white mb-6">
          Four layers of desktop privacy
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-[#a89c92]">
          
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center gap-2 text-white font-mono text-xs font-bold uppercase">
              <Lock size={14} className="text-amber-400" />
              <span>01 &bull; Local Key Vault</span>
            </div>
            <p className="text-xs leading-relaxed">
              API tokens are stored exclusively inside your local Windows AppData sandbox or encrypted browser storage. Never transmitted to third-party database mirrors.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center gap-2 text-white font-mono text-xs font-bold uppercase">
              <Server size={14} className="text-emerald-400" />
              <span>02 &bull; Direct Provider TLS</span>
            </div>
            <p className="text-xs leading-relaxed">
              Requests travel directly over encrypted HTTPS/TLS from your PC to Google, Anthropic, or OpenAI endpoints, ensuring zero intermediate proxy surveillance.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center gap-2 text-white font-mono text-xs font-bold uppercase">
              <Terminal size={14} className="text-cyan-400" />
              <span>03 &bull; Explicit Tool Approval</span>
            </div>
            <p className="text-xs leading-relaxed">
              Any destructive action—such as executing arbitrary PowerShell scripts or deleting files—requires explicit user confirmation before execution.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center gap-2 text-white font-mono text-xs font-bold uppercase">
              <ShieldCheck size={14} className="text-purple-400" />
              <span>04 &bull; Antigravity CLI Bridge</span>
            </div>
            <p className="text-xs leading-relaxed">
              Detects local Google Antigravity CLI installations and safely connects over supported process interfaces with verified exit code handling.
            </p>
          </div>

        </div>

      </div>

    </section>
  );
};
