import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  buildCrocPrompt,
  createDefaultCrocSettings,
  isMandatoryUpdateRequired,
  loadCrocSettings,
  CROC_STORAGE_KEY,
  type CrocSettings,
  type WebPermissions,
} from "../lib/crocPrompt.ts";

const fieldClassName =
  "mt-2 w-full rounded-xl border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] px-3.5 py-2.5 text-sm text-[#080503] dark:text-[#fafaf9] outline-none transition placeholder:text-[#5e534a]/60 dark:placeholder:text-[#a89c92]/50 focus:border-[#080503] dark:focus:border-white focus:ring-1 focus:ring-[#080503]/20";

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "color";
  helper?: string;
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="font-medium text-[#080503] dark:text-[#fafaf9]">{props.label}</span>
      {props.helper ? <span className="mt-1 block text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">{props.helper}</span> : null}
      <input
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className={props.type === "color" ? "mt-2 h-11 w-full cursor-pointer rounded-xl border border-[#dad7d0] dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] p-1.5" : fieldClassName}
      />
    </label>
  );
}

function ToneSlider(props: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#080503] dark:text-[#fafaf9]">{props.label}</span>
        <span className="rounded-md border border-[#dad7d0] dark:border-white/10 bg-black/5 dark:bg-white/5 px-2 py-0.5 font-mono text-xs text-[#080503] dark:text-[#fafaf9]">{props.value}/10</span>
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">{props.description}</span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className="mt-4 w-full cursor-pointer accent-[#080503] dark:accent-white"
      />
      <span className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wide text-[#5e534a] dark:text-[#a89c92]">
        <span>Low</span>
        <span>High</span>
      </span>
    </label>
  );
}

function PermissionToggle(props: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[#dad7d0]/80 dark:border-white/10 bg-[#fafaf9] dark:bg-[#0c0907] p-4 transition hover:border-[#080503]/30">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#080503] dark:text-[#fafaf9]">{props.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">{props.description}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-black/20 dark:bg-white/20 transition peer-checked:bg-[#080503] dark:peer-checked:bg-white after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white dark:after:bg-[#080503] after:transition-transform peer-checked:after:translate-x-5" />
      </span>
    </label>
  );
}

function SectionCard(props: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] shadow-sm crosshair-corner">
      <div className="flex items-start gap-3 border-b border-[#dad7d0]/60 dark:border-white/10 px-5 py-4 sm:px-6 bg-[#f3f2ee] dark:bg-[#171411]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#080503]/5 dark:bg-white/10 text-[#080503] dark:text-[#fafaf9]">
          {props.icon}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[#080503] dark:text-[#fafaf9]">{props.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">{props.description}</span>
        </span>
      </div>
      <div className="space-y-5 p-5 sm:p-6">{props.children}</div>
    </section>
  );
}

