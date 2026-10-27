import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Binary,
  Check,
  CircleDot,
  Code2,
  Cpu,
  Database,
  Gauge,
  Layers,
  LockKeyhole,
  Network,
  Radio,
  Terminal,
  Zap,
} from 'lucide-react';
import './AuraBootScreen.css';

interface AuraBootScreenProps {
  onComplete: () => void;
}

const BOOT_TRACE = [
  ['00.018', 'AURA', 'Waking the visual core'],
  ['00.146', 'MOUNT', 'React renderer attached'],
  ['00.284', 'BRIDGE', 'Tauri desktop bridge detected'],
  ['00.431', 'MEMORY', 'Restoring local preferences'],
  ['00.608', 'MASCOT', 'Loading companion expression map'],
  ['00.824', 'MOTION', 'Calibrating pointer and window physics'],
  ['01.037', 'AGENT', 'Preparing assistant orchestration'],
  ['01.291', 'AUTH', 'Checking saved account session'],
  ['01.582', 'PROVIDER', 'Looking for a configured AI engine'],
  ['01.814', 'READY', 'Waiting for user authentication'],
];

const MODULES = [
  { name: 'RENDER CORE', value: 'ONLINE', tone: 'green' },
  { name: 'DESKTOP BRIDGE', value: 'CONNECTED', tone: 'cyan' },
  { name: 'AI ORCHESTRATOR', value: 'STANDBY', tone: 'violet' },
  { name: 'LOCAL SESSION', value: 'READY', tone: 'green' },
];

const CODE_LINES = [
  'const companion = await aura.initialize();',
  'await companion.restoreSession();',
  'await agent.prepareProviders();',
  'render(<LuminessAssist />);',
];

