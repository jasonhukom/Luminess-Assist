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
  "mt-2 w-full rounded-xl border border-white/10 bg-[#080a10] px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10";

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
      <span className="font-medium text-slate-200">{props.label}</span>
      {props.helper ? <span className="mt-1 block text-xs leading-relaxed text-slate-500">{props.helper}</span> : null}
      <input
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className={props.type === "color" ? "mt-2 h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-[#080a10] p-1.5" : fieldClassName}
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
    <label className="block rounded-xl border border-white/[0.07] bg-black/20 p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-200">{props.label}</span>
        <span className="rounded-md border border-cyan-400/20 bg-cyan-400/[0.08] px-2 py-1 font-mono text-xs text-cyan-200">{props.value}/10</span>
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{props.description}</span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className="mt-4 w-full cursor-pointer accent-cyan-400"
      />
      <span className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wide text-slate-600">
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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/20 p-4 transition hover:border-cyan-400/20">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-200">{props.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{props.description}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-slate-700 transition peer-checked:bg-cyan-500/80 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0b0e16] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
      </span>
    </label>
  );
}

function SectionCard(props: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b0e16]/90 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
      <div className="flex items-start gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
          {props.icon}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-white">{props.title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">{props.description}</span>
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
      // Local persistence is optional; the builder remains usable without it.
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
        setNotice("Clipboard access is unavailable here. Select the prompt and copy it manually.");
        return;
      }
      await navigator.clipboard.writeText(prompt);
      setNotice("C.R.O.C. prompt copied to the clipboard.");
    } catch {
      setNotice("The browser blocked clipboard access. Select the prompt and copy it manually.");
    }
  }

  function downloadPrompt() {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "luminess-web-croc-prompt.txt";
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
    <div className="space-y-7 py-4 sm:py-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Sparkles size={13} />
            Context · Role · Output · Constraints
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
            C.R.O.C. <span className="text-cyan-300">for the Web</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Build AURA's web-specific system prompt, tune the companion's personality, and define the browser actions it may request. Windows-only powers stay outside the browser.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-[#0b0e16]/90 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
            <ShieldCheck size={19} />
          </span>
          <span>
            <span className="block text-xs font-semibold text-slate-200">Local draft</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">Saved in this browser only</span>
          </span>
        </div>
      </div>

      {mandatoryUpdate ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-4 text-sm text-amber-100">
          <ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={18} />
          <span>
            <strong>Mandatory update rule is active.</strong> Client {settings.clientVersion} is behind {settings.latestVersion}; the generated prompt requires a SHOW_UPDATE_BANNER action.
          </span>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(390px,0.98fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Context & identity"
            description="The profile information AURA may use in its replies."
            icon={<UserRound size={19} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Companion name" value={settings.botName} onChange={(value) => updateField("botName", value)} placeholder="AURA" />
              <TextField label="User name" value={settings.userName} onChange={(value) => updateField("userName", value)} placeholder="Optional" />
              <TextField label="Avatar model" value={settings.appearanceModel} onChange={(value) => updateField("appearanceModel", value)} placeholder="Luminess Robot" />
              <TextField label="Avatar accessory" value={settings.appearanceAccessory} onChange={(value) => updateField("appearanceAccessory", value)} placeholder="None" />
              <TextField label="Primary avatar color" type="color" value={settings.appearanceColor} onChange={(value) => updateField("appearanceColor", value)} />
              <TextField label="Personality archetype" value={settings.personalityArchetype} onChange={(value) => updateField("personalityArchetype", value)} placeholder="Witty Hacker" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Client version" value={settings.clientVersion} onChange={(value) => updateField("clientVersion", value)} placeholder="1.1.0" />
              <TextField label="Latest server version" value={settings.latestVersion} onChange={(value) => updateField("latestVersion", value)} placeholder="1.1.0" />
            </div>

            <PermissionToggle
              title="Mandatory update"
              description="When enabled and the client version is behind the latest version, require the update banner action."
              checked={settings.isMandatoryUpdate}
              onChange={(checked) => updateField("isMandatoryUpdate", checked)}
            />
          </SectionCard>

          <SectionCard
            title="Personality tuning"
            description="Set tone values from 0 (low) to 10 (high)."
            icon={<SlidersHorizontal size={19} />}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <ToneSlider label="Formality" description="Casual to formal" value={settings.toneFormality} onChange={(value) => updateField("toneFormality", value)} />
              <ToneSlider label="Humor" description="Straight-laced to playful" value={settings.toneHumor} onChange={(value) => updateField("toneHumor", value)} />
              <ToneSlider label="Verbosity" description="Brief to detailed" value={settings.toneVerbosity} onChange={(value) => updateField("toneVerbosity", value)} />
            </div>
            <label className="block text-sm">
              <span className="font-medium text-slate-200">Custom backstory or notes</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">These notes shape style and preferences, but cannot override security or administrator rules.</span>
              <textarea
                rows={4}
                maxLength={4000}
                value={settings.userCustomPrompt}
                onChange={(event) => updateField("userCustomPrompt", event.target.value)}
                placeholder="Optional background, preferred communication style, recurring goals..."
                className={fieldClassName + " resize-y"}
              />
              <span className="mt-1 block text-right font-mono text-[10px] text-slate-600">{settings.userCustomPrompt.length}/4000</span>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-200">Maximum reply words</span>
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
            title="Browser permission loadout"
            description="These flags describe allowed capabilities; the real web client must enforce them independently."
            icon={<ShieldCheck size={19} />}
          >
            <div className="space-y-3">
              <PermissionToggle title="Open external URLs" description="Allow requesting a validated http/https destination. Confirmation is still required." checked={settings.permissions.canOpenUrls} onChange={(checked) => updatePermission("canOpenUrls", checked)} />
              <PermissionToggle title="Navigate within this website" description="Allow changing to same-origin routes only; never navigate to arbitrary origins." checked={settings.permissions.canNavigateRoutes} onChange={(checked) => updatePermission("canNavigateRoutes", checked)} />
              <PermissionToggle title="Download safe exports" description="Allow user-requested text or configuration exports. Executables and unverified installers are never allowed." checked={settings.permissions.canDownloadFiles} onChange={(checked) => updatePermission("canDownloadFiles", checked)} />
              <PermissionToggle title="Read clipboard context" description="Off by default. A browser integration must obtain permission and explicit user interaction; the prompt itself cannot read it." checked={settings.permissions.canReadClipboard} onChange={(checked) => updatePermission("canReadClipboard", checked)} />
              <PermissionToggle title="Write to clipboard" description="Allow copying text only through a supported browser API and a user-initiated action." checked={settings.permissions.canWriteClipboard} onChange={(checked) => updatePermission("canWriteClipboard", checked)} />
              <PermissionToggle title="Use in-page timers" description="Allow timers inside the web experience, not native Windows timers or background OS actions." checked={settings.permissions.canSetTimers} onChange={(checked) => updatePermission("canSetTimers", checked)} />
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3 text-xs leading-relaxed text-amber-100/80">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-300" />
              A prompt is not a security boundary. The application must verify each requested action and permission before executing anything.
            </div>
          </SectionCard>
        </div>

        <aside className="xl:sticky xl:top-28">
          <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#080b13]/95 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
            <div className="border-b border-white/[0.08] bg-gradient-to-r from-cyan-400/[0.08] to-purple-500/[0.06] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live prompt preview
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-white">Generated C.R.O.C.</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">Copy the prompt into your supported web AI runtime.</p>
                </div>
                <span className="rounded-lg border border-white/10 bg-black/20 p-2 text-cyan-300">
                  <Sparkles size={18} />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3.5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300">
                  <Copy size={14} />
                  Copy prompt
                </button>
                <button type="button" onClick={downloadPrompt} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]">
                  <Download size={14} />
                  Export .txt
                </button>
                <button type="button" onClick={resetSettings} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-400 transition hover:text-white">
                  <RotateCcw size={14} />
                  Reset
                </button>
              </div>
              {notice ? (
                <p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                  <Check size={14} />
                  {notice}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3 font-mono text-[10px] uppercase tracking-wide text-slate-500 sm:px-6">
              <span>Plain-text system prompt</span>
              <span>{promptWordCount.toLocaleString()} words</span>
            </div>
            <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-[11px] leading-6 text-slate-300 sm:p-6">{prompt}</pre>
            <div className="border-t border-white/[0.06] px-5 py-4 text-xs leading-relaxed text-slate-500 sm:px-6">
              Settings are stored locally in this browser. This builder does not sync a cloud profile or execute the generated actions.
            </div>
          </section>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan-300" />
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Browser-safe by design</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Web actions are limited to browser capabilities and explicit permissions. Desktop-only capabilities must remain in the trusted native client.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CrocBuilderTab;
