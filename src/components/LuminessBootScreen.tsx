import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Robot } from './Robot.tsx';
import type { Emotion } from './Robot.tsx';
import './LuminessBootScreen.css';

interface LuminessBootScreenProps {
  onComplete: () => void;
}

const BOOT_STEPS = [
  'Waking up your companion',
  'Restoring your preferences',
  'Preparing the assistant',
  'Checking your AI connection',
];

const TOTAL_DURATION = 3600;
const EXIT_DURATION = 450;

const noop = () => {};

export function LuminessBootScreen({ onComplete }: LuminessBootScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [emotion, setEmotion] = useState<Emotion>('idle');
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    const stepDuration = (TOTAL_DURATION - EXIT_DURATION) / BOOT_STEPS.length;

    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / (TOTAL_DURATION - EXIT_DURATION));
      setProgress(Math.round(ratio * 100));
      setStepIndex(Math.min(BOOT_STEPS.length, Math.floor(elapsed / stepDuration)));
    }, 50);

    const timers = [
      window.setTimeout(() => setEmotion('curiosity'), 900),
      window.setTimeout(() => setEmotion('joy'), TOTAL_DURATION - EXIT_DURATION - 350),
      window.setTimeout(() => setLeaving(true), TOTAL_DURATION - EXIT_DURATION),
      window.setTimeout(onComplete, TOTAL_DURATION),
    ];

    return () => {
      window.clearInterval(progressTimer);
      timers.forEach(window.clearTimeout);
    };
  }, [onComplete]);

  const isReady = stepIndex >= BOOT_STEPS.length;

  return (
    <main
      className={`lum-boot-screen ${leaving ? 'lum-boot-leaving' : ''}`}
      aria-label="Luminess Assist is starting"
      aria-busy={!isReady}
    >
      <div className="lum-boot-glow lum-boot-glow-a" />
      <div className="lum-boot-glow lum-boot-glow-b" />

      <section className="lum-boot-card">
        <div className="lum-boot-robot" aria-hidden="true">
          <div className="lum-boot-robot-halo" />
          <Robot emotion={emotion} size={150} onResize={noop} onClick={noop} />
        </div>

        <div className="lum-boot-badge">
          <Sparkles size={12} />
          <span>{isReady ? 'Ready' : 'Starting up'}</span>
        </div>

        <h1 className="lum-boot-title">Luminess Assist</h1>
        <p className="lum-boot-subtitle">Your friendly desktop companion</p>

        <ul className="lum-boot-steps">
          {BOOT_STEPS.map((step, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'active' : 'pending';
            return (
              <li key={step} className={`lum-boot-step ${state}`}>
                <span className="lum-boot-step-icon">
                  {state === 'done' ? <Check size={11} strokeWidth={3} /> : <i />}
                </span>
                <span>{step}</span>
              </li>
            );
          })}
        </ul>

        <div className="lum-boot-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="lum-boot-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="lum-boot-progress-meta">
          <span>{isReady ? 'All set — say hi!' : BOOT_STEPS[stepIndex]}</span>
          <b>{progress}%</b>
        </div>
      </section>
    </main>
  );
}