export function AuraBootScreen({ onComplete }: AuraBootScreenProps) {
  const [stage, setStage] = useState(0);
  const [traceCount, setTraceCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [clock, setClock] = useState('00:00:00');

  useEffect(() => {
    const startedAt = Date.now();
    const stageTimers = [
      window.setTimeout(() => setStage(1), 420),
      window.setTimeout(() => setStage(2), 1050),
      window.setTimeout(() => setStage(3), 4700),
      window.setTimeout(onComplete, 5550),
    ];
    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(100, Math.round((elapsed / 5550) * 100)));
      setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    }, 65);
    const traceTimer = window.setInterval(() => {
      setTraceCount((current) => Math.min(BOOT_TRACE.length, current + 1));
    }, 330);

    return () => {
      stageTimers.forEach(window.clearTimeout);
      window.clearInterval(progressTimer);
      window.clearInterval(traceTimer);
    };
  }, [onComplete]);

  return (
    <main className={`aura-boot-screen aura-stage-${stage}`} aria-label="Luminess Assist startup">
      <div className="aura-grid" />
      <div className="aura-scanlines" />
      <div className="aura-vignette" />
      <div className="aura-crosshair aura-crosshair-top" />
      <div className="aura-crosshair aura-crosshair-bottom" />

      <header className="aura-topbar">
        <div className="aura-brand-lockup">
          <div className="aura-mark"><Binary size={19} strokeWidth={1.8} /></div>
          <div>
            <div className="aura-brand-name">AURA<span>//</span>LUMIN<span>ESS</span></div>
            <div className="aura-brand-sub">PERSONAL INTELLIGENCE SYSTEM</div>
          </div>
        </div>
        <div className="aura-header-meta">
          <span className="aura-live-dot" />
          <span>LOCAL STARTUP SEQUENCE</span>
          <span className="aura-meta-divider" />
          <span className="aura-time">{clock}</span>
        </div>
      </header>

      <section className="aura-main">
        <aside className="aura-rail aura-rail-left">
          <div className="aura-rail-label">SYSTEM / 01</div>
          <div className="aura-rail-stat"><span>ENV</span><strong>DESKTOP</strong></div>
          <div className="aura-rail-stat"><span>MODE</span><strong>LOCAL</strong></div>
          <div className="aura-rail-stat"><span>LINK</span><strong className="text-green">READY</strong></div>
          <div className="aura-vertical-text">A U R A — P R O T O C O L</div>
        </aside>

        <div className="aura-center">
          <div className="aura-orbit aura-orbit-outer" />
          <div className="aura-orbit aura-orbit-inner" />
          <div className="aura-orbit-node aura-node-a" />
          <div className="aura-orbit-node aura-node-b" />
          <div className="aura-logo-core">
            <div className="aura-logo-glyph"><span>L</span></div>
            <div className="aura-core-halo" />
          </div>
          <div className="aura-title-wrap">
            <div className="aura-eyebrow"><span /> SYSTEM INITIALIZATION <span /></div>
            <h1>LUMIN<span>ESS</span></h1>
            <div className="aura-title-sub">ASSIST <i>•</i> PERSONAL DESKTOP AI</div>
            <p className="aura-center-caption">
              {stage < 2 ? 'Waking up your companion…' : stage < 3 ? 'Mapping the system. Preparing the mind.' : 'Initialization complete. Handing control to you.'}
            </p>
          </div>
        </div>

        <aside className="aura-rail aura-rail-right">
          <div className="aura-rail-label">TELEMETRY / 02</div>
          <div className="aura-ring-meter">
            <div className="aura-ring-inner"><strong>{Math.min(99, 62 + Math.round(progress * 0.31))}%</strong><small>CORE</small></div>
          </div>
          <div className="aura-rail-caption">RENDER CORE<br /><b>Nominal operation</b></div>
          <div className="aura-signal-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="aura-rail-caption">SIGNAL / STABLE</div>
        </aside>
      </section>

      {stage >= 2 && (
        <section className="aura-console-grid">
          <article className="aura-panel aura-trace-panel">
            <div className="aura-panel-head">
              <div><Terminal size={13} /><span>BOOT TRACE</span></div>
              <small>SESSION LOG // LIVE</small>
            </div>
            <div className="aura-trace-list">
              {BOOT_TRACE.slice(0, traceCount).slice(-6).map(([time, scope, message]) => (
                <div className="aura-trace-line" key={time}>
                  <span className="aura-trace-time">{time}</span>
                  <b>{scope}</b>
                  <span>{message}</span>
                  <Check size={11} />
                </div>
              ))}
              <div className="aura-trace-cursor"><span /> Awaiting operator</div>
            </div>
          </article>

          <article className="aura-panel aura-module-panel">
            <div className="aura-panel-head">
              <div><Layers size={13} /><span>MODULE MATRIX</span></div>
              <small>4 / 4</small>
            </div>
            <div className="aura-module-list">
              {MODULES.map((module) => (
                <div className="aura-module-row" key={module.name}>
                  <span className={`aura-module-dot ${module.tone}`} />
                  <span>{module.name}</span>
                  <b className={`text-${module.tone}`}>{module.value}</b>
                </div>
              ))}
            </div>
            <div className="aura-module-foot"><LockKeyhole size={11} /> PRIVATE SESSION / NO REMOTE DASHBOARD</div>
          </article>

          <article className="aura-panel aura-activity-panel">
            <div className="aura-panel-head">
              <div><Activity size={13} /><span>RUNTIME ACTIVITY</span></div>
              <small>RENDERER</small>
            </div>
            <div className="aura-chart-labels"><span>FRAME FLOW</span><span>LIVE VISUAL</span></div>
            <svg className="aura-line-chart" viewBox="0 0 280 62" preserveAspectRatio="none" aria-label="Animated visual runtime graph">
              <defs>
                <linearGradient id="aura-chart-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#31f7d0" stopOpacity=".35" />
                  <stop offset="100%" stopColor="#31f7d0" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="aura-chart-fill" d="M0,47 L18,44 L36,48 L54,30 L72,37 L90,18 L108,33 L126,27 L144,36 L162,12 L180,22 L198,16 L216,29 L234,9 L252,22 L280,8 L280,62 L0,62 Z" />
              <path className="aura-chart-line" d="M0,47 L18,44 L36,48 L54,30 L72,37 L90,18 L108,33 L126,27 L144,36 L162,12 L180,22 L198,16 L216,29 L234,9 L252,22 L280,8" />
            </svg>
            <div className="aura-activity-metrics">
              <div><span><Cpu size={11} /> THREAD</span><b>ACTIVE</b></div>
              <div><span><Database size={11} /> SESSION</span><b>LOCAL</b></div>
              <div><span><Network size={11} /> PROVIDERS</span><b>READY TO LINK</b></div>
            </div>
          </article>

          <article className="aura-panel aura-code-panel">
            <div className="aura-panel-head">
              <div><Code2 size={13} /><span>EXECUTION WINDOW</span></div>
              <small>TS / TSX</small>
            </div>
            <div className="aura-code-body">
              {CODE_LINES.map((line, index) => (
                <div key={line}><span>{String(index + 1).padStart(2, '0')}</span><code>{line}</code></div>
              ))}
            </div>
            <div className="aura-code-footer"><span>UTF-8</span><span>REACT · TYPESCRIPT</span><span>LOCAL</span></div>
          </article>

          <article className="aura-panel aura-power-panel">
            <div className="aura-panel-head">
              <div><Zap size={13} /><span>POWER & SIGNAL</span></div>
              <small>VISUAL TELEMETRY</small>
            </div>
            <div className="aura-power-content">
              <div className="aura-donut"><div><strong>100%</strong><small>MODULES</small></div></div>
              <div className="aura-power-breakdown">
                <div><i className="dot-cyan" /><span>Renderer</span><b>40%</b></div>
                <div><i className="dot-violet" /><span>Desktop bridge</span><b>35%</b></div>
                <div><i className="dot-green" /><span>Agent layer</span><b>25%</b></div>
              </div>
            </div>
            <div className="aura-power-foot"><Gauge size={12} /> UI visualization — not hardware power or OS performance data</div>
          </article>

          <article className="aura-panel aura-task-panel">
            <div className="aura-panel-head">
              <div><Radio size={13} /><span>PROCESS WINDOWS</span></div>
              <small>INTERNAL PANELS</small>
            </div>
            <div className="aura-process-windows">
              <div className="aura-mini-window"><span><i /> SEARCH</span><b>Scanning local config</b><small>DONE</small></div>
              <div className="aura-mini-window"><span><i /> RUNNER</span><b>Warming agent pipeline</b><small>READY</small></div>
              <div className="aura-mini-window"><span><i /> WATCHER</span><b>Waiting for user input</b><small>STANDBY</small></div>
            </div>
            <div className="aura-panel-foot"><CircleDot size={10} /> These are in-app activity panels, not external windows.</div>
          </article>
        </section>
      )}

      <footer className="aura-footer">
        <div className="aura-progress-meta"><span><Activity size={12} /> AURA BOOT SEQUENCE</span><b>{String(progress).padStart(3, '0')}%</b></div>
        <div className="aura-progress-track"><div style={{ width: `${progress}%` }} /></div>
        <div className="aura-footer-bottom">
          <span><Zap size={11} /> DESKTOP COMPANION CORE</span>
          <span>EN · ID · PY · TS · RS · BINARY</span>
          <span>BUILD 01 / AUTHENTICATING USER</span>
          <ArrowUpRight size={12} />
        </div>
      </footer>
    </main>
  );
}
