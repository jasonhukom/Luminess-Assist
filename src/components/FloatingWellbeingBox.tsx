import { useState, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import './FloatingBoxes.css';
import {
  Activity,
  AppWindow,
  ArrowDown,
  ArrowUp,
  Clock,
  Cpu,
  ExternalLink,
  Info,
  Layers,
  Move,
  Pause,
  PieChart,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { VisualEmotion } from './Robot.tsx';
import type { FloatingBoxPosition } from '../lib/memoryAndStorage.ts';
import {
  WELLBEING_RETENTION_DAYS,
  buildWellbeingRangeReport,
  formatBytesMem,
  formatWellbeingDuration,
  type RecentRealAppItem,
  type TaskManagerSnapshot,
  type WellbeingHistoryStore,
  type WellbeingRange,
} from '../lib/digitalWellbeing.ts';

type WellbeingTabId = 'wellbeing' | 'recent' | 'taskmanager';
export type { WellbeingTabId };
type ProcessFilter = 'all' | 'app' | 'background';
type SortColumn = 'name' | 'status' | 'cpu' | 'memory' | 'pid';

function SortArrow({
  col,
  activeCol,
  sortDesc,
}: {
  col: SortColumn;
  activeCol: SortColumn;
  sortDesc: boolean;
}) {
  if (activeCol !== col) return null;
  return sortDesc ? (
    <ArrowDown size={10} style={{ display: 'inline', marginLeft: 2 }} />
  ) : (
    <ArrowUp size={10} style={{ display: 'inline', marginLeft: 2 }} />
  );
}

interface FloatingWellbeingBoxProps {
  position: FloatingBoxPosition;
  onChangePosition: (next: FloatingBoxPosition) => void;
  emotion: VisualEmotion;
  initialTab?: WellbeingTabId;
  externalTabSeq?: number;
  initialRange?: WellbeingRange;
  historyStore: WellbeingHistoryStore;
  recentApps: RecentRealAppItem[];
  activeForegroundApp?: string | null;
  taskSnapshot: TaskManagerSnapshot | null;
  isPollingTasks: boolean;
  onTogglePollingTasks: () => void;
  onRefreshTasksNow: () => void;
  onLaunchApp: (app: RecentRealAppItem) => void;
  onClearHistory: () => void;
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
  taskSnapshot,
  isPollingTasks,
  onTogglePollingTasks,
  onRefreshTasksNow,
  onLaunchApp,
  onClearHistory,
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
  const [processFilter, setProcessFilter] = useState<ProcessFilter>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [sortCol, setSortCol] = useState<SortColumn>('cpu');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleSortClick = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDesc((prev) => !prev);
    } else {
      setSortCol(col);
      setSortDesc(col === 'cpu' || col === 'memory');
    }
  };

  const filteredProcesses = useMemo(() => {
    const raw = taskSnapshot?.processes || [];
    const q = taskSearch.trim().toLowerCase();
    const narrowed = raw.filter((row) => {
      if (processFilter === 'app' && row.category !== 'app') return false;
      if (processFilter === 'background' && row.category !== 'background') return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.exe_name.toLowerCase().includes(q) ||
        row.window_title.toLowerCase().includes(q) ||
        String(row.pid).includes(q)
      );
    });

    const sorted = [...narrowed];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name') cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      else if (sortCol === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortCol === 'cpu') cmp = a.cpu_percent - b.cpu_percent;
      else if (sortCol === 'memory') cmp = a.memory_bytes - b.memory_bytes;
      else if (sortCol === 'pid') cmp = a.pid - b.pid;
      return sortDesc ? -cmp : cmp;
    });
    return sorted.slice(0, 140);
  }, [taskSnapshot, processFilter, taskSearch, sortCol, sortDesc]);

  const cpuCellClass = (pct: number) =>
    pct >= 15 ? 'taskmgr-heat-high' : pct >= 3 ? 'taskmgr-heat-med' : pct >= 0.3 ? 'taskmgr-heat-low' : '';

  const memCellClass = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 650 ? 'taskmgr-heat-high' : mb >= 220 ? 'taskmgr-heat-med' : mb >= 80 ? 'taskmgr-heat-low' : '';
  };

  return (
    <div
      className={`floating-ui-box emotion-border-${emotion} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
      }}
    >
      <div
        className="floating-box-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        title="Drag anywhere on screen • Auto-dodges Chatbox & Companion"
      >
        <div className="floating-box-title">
          <Activity size={16} className="text-glow" />
          <span>Digital Wellbeing & Tasks</span>
          <span className="floating-avoid-pill" title="Moves away automatically if touching Chatbox">
            <Move size={10} />
            <span>Auto-Dodge</span>
          </span>
        </div>
        <div className="chat-actions">
          {activeTab === 'taskmanager' ? (
            <>
              <button
                type="button"
                className={`icon-btn ${isPollingTasks ? 'active' : ''}`}
                onClick={onTogglePollingTasks}
                title={isPollingTasks ? 'Pause live refresh' : 'Resume live refresh'}
              >
                {isPollingTasks ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={onRefreshTasksNow}
                title="Refresh snapshot now"
              >
                <RefreshCw size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                if (window.confirm('Clear stored app usage wellbeing history?')) {
                  onClearHistory();
                  setSelectedAppKey(null);
                }
              }}
              title="Clear recorded usage data"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} title="Close Wellbeing & Tasks">
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
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'taskmanager' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('taskmanager');
            onRefreshTasksNow();
          }}
        >
          <Cpu size={13} />
          <span>Task Manager</span>
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
        ) : activeTab === 'recent' ? (
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
        ) : (
          <>
            {/* Task Manager Read-Only Banner */}
            <div
              className="floating-card-row"
              style={{
                padding: '6px 10px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6ee7b7', fontWeight: 600 }}>
                <ShieldCheck size={13} />
                <span>Read-Only Windows Task Manager Viewer (cannot end/kill tasks)</span>
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                {isPollingTasks ? 'Live 2s' : 'Paused'}
              </span>
            </div>

            {/* Performance KPI Grid */}
            <div className="taskmgr-kpi-grid">
              <div className="taskmgr-kpi-card">
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>CPU</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}>
                  {taskSnapshot ? `${taskSnapshot.total_cpu_percent.toFixed(1)}%` : '--'}
                </span>
                <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                  {taskSnapshot ? `${taskSnapshot.logical_cores} logical CPUs` : ''}
                </span>
              </div>
              <div className="taskmgr-kpi-card">
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>MEMORY</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#818cf8' }}>
                  {taskSnapshot ? `${taskSnapshot.memory_load_percent}%` : '--'}
                </span>
                <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                  {taskSnapshot
                    ? `${formatBytesMem(taskSnapshot.used_memory_bytes)} / ${formatBytesMem(
                        taskSnapshot.total_memory_bytes
                      )}`
                    : ''}
                </span>
              </div>
              <div className="taskmgr-kpi-card">
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>APPS</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#34d399' }}>
                  {taskSnapshot ? taskSnapshot.app_count : '--'}
                </span>
                <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                  {taskSnapshot ? `${taskSnapshot.background_count} background` : ''}
                </span>
              </div>
              <div className="taskmgr-kpi-card">
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>PROCESSES</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#f472b6' }}>
                  {taskSnapshot ? taskSnapshot.process_count : '--'}
                </span>
                <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                  {taskSnapshot ? `${taskSnapshot.total_threads} threads` : ''}
                </span>
              </div>
            </div>

            {/* Process Filters + Search */}
            <div className="floating-card-row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <div className="floating-pill-grid">
                <button
                  type="button"
                  className={`floating-chip ${processFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setProcessFilter('all')}
                >
                  All ({taskSnapshot?.process_count ?? 0})
                </button>
                <button
                  type="button"
                  className={`floating-chip ${processFilter === 'app' ? 'active' : ''}`}
                  onClick={() => setProcessFilter('app')}
                >
                  <Layers size={11} />
                  <span>Apps ({taskSnapshot?.app_count ?? 0})</span>
                </button>
                <button
                  type="button"
                  className={`floating-chip ${processFilter === 'background' ? 'active' : ''}`}
                  onClick={() => setProcessFilter('background')}
                >
                  Background ({taskSnapshot?.background_count ?? 0})
                </button>
              </div>
            </div>

            <div className="floating-box-search" style={{ margin: 0 }}>
              <Search size={13} className="text-muted" />
              <input
                type="text"
                placeholder="Search process name, window title, or PID..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>

            {/* Task Manager Process Table */}
            <div className="taskmgr-table-wrap">
              <table className="taskmgr-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSortClick('name')}>
                      Name <SortArrow col="name" activeCol={sortCol} sortDesc={sortDesc} />
                    </th>
                    <th onClick={() => handleSortClick('status')}>
                      Status <SortArrow col="status" activeCol={sortCol} sortDesc={sortDesc} />
                    </th>
                    <th onClick={() => handleSortClick('cpu')} style={{ textAlign: 'right' }}>
                      CPU <SortArrow col="cpu" activeCol={sortCol} sortDesc={sortDesc} />
                    </th>
                    <th onClick={() => handleSortClick('memory')} style={{ textAlign: 'right' }}>
                      Memory <SortArrow col="memory" activeCol={sortCol} sortDesc={sortDesc} />
                    </th>
                    <th onClick={() => handleSortClick('pid')} style={{ textAlign: 'right' }}>
                      PID <SortArrow col="pid" activeCol={sortCol} sortDesc={sortDesc} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcesses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 18, color: '#94a3b8' }}>
                        {taskSnapshot
                          ? 'No matching processes.'
                          : 'Waiting for Windows Task Manager process snapshot...'}
                      </td>
                    </tr>
                  ) : (
                    filteredProcesses.map((proc) => (
                      <tr key={proc.pid}>
                        <td style={{ maxWidth: 195 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#f8fafc',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={`${proc.exe_name}${proc.window_title ? ` — ${proc.window_title}` : ''}`}
                          >
                            {proc.name}
                          </div>
                          {proc.window_title && (
                            <div
                              style={{
                                fontSize: 9.5,
                                color: '#94a3b8',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {proc.window_title}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              padding: '1.5px 6px',
                              borderRadius: 6,
                              background:
                                proc.status === 'Foreground'
                                  ? 'rgba(56, 189, 248, 0.18)'
                                  : proc.status === 'Active'
                                    ? 'rgba(52, 211, 153, 0.14)'
                                    : 'rgba(255,255,255,0.06)',
                              color:
                                proc.status === 'Foreground'
                                  ? '#7dd3fc'
                                  : proc.status === 'Active'
                                    ? '#6ee7b7'
                                    : '#94a3b8',
                            }}
                          >
                            {proc.status}
                          </span>
                        </td>
                        <td className={cpuCellClass(proc.cpu_percent)} style={{ textAlign: 'right' }}>
                          {proc.cpu_percent.toFixed(1)}%
                        </td>
                        <td className={memCellClass(proc.memory_bytes)} style={{ textAlign: 'right' }}>
                          {formatBytesMem(proc.memory_bytes)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>{proc.pid}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="floating-box-footer">
        <span>
          {activeTab === 'wellbeing'
            ? `Auto-tracks active apps • Deletes history > ${WELLBEING_RETENTION_DAYS} days`
            : 'Read-only live process telemetry (End Task disabled by design)'}
        </span>
        <span>
          {taskSnapshot && activeTab === 'taskmanager'
            ? `Up ${formatWellbeingDuration(taskSnapshot.uptime_seconds)}`
            : activeForegroundApp
              ? `Active: ${activeForegroundApp}`
              : 'Local & Private'}
        </span>
      </div>
    </div>
  );
}
