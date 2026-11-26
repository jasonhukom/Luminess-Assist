import { useState, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import './FloatingBoxes.css';
import {
  ArrowDown,
  ArrowUp,
  Cpu,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { VisualEmotion } from './Robot.tsx';
import type { FloatingBoxPosition } from '../lib/memoryAndStorage.ts';
import { BOX_SIZE_CONSTRAINTS } from '../lib/floatingWindows.ts';
import { FloatingBoxResizeHandles } from './FloatingBoxResizeHandles.tsx';
import {
  formatBytesMem,
  formatWellbeingDuration,
  type TaskManagerSnapshot,
} from '../lib/digitalWellbeing.ts';

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

interface FloatingTaskManagerBoxProps {
  position: FloatingBoxPosition;
  onChangePosition: (next: FloatingBoxPosition, isUserResize?: boolean) => void;
  emotion: VisualEmotion;
  taskSnapshot: TaskManagerSnapshot | null;
  isPollingTasks: boolean;
  onTogglePollingTasks: () => void;
  onRefreshTasksNow: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
  idleSecondsLeft?: number;
  onActivity?: () => void;
  onClose: () => void;
}

export function FloatingTaskManagerBox({
  position,
  onChangePosition,
  emotion,
  taskSnapshot,
  isPollingTasks,
  onTogglePollingTasks,
  onRefreshTasksNow,
  isCompact = false,
  onToggleCompact,
  idleSecondsLeft,
  onActivity,
  onClose,
}: FloatingTaskManagerBoxProps) {
  const [processFilter, setProcessFilter] = useState<ProcessFilter>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [sortCol, setSortCol] = useState<SortColumn>('cpu');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
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

  const handleSortClick = (col: SortColumn) => {
    onActivity?.();
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

  const limits = BOX_SIZE_CONSTRAINTS.taskmanager;

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
          <Cpu size={16} className="text-glow" />
          <span>Task Manager</span>
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
            className={`icon-btn ${isPollingTasks ? 'active' : ''}`}
            onClick={() => {
              onActivity?.();
              onTogglePollingTasks();
            }}
            title={isPollingTasks ? 'Pause live refresh' : 'Resume live refresh'}
          >
            {isPollingTasks ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              onActivity?.();
              onRefreshTasksNow();
            }}
            title="Refresh snapshot now"
          >
            <RefreshCw size={13} />
          </button>
          <button type="button" className="icon-btn" onClick={onClose} title="Close Task Manager">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="floating-box-body">
        <div
          className="floating-card-row"
          style={{
            padding: '6px 10px',
            borderRadius: 10,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#6ee7b7',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={13} />
            <span>Read-Only Windows Task Manager (cannot end/kill tasks)</span>
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {isPollingTasks ? 'Live 2s' : 'Paused'}
          </span>
        </div>

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
      </div>

      <div className="floating-box-footer">
        <span>Read-only live process telemetry (End Task disabled by design)</span>
        <span>
          {taskSnapshot ? `Up ${formatWellbeingDuration(taskSnapshot.uptime_seconds)}` : 'Monitoring'}
        </span>
      </div>
    </div>
  );
}