export function CrocBuilderTab() {
  const [settings, setSettings] = useState<CrocSettings>(() => loadCrocSettings());
  const [notice, setNotice] = useState("");
  const prompt = useMemo(() => buildCrocPrompt(settings), [settings]);
  const mandatoryUpdate = isMandatoryUpdateRequired(settings);
  const promptWordCount = useMemo(() => prompt.trim().split(/\s+/).filter(Boolean).length, [prompt]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CROC_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Local persistence
    }
  }, [settings]);

  function updateField<K extends keyof CrocSettings>(key: K, value: CrocSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function updatePermission(key: keyof WebPermissions, checked: boolean) {
    setSettings((current) => ({
      ...current,
      permissions: { ...current.permissions, [key]: checked },
    }));
    setNotice("");
  }

  async function copyPrompt() {
    try {
      if (!navigator.clipboard?.writeText) {
        setNotice("Clipboard access unavailable. Select prompt manually.");
        return;
      }
      await navigator.clipboard.writeText(prompt);
      setNotice("C.R.O.C. prompt copied to clipboard.");
    } catch {
      setNotice("Select prompt and copy manually.");
    }
  }

  function downloadPrompt() {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "luminess-croc-prompt.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setNotice("Prompt export created.");
  }

  function resetSettings() {
    setSettings(createDefaultCrocSettings());
    setNotice("Default settings restored.");
  }

  return (
    <section className="py-12 sm:py-16 space-y-8 border-t border-[#dad7d0] dark:border-white/10">
      
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dad7d0] dark:border-white/15 bg-[#080503]/5 dark:bg-white/5 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#080503] dark:text-[#fafaf9]">
            <Sparkles size={12} />
            Context &bull; Role &bull; Output &bull; Constraints
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-[#080503] dark:text-[#fafaf9]">
            C.R.O.C. Studio
            <span className="block editorial-serif font-normal text-[#5e534a] dark:text-[#a89c92]">
              System Prompt Architect
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5e534a] dark:text-[#a89c92] sm:text-base">
            Build Luminess's structured system prompt, tune conversational tone, and define capability boundaries with mathematical rigor.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-full border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-[#120f0d] px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={16} />
          </span>
          <div className="text-xs font-mono">
            <span className="block font-semibold text-[#080503] dark:text-white">Local Draft</span>
            <span className="text-[11px] text-[#5e534a] dark:text-[#a89c92]">Saved in browser</span>
          </div>
        </div>
      </div>

      {mandatoryUpdate ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
          <ShieldCheck className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={18} />
          <span>
            <strong>Mandatory update rule active:</strong> Client {settings.clientVersion} is behind latest server version {settings.latestVersion}. The generated prompt injects an explicit update directive.
          </span>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        
        {/* Left Column: Form Controls */}
        <div className="space-y-6">
          <SectionCard
            title="Context & Identity"
            description="The profile information Luminess references in conversational exchanges."
            icon={<UserRound size={17} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Companion name" value={settings.botName} onChange={(value) => updateField("botName", value)} placeholder="Luminess" />
              <TextField label="User callsign" value={settings.userName} onChange={(value) => updateField("userName", value)} placeholder="Pilot" />
              <TextField label="Avatar model" value={settings.appearanceModel} onChange={(value) => updateField("appearanceModel", value)} placeholder="Luminess Robot" />
              <TextField label="Avatar accessory" value={settings.appearanceAccessory} onChange={(value) => updateField("appearanceAccessory", value)} placeholder="Headphones" />
              <TextField label="Primary avatar color" type="color" value={settings.appearanceColor} onChange={(value) => updateField("appearanceColor", value)} />
              <TextField label="Personality archetype" value={settings.personalityArchetype} onChange={(value) => updateField("personalityArchetype", value)} placeholder="Witty Hacker" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#dad7d0]/60 dark:border-white/5">
              <TextField label="Client version" value={settings.clientVersion} onChange={(value) => updateField("clientVersion", value)} placeholder="1.1.2" />
              <TextField label="Latest server version" value={settings.latestVersion} onChange={(value) => updateField("latestVersion", value)} placeholder="1.1.2" />
            </div>

            <PermissionToggle
              title="Mandatory update flag"
              description="When enabled, companion alerts the user if their client version is outdated."
              checked={settings.isMandatoryUpdate}
              onChange={(checked) => updateField("isMandatoryUpdate", checked)}
            />
          </SectionCard>

          <SectionCard
            title="Personality Tuning"
            description="Adjust tone values from 0 (conservative) to 10 (pronounced)."
            icon={<SlidersHorizontal size={17} />}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <ToneSlider label="Formality" description="Casual to strict" value={settings.toneFormality} onChange={(value) => updateField("toneFormality", value)} />
              <ToneSlider label="Humor" description="Dry to playful" value={settings.toneHumor} onChange={(value) => updateField("toneHumor", value)} />
              <ToneSlider label="Verbosity" description="Snappy to detailed" value={settings.toneVerbosity} onChange={(value) => updateField("toneVerbosity", value)} />
            </div>
            
            <label className="block text-sm">
              <span className="font-medium text-[#080503] dark:text-[#fafaf9]">Custom backstory and behavioral guidelines</span>
              <span className="mt-1 block text-xs leading-relaxed text-[#5e534a] dark:text-[#a89c92]">Injected as master persona instructions.</span>
              <textarea
                rows={4}
                maxLength={4000}
                value={settings.userCustomPrompt}
                onChange={(event) => updateField("userCustomPrompt", event.target.value)}
                placeholder="Optional background, preferred code formatting, workflow goals..."
                className={fieldClassName + " resize-y font-mono text-xs"}
              />
              <span className="mt-1 block text-right font-mono text-[10px] text-[#5e534a] dark:text-[#a89c92]">{settings.userCustomPrompt.length}/4000</span>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-[#080503] dark:text-[#fafaf9]">Maximum reply words</span>
              <input
                type="number"
                min={10}
                max={250}
                value={settings.maxWordCount}
                onChange={(event) => updateField("maxWordCount", Math.min(250, Math.max(10, Number(event.target.value) || 10)))}
                className={fieldClassName}
              />
            </label>
          </SectionCard>

          <SectionCard
            title="Desktop Permission Loadout"
            description="Explicit authorization boundaries for desktop task execution."
            icon={<ShieldCheck size={17} />}
          >
            <div className="space-y-3">
              <PermissionToggle title="Open external URLs" description="Allow opening browser destinations with user validation." checked={settings.permissions.canOpenUrls} onChange={(checked) => updatePermission("canOpenUrls", checked)} />
              <PermissionToggle title="Read clipboard context" description="Read clipboard text only when explicitly invoked by user." checked={settings.permissions.canReadClipboard} onChange={(checked) => updatePermission("canReadClipboard", checked)} />
              <PermissionToggle title="Write to clipboard" description="Copy formatted responses or code directly to clipboard." checked={settings.permissions.canWriteClipboard} onChange={(checked) => updatePermission("canWriteClipboard", checked)} />
              <PermissionToggle title="Use in-app timers" description="Set Pomodoro and focus sprint reminders." checked={settings.permissions.canSetTimers} onChange={(checked) => updatePermission("canSetTimers", checked)} />
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Live Prompt Preview */}
        <aside className="xl:sticky xl:top-28">
          <section className="overflow-hidden rounded-2xl border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-[#120f0d] shadow-sm crosshair-corner">
            
            <div className="border-b border-[#dad7d0]/60 dark:border-white/10 bg-[#f3f2ee] dark:bg-[#171411] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#080503] dark:text-[#fafaf9]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Prompt Output
                  </div>
                  <h2 className="mt-1 text-xl font-display font-bold text-[#080503] dark:text-[#fafaf9]">
                    Generated Master Prompt
                  </h2>
                </div>
                <span className="p-2 rounded-full border border-[#dad7d0] dark:border-white/10 bg-white dark:bg-white/5 text-[#080503] dark:text-[#fafaf9]">
                  <Sparkles size={16} />
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#080503] text-[#fafaf9] dark:bg-white dark:text-[#080503] px-4 py-2 text-xs font-mono font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  <Copy size={13} />
                  <span>Copy Prompt</span>
                </button>
                <button
                  type="button"
                  onClick={downloadPrompt}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-white/5 px-3.5 py-2 text-xs font-mono font-medium text-[#080503] dark:text-[#fafaf9] hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>Export .txt</span>
                </button>
                <button
                  type="button"
                  onClick={resetSettings}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#dad7d0] dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-xs font-mono font-medium text-[#5e534a] dark:text-[#a89c92] hover:text-[#080503] dark:hover:text-white transition-all cursor-pointer"
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              {notice && (
                <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  <Check size={13} />
                  <span>{notice}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-[#dad7d0]/60 dark:border-white/5 px-5 py-2.5 font-mono text-[11px] text-[#5e534a] dark:text-[#a89c92] bg-[#fafaf9] dark:bg-[#0c0907]">
              <span>System Prompt Format</span>
              <span>{promptWordCount.toLocaleString()} words</span>
            </div>

            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed text-[#080503] dark:text-[#fafaf9] bg-[#fafaf9] dark:bg-[#0c0907] select-all">
              {prompt}
            </pre>

          </section>
        </aside>

      </div>
    </section>
  );
}

export default CrocBuilderTab;
