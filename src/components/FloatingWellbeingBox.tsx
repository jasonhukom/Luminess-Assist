import { useState, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import './FloatingBoxes.css';
import {
  Activity,
  AppWindow,
  Clock,
  Cpu,
  ExternalLink,
  Info,
  Maximize2,
  Minimize2,
  Move,
  PieChart,
  Trash2,
  X,
} from 'lucide-react';
import type { VisualEmotion } from './Robot.tsx';
import type { FloatingBoxPosition } from '../lib/memoryAndStorage.ts';
import { BOX_SIZE_CONSTRAINTS } from '../lib/floatingWindows.ts';
import { FloatingBoxResizeHandles } from './FloatingBoxResizeHandles.tsx';
import {
  WELLBEING_RETENTION_DAYS,
  buildWellbeingRangeReport,
  formatWellbeingDuration,
  type RecentRealAppItem,
  type WellbeingHistoryStore,
  type WellbeingRange,
} from '../lib/digitalWellbeing.ts';

type WellbeingTabId = 'wellbeing' | 'recent';
export type { WellbeingTabId };

interface FloatingWellbeingBoxProps {
  position: FloatingBoxPosition;
  onChangePosition: (next: FloatingBoxPosition, isUserResize?: boolean) => void;
  emotion: VisualEmotion;
  initialTab?: WellbeingTabId;
  externalTabSeq?: number;
  initialRange?: WellbeingRange;
  historyStore: WellbeingHistoryStore;
  recentApps: RecentRealAppItem[];
  activeForegroundApp?: string | null;
  onLaunchApp: (app: RecentRealAppItem) => void;
  onClearHistory: () => void;
  onOpenTaskManager?: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
  idleSecondsLeft?: number;
  onActivity?: () => void;
  onClose: () => void;
}

export function FloatingWellbeingBox({
  position,
  onChangePosition,
  emotion,
  initialTab = 'wellbeing',
  externalTabSeq = 0,
  initialRange = 'day',
  historyStore,
  recentApps,
  activeForegroundApp,
  onLaunchApp,
  onClearHistory,
  onOpenTaskManager,
  isCompact = false,
  onToggleCompact,
  idleSecondsLeft,
  onActivity,
  onClose,
}: FloatingWellbeingBoxProps) {
  const [activeTab, setActiveTab] = useState<WellbeingTabId>(initialTab);
  const [prevSeq, setPrevSeq] = useState<number>(externalTabSeq);
  if (externalTabSeq !== prevSeq) {
    setPrevSeq(externalTabSeq);
    setActiveTab(initialTab);
  }

  const [range, setRange] = useState<WellbeingRange>(initialRange);
  const [selectedAppKey, setSelectedAppKey] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: position.x,
    origY: position.y,
  });

  const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, th')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onActivity?.();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    setIsDragging(true);
  };

  const handleHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    onChangePosition({
      ...position,
      x: dragRef.current.origX + dx,
      y: dragRef.current.origY + dy,
    });
  };

  const handleHeaderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const report = useMemo(
    () => buildWellbeingRangeReport(historyStore, range, historyStore.updated_at || undefined),
    [historyStore, range]
  );

  const selectedApp = useMemo(() => {
    if (!selectedAppKey) return null;
    return (
      report.all_apps.find((a) => a.app_key === selectedAppKey) ||
      report.chart_slices.find((a) => a.app_key === selectedAppKey) ||
      null
    );
  }, [report, selectedAppKey]);

  // Precompute donut SVG stroke segments (r = 62 -> circumference ≈ 389.56)
  const circleRadius = 62;
  const circumference = 2 * Math.PI * circleRadius;
  const donutSegments = useMemo(() => {
    const segs: Array<{
      slice: (typeof report.chart_slices)[number];
      dashArray: string;
      dashOffset: number;
    }> = [];
    let offsetAcc = 0;
    for (const slice of report.chart_slices) {
      const span = (slice.percentage / 100) * circumference;
      const length = Math.max(2, span);
      segs.push({
        slice,
        dashArray: `${length} ${Math.max(0, circumference - length)}`,
        dashOffset: -offsetAcc,
      });
      offsetAcc += span;
    }
    return segs;
  }, [report.chart_slices, circumference]);

  const maxDailyBar = useMemo(
    () => Math.max(1, ...report.daily_series.map((d) => d.total_seconds)),
    [report.daily_series]
  );

  const limits = BOX_SIZE_CONSTRAINTS.wellbeing;

  return (
    <div
      className={`floating-ui-box emotion-border-${emotion} ${isDragging ? 'is-dragging' : ''} ${
        isResizing ? 'is-resizing' : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
      }}
      onPointerDownCapture={() => onActivity?.()}
      onKeyDownCapture={() => onActivity?.()}
      onWheelCapture={() => onActivity?.()}
    >
      <FloatingBoxResizeHandles
        position={position}
        minWidth={limits.minWidth}
        minHeight={limits.minHeight}
        maxWidth={limits.maxWidth}
        maxHeight={limits.maxHeight}
        onChangePosition={onChangePosition}
        onResizingChange={setIsResizing}
        onActivity={onActivity}
      />

      <div
        className="floating-box-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        title="Drag anywhere on screen • Smart-avoids Chat, Companion & other boxes"
      >
        <div className="floating-box-title">
          <Activity size={16} className="text-glow" />
          <span>Digital Wellbeing</span>
          <span className="floating-avoid-pill" title="Follows Companion & avoids collisions">
            <Move size={10} />
            <span>Smart</span>
          </span>
          {idleSecondsLeft !== undefined && idleSecondsLeft <= 45 && (
            <span
              className={`floating-idle-pill ${idleSecondsLeft <= 15 ? 'urgent' : ''}`}
              title="Auto-closes if untouched"
            >
              {idleSecondsLeft}s
            </span>
          )}
        </div>
        <div className="chat-actions">
          {onOpenTaskManager && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                onActivity?.();
                onOpenTaskManager();
              }}
              title="Open standalone Task Manager"
            >
              <Cpu size={13} />
            </button>
          )}
          {onToggleCompact && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                onActivity?.();
                onToggleCompact();
              }}
              title={isCompact ? 'Expand box' : 'Compact box'}
            >
              {isCompact ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              onActivity?.();
              if (window.confirm('Clear stored app usage wellbeing history?')) {
                onClearHistory();
                setSelectedAppKey(null);
              }
            }}
            title="Clear recorded usage data"
          >
            <Trash2 size={13} />
          </button>
          <button type="button" className="icon-btn" onClick={onClose} title="Close Digital Wellbeing">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Box Tabs */}
      <div className="floating-box-tabs">
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'wellbeing' ? 'active' : ''}`}
          onClick={() => setActiveTab('wellbeing')}
        >
          <PieChart size={13} />
          <span>Circle View</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          <AppWindow size={13} />
          <span>Recent Apps ({recentApps.length})</span>
        </button>
      </div>

      <div className="floating-box-body">
        {activeTab === 'wellbeing' ? (
          <>
            {/* Range Selector & Retention Indicator */}
            <div className="floating-card-row" style={{ flexWrap: 'wrap' }}>
              <div className="floating-pill-grid">
                {(
                  [
                    { id: 'day', label: 'Today' },
                    { id: 'week', label: 'Week (7d)' },
                    { id: 'month', label: 'Month (30d)' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`floating-chip ${range === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setRange(item.id);
                      setSelectedAppKey(null);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span
                className="floating-avoid-pill"
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  borderColor: 'rgba(52, 211, 153, 0.35)',
                  color: '#6ee7b7',
                }}
                title="Data older than 90 days (3 months) is automatically purged"
              >
                <Clock size={10} />
                <span>{WELLBEING_RETENTION_DAYS}d (3mo) auto-clean</span>
              </span>
            </div>

            {/* Circle Chart + Top Slices Legend */}
            <div className="wellbeing-circle-layout">
              <div className="wellbeing-donut-wrap">
                <svg viewBox="0 0 160 160" width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="80"
                    cy="80"
                    r={circleRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="22"
                  />
                  {donutSegments.map(({ slice, dashArray, dashOffset }) => {
                    const isFocused = selectedAppKey === slice.app_key;
                    return (
                      <circle
                        key={slice.app_key}
                        cx="80"
                        cy="80"
                        r={circleRadius}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={isFocused ? 26 : 22}
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="butt"
                        style={{
                          cursor: 'pointer',
                          opacity: selectedAppKey && !isFocused ? 0.45 : 1,
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() =>
                          setSelectedAppKey((cur) => (cur === slice.app_key ? null : slice.app_key))
                        }
                      >
                        <title>
                          {slice.display_name}: {formatWellbeingDuration(slice.seconds)} (
                          {slice.percentage.toFixed(1)}%)
                        </title>
                      </circle>
                    );
                  })}
                </svg>
                <div className="wellbeing-donut-center">
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', lineHeight: 1.1 }}>
                    {selectedApp
                      ? formatWellbeingDuration(selectedApp.seconds)
                      : formatWellbeingDuration(report.total_seconds)}
                  </span>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>
                    {selectedApp
                      ? `${selectedApp.percentage.toFixed(0)}% • ${selectedApp.display_name}`
                      : report.range_label.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="wellbeing-legend-list">
                {report.chart_slices.length === 0 ? (
                  <div className="floating-card-sub">
                    Sampling your active foreground window every 5 seconds in the background...
                    {activeForegroundApp ? (
                      <div style={{ marginTop: 4, color: '#7dd3fc' }}>
                        Now tracking: <strong>{activeForegroundApp}</strong>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  report.chart_slices.map((slice) => (
                    <button
                      key={slice.app_key}
                      type="button"
                      className={`wellbeing-legend-item ${
                        selectedAppKey === slice.app_key ? 'active' : ''
                      }`}
                      onClick={() =>
                        setSelectedAppKey((cur) => (cur === slice.app_key ? null : slice.app_key))
                      }
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 99,
                            background: slice.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                          }}
                        >
                          {slice.display_name}
                        </span>
                      </span>
                      <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {formatWellbeingDuration(slice.seconds)} ({slice.percentage.toFixed(0)}%)
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* App & Category Explaining Card */}
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={13} className="text-glow" />
                  <span>
                    {selectedApp
                      ? `Explaining: ${selectedApp.display_name} (${selectedApp.category})`
                      : `Explaining Your ${report.range_label} Screen Time`}
                  </span>
                </span>
                {selectedApp && (
                  <button
                    type="button"
                    className="floating-btn-secondary"
                    style={{ padding: '2px 7px', fontSize: 10 }}
                    onClick={() => setSelectedAppKey(null)}
                  >
                    Overview
                  </button>
                )}
              </div>
              <div className="floating-card-sub" style={{ color: '#e2e8f0', lineHeight: 1.5 }}>
                {selectedApp ? selectedApp.explanation : report.overall_explanation}
              </div>
              {selectedApp?.last_title && (
                <div className="floating-card-sub" style={{ fontSize: 10 }}>
                  Last window: <code>{selectedApp.last_title}</code>
                </div>
              )}
              {report.category_totals.length > 0 && (
                <div className="floating-pill-grid" style={{ marginTop: 4 }}>
                  {report.category_totals.slice(0, 4).map((cat) => (
                    <span
                      key={cat.category}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 7px',
                        borderRadius: 99,
                        fontSize: 10,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        color: '#cbd5e1',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: cat.color,
                        }}
                      />
                      <span>
                        {cat.category} {cat.percentage.toFixed(0)}%
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Week / Month Daily Timeline Strip */}
            {range !== 'day' && (
              <div className="floating-card-item">
                <div className="floating-card-row">
                  <span className="floating-card-title">
                    {range === 'week' ? '7-Day Daily Breakdown' : '30-Day Activity Trend'}
                  </span>
                  <span className="floating-card-sub">
                    Avg active day: {formatWellbeingDuration(report.daily_average_seconds)}
                  </span>
                </div>
                <div className="wellbeing-bar-strip">
                  {report.daily_series.map((pt) => {
                    const pct = Math.max(4, Math.round((pt.total_seconds / maxDailyBar) * 100));
                    return (
                      <div
                        key={pt.date}
                        className="wellbeing-bar-col"
                        title={`${pt.date}: ${formatWellbeingDuration(pt.total_seconds)}`}
                      >
                        <div
                          className="wellbeing-bar-fill"
                          style={{
                            height: pt.total_seconds > 0 ? `${pct}%` : '4%',
                            opacity: pt.total_seconds > 0 ? 1 : 0.2,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Complete Ranked App Breakdown */}
            {report.all_apps.length > 0 && (
              <div className="music-track-list">
                {report.all_apps.map((app) => (
                  <button
                    key={app.app_key}
                    type="button"
                    className={`music-track-row ${selectedAppKey === app.app_key ? 'active' : ''}`}
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() =>
                      setSelectedAppKey((cur) => (cur === app.app_key ? null : app.app_key))
                    }
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="floating-card-title" style={{ fontSize: 12 }}>
                        {app.display_name}
                      </div>
                      <div className="floating-card-sub" style={{ fontSize: 10 }}>
                        {app.category}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#f1f5f9' }}>
                        {formatWellbeingDuration(app.seconds)}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {app.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="floating-card-item">
              <div className="floating-card-row">
                <span className="floating-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AppWindow size={14} className="text-glow" />
                  <span>Top 5 Recent Real Applications</span>
                </span>
                <span style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 600 }}>
                  System Processes Filtered Out
                </span>
              </div>
              <div className="floating-card-sub">
                Quickly relaunch your most recently used desktop programs (excludes background/Windows system hosts).
              </div>
            </div>
            <div className="music-track-list">
              {recentApps.length === 0 ? (
                <div className="floating-card-item">
                  <div className="floating-card-sub">
                    No desktop app activity tracked yet — keep working in your favorite apps and they will appear here automatically.
                  </div>
                </div>
              ) : (
                recentApps.map((app, idx) => (
                  <div key={app.app_key} className="music-track-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="floating-card-title" style={{ fontSize: 12.5 }}>
                        {idx + 1}. {app.display_name}
                      </div>
                      <div className="floating-card-sub" style={{ fontSize: 10.5 }}>
                        {app.category}
                        {app.total_seconds > 0
                          ? ` • ${formatWellbeingDuration(app.total_seconds)} tracked`
                          : ' • Launchable desktop app'}
                      </div>
                      {app.window_title && (
                        <div
                          className="floating-card-sub"
                          style={{
                            fontSize: 9.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {app.window_title}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="floating-btn-primary"
                      style={{ padding: '5px 10px', fontSize: 11, flexShrink: 0 }}
                      onClick={() => onLaunchApp(app)}
                    >
                      <ExternalLink size={12} />
                      <span>Open</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="floating-box-footer">
        <span>Auto-tracks active apps • Deletes history &gt; {WELLBEING_RETENTION_DAYS} days</span>
        <span>{activeForegroundApp ? `Active: ${activeForegroundApp}` : 'Local & Private'}</span>
      </div>
    </div>
  );
}
