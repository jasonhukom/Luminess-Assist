import React from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  ExternalLink,
  Zap,
  EyeOff
} from 'lucide-react';

export const ArchitectureTab: React.FC = () => {
  const providers = [
    {
      name: 'Google Gemini',
      tag: 'Default Provider',
      model: 'gemini-2.5-flash / Pro',
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-400/30 text-blue-300',
      badge: 'Free Tier Available',
      keyUrl: 'https://aistudio.google.com/app/apikey',
      keyLabel: 'Google AI Studio',
      description: 'Rapid multimodel inference, function calling, and structured JSON output. Integrates natively with Google Sign-In or API keys.',
      features: ['Structured tool calling', 'Fastest response latency', 'High free rate limits'],
    },
    {
      name: 'Anthropic Claude',
      tag: 'Reasoning Engine',
      model: 'claude-3-5-sonnet',
      color: 'from-orange-500/20 to-amber-500/10 border-orange-400/30 text-orange-300',
      badge: 'High Reasoning',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keyLabel: 'Anthropic Console',
      description: 'Elite coding reasoning, complex workflow orchestration, and deep analytical problem-solving directly on your desktop.',
      features: ['Superior coding logic', 'Nuanced conversational tone', 'Direct Anthropic API routing'],
    },
    {
      name: 'OpenAI Codex',
      tag: 'System Automation',
      model: 'gpt-4o / Codex',
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-400/30 text-emerald-300',
      badge: 'General Automation',
      keyUrl: 'https://platform.openai.com/api-keys',
      keyLabel: 'OpenAI Platform',
      description: 'Battle-tested general-purpose model with broad tool execution fidelity and command generation precision.',
      features: ['PowerShell command generation', 'Extensive knowledge base', 'Reliable tool parsing'],
    },
  ];

  return (
    <div className="py-8 space-y-10">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-mono">
          <Cpu size={14} />
          <span>MULTI-PROVIDER AI MATRIX</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          One Companion. Any AI Provider.
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Luminess Assist is provider-agnostic. You own your intelligence pipeline. Choose your preferred AI backend, 
          switch anytime, and keep all credentials strictly private on your machine.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {providers.map((p) => (
          <div
            key={p.name}
            className={`p-6 rounded-2xl bg-gradient-to-b ${p.color} border backdrop-blur-xl flex flex-col justify-between space-y-5 transition-transform hover:-translate-y-1 duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)]`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-white border border-white/[0.1]">
                  {p.tag}
                </span>
                <span className="text-xs font-mono text-slate-300">
                  {p.badge}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-1">{p.name}</h3>
                <span className="text-xs font-mono text-slate-400 block mb-2">{p.model}</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                {p.features.map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 size={13} className="text-cyan-400 flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <a
              href={p.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-mono font-medium text-white transition-all"
            >
              <span>Get Key ({p.keyLabel})</span>
              <ExternalLink size={12} />
            </a>
          </div>
        ))}
      </div>

      {/* Security & Zero-Leakage Guarantee */}
      <div className="max-w-5xl mx-auto rounded-2xl p-6 sm:p-8 bg-[#090b14] border border-emerald-500/25 shadow-[0_0_35px_rgba(16,185,129,0.12)] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-mono">
              ZERO-TELEMETRY &amp; CLIENT-SIDE SECURITY ARCHITECTURE
            </h3>
            <p className="text-xs text-slate-400">
              How Luminess Assist guarantees privacy and keeps your API tokens secure.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300 leading-relaxed">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white font-mono">
              <EyeOff size={14} className="text-emerald-400" />
              <span>Local Storage Only</span>
            </div>
            <p>
              Your API keys never touch any intermediary Luminess server. Requests are sent directly from your local PC to the official API endpoints (Google, Anthropic, or OpenAI).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white font-mono">
              <ShieldCheck size={14} className="text-cyan-400" />
              <span>Permission Guard</span>
            </div>
            <p>
              When the assistant wants to execute a desktop tool (e.g. running PowerShell, inspecting files), a security modal prompts you to Approve or Deny before anything executes.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white font-mono">
              <Zap size={14} className="text-purple-400" />
              <span>Fully Open Source</span>
            </div>
            <p>
              Every line of Rust and React code is completely inspectable on GitHub. No hidden phone-home telemetry, ad trackers, or background coin miners.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
