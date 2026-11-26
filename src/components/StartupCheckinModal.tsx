import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import './FloatingBoxes.css';
import {
  Activity,
  AppWindow,
  Check,
  Droplets,
  ExternalLink,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Robot, type Emotion, type VisualEmotion } from './Robot.tsx';
import type { BotCustomizationManifest } from '../lib/botCustomization.ts';
import {
  formatWellbeingDuration,
  type RecentRealAppItem,
} from '../lib/digitalWellbeing.ts';

interface StartupCheckinModalProps {
  botName: string;
  userName: string;
  emotion: Emotion;
  visualEmotion: VisualEmotion;
  customization?: BotCustomizationManifest;
  drinkDailyGlasses: number;
  drinkGoalGlasses: number;
  recentApps: RecentRealAppItem[];
  onLogDrink: () => void;
  onLaunchApp: (app: RecentRealAppItem) => void;
  onSubmitActivity: (activityText: string) => void;
  onOpenRecentTabInWellbeing: () => void;
  onSkip: () => void;
}

export function StartupCheckinModal({
  botName,
  userName,
  emotion,
  visualEmotion,
  customization,
  drinkDailyGlasses,
  drinkGoalGlasses,
  recentApps,
  onLogDrink,
  onLaunchApp,
  onSubmitActivity,
  onOpenRecentTabInWellbeing,
  onSkip,
}: StartupCheckinModalProps) {
  const [activeTab, setActiveTab] = useState<'checkin' | 'recent'>('checkin');
  const [waterAnswered, setWaterAnswered] = useState<'drank' | 'notyet' | null>(null);
  const [activityInput, setActivityInput] = useState('');
  const [launchedKey, setLaunchedKey] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stageRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const isTyping =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable);

      if (e.key === ' ' && !isTyping) {
        e.preventDefault();
        onSkip();
        return;
      }

      if (e.key === 'Enter' && !isTyping) {
        const isClickable = active && (active.tagName === 'BUTTON' || active.tagName === 'A');
        if (!isClickable) {
          e.preventDefault();
          onSkip();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = activityInput.trim();
    if (!trimmed) {
      onSkip();
      return;
    }
    onSubmitActivity(trimmed);
  };

  return (
    <div
      className="startup-checkin-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSkip();
        }
      }}
    >
      <div
        ref={stageRef}
        tabIndex={-1}
        className="startup-checkin-stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSkip();
          }
        }}
      >
        <div className="startup-checkin-robot-wrap">
          <Robot
            emotion={emotion}
            size={122}
            customization={customization}
            onResize={() => {}}
            onClick={onSkip}
          />
        </div>
        <div
          className={`startup-checkin-card emotion-border-${visualEmotion}`}
          role="dialog"
          aria-modal="true"
          aria-label="Luminess Startup Check-In"
        >
        <div className="floating-box-header" style={{ cursor: 'default' }}>
          <div className="floating-box-title">
            <Sparkles size={15} className="text-glow" />
            <span>
              {userName ? `Welcome back, ${userName}` : `${botName || 'Luminess'} Check-In`}
            </span>
          </div>
          <div className="chat-actions">
            <button
              type="button"
              className="floating-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={onSkip}
            >
              <span>Skip</span>
            </button>
            <button type="button" className="icon-btn" onClick={onSkip} title="Skip (Esc / Space)">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="floating-box-tabs">
          <button
            type="button"
            className={`floating-tab-btn ${activeTab === 'checkin' ? 'active' : ''}`}
            onClick={() => setActiveTab('checkin')}
          >
            <Sparkles size={12} />
            <span>Check-In</span>
          </button>
          <button
            type="button"
            className={`floating-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
            onClick={() => setActiveTab('recent')}
          >
            <AppWindow size={12} />
            <span>Recent Apps ({recentApps.length})</span>
          </button>
        </div>

        <div className="floating-box-body" style={{ maxHeight: '62vh' }}>
          {activeTab === 'checkin' ? (
            <>
              {/* Hydration Check-In */}
              <div className="floating-card-item">
                <div className="floating-card-row">
                  <span className="floating-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Droplets size={14} style={{ color: '#38bdf8' }} />
                    <span>Have you drunk any water yet?</span>
                  </span>
                  <span style={{ fontSize: 10.5, color: '#7dd3fc', fontWeight: 600 }}>
                    {drinkDailyGlasses}/{drinkGoalGlasses} today
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={waterAnswered === 'drank' ? 'floating-btn-primary' : 'floating-btn-secondary'}
                    onClick={() => {
                      if (waterAnswered !== 'drank') {
                        onLogDrink();
                      }
                      setWaterAnswered('drank');
                    }}
                  >
                    {waterAnswered === 'drank' ? <Check size={13} /> : <Droplets size={13} />}
                    <span>{waterAnswered === 'drank' ? 'Logged +1 glass!' : 'Yes, I drank water (+1)'}</span>
                  </button>
                  <button
                    type="button"
                    className="floating-btn-secondary"
                    onClick={() => setWaterAnswered('notyet')}
                  >
                    <span>{waterAnswered === 'notyet' ? 'Okay, take a sip soon!' : 'Not yet'}</span>
                  </button>
                </div>
              </div>

              {/* Recent Apps Prompt Switch */}
              <div className="floating-card-item">
                <div className="floating-card-row">
                  <span className="floating-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AppWindow size={14} className="text-glow" />
                    <span>Open any of your {recentApps.length} recent apps?</span>
                  </span>
                  <button
                    type="button"
                    className="floating-btn-secondary"
                    style={{ padding: '4px 9px', fontSize: 11 }}
                    onClick={() => setActiveTab('recent')}
                  >
                    <span>View Recent Tab</span>
                  </button>
                </div>
                {recentApps.length > 0 ? (
                  <div className="floating-pill-grid" style={{ marginTop: 4 }}>
                    {recentApps.slice(0, 5).map((app) => (
                      <button
                        key={app.app_key}
                        type="button"
                        className={`floating-chip ${launchedKey === app.app_key ? 'active' : ''}`}
                        onClick={() => {
                          setLaunchedKey(app.app_key);
                          onLaunchApp(app);
                        }}
                        title={`Launch ${app.display_name}`}
                      >
                        <ExternalLink size={11} />
                        <span>{app.display_name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="floating-card-sub">
                    No desktop app history recorded yet — Luminess tracks your real apps as you work.
                  </div>
                )}
              </div>

              {/* What would you like to do? */}
              <form className="floating-card-item" onSubmit={handleSubmit}>
                <div className="floating-card-title">What would you like to do?</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    type="text"
                    className="floating-input"
                    value={activityInput}
                    onChange={(e) => setActivityInput(e.target.value)}
                    placeholder="Tell me what you're working on today..."
                  />
                  <button type="submit" className="floating-btn-primary">
                    <Send size={13} />
                    <span>Go</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="floating-card-row" style={{ padding: '0 2px' }}>
                <span className="floating-card-sub">
                  Your top <strong>{recentApps.length}</strong> recent desktop applications (system processes hidden).
                </span>
                <button
                  type="button"
                  className="floating-btn-secondary"
                  style={{ padding: '3px 8px', fontSize: 10.5 }}
                  onClick={() => {
                    onSkip();
                    onOpenRecentTabInWellbeing();
                  }}
                >
                  <Activity size={11} />
                  <span>Full Wellbeing</span>
                </button>
              </div>
              <div className="music-track-list">
                {recentApps.length === 0 ? (
                  <div className="floating-card-item">
                    <div className="floating-card-sub">
                      No recent user applications logged yet. Open any desktop program and it will appear here automatically.
                    </div>
                  </div>
                ) : (
                  recentApps.map((app, index) => (
                    <div key={app.app_key} className="music-track-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="floating-card-title" style={{ fontSize: 12.5 }}>
                          {index + 1}. {app.display_name}
                        </div>
                        <div className="floating-card-sub" style={{ fontSize: 10.5 }}>
                          {app.category}
                          {app.total_seconds > 0
                            ? ` • ${formatWellbeingDuration(app.total_seconds)} recorded`
                            : ' • Ready to launch'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="floating-btn-primary"
                        style={{ padding: '5px 10px', fontSize: 11 }}
                        onClick={() => {
                          setLaunchedKey(app.app_key);
                          onLaunchApp(app);
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>{launchedKey === app.app_key ? 'Opening...' : 'Open'}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="floating-box-footer">
          <span>Press Space, Enter, Esc, or click anywhere to skip</span>
          <button
            type="button"
            className="floating-btn-secondary"
            style={{ padding: '3px 9px', fontSize: 10.5 }}
            onClick={onSkip}
          >
            Skip Now
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
