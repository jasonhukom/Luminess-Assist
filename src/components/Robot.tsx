import { useState, useRef, useEffect } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import './Robot.css';
import { invoke } from '@tauri-apps/api/core';

export type Emotion = 
  | 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' 
  | 'disgust' | 'curiosity' | 'confusion' | 'love' 
  | 'embarrassment' | 'idle';

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  monitor_x: number;
  monitor_y: number;
  monitor_width: number;
  monitor_height: number;
  scale_factor: number;
}

interface RobotProps {
  emotion: Emotion;
  size: number;
  onResize: (newSize: number) => void;
  onClick: () => void;
  onEmotionChange?: (emotion: Emotion) => void;
}

const EMOTION_PATHS: Record<Emotion, { left: string; right: string; mouth?: string }> = {
  idle: {
    left: 'M 65 95 C 65 90, 85 90, 85 95 C 85 100, 65 100, 65 95',
    right: 'M 115 95 C 115 90, 135 90, 135 95 C 135 100, 115 100, 115 95',
  },
  joy: {
    left: 'M 60 100 Q 75 75 90 100 Q 75 85 60 100',
    right: 'M 110 100 Q 125 75 140 100 Q 125 85 110 100',
  },
  sadness: {
    left: 'M 65 105 Q 75 90 90 95 Q 75 100 65 105',
    right: 'M 110 95 Q 125 90 135 105 Q 125 100 110 95',
  },
  anger: {
    left: 'M 65 85 L 90 100 L 85 105 L 60 90 Z',
    right: 'M 110 100 L 135 85 L 140 90 L 115 105 Z',
  },
  fear: {
    left: 'M 60 95 A 15 15 0 1 1 90 95 A 15 15 0 1 1 60 95',
    right: 'M 110 95 A 15 15 0 1 1 140 95 A 15 15 0 1 1 110 95',
  },
  surprise: {
    left: 'M 60 95 A 15 15 0 1 1 90 95 A 15 15 0 1 1 60 95',
    right: 'M 110 95 A 15 15 0 1 1 140 95 A 15 15 0 1 1 110 95',
  },
  disgust: {
    left: 'M 60 90 Q 75 85 90 95 Q 75 95 60 90',
    right: 'M 110 95 Q 125 85 140 90 Q 125 95 110 95',
    mouth: 'M 90 115 Q 100 110 110 115',
  },
  curiosity: {
    left: 'M 65 95 C 65 85, 85 85, 85 95 C 85 105, 65 105, 65 95',
    right: 'M 115 95 C 115 90, 135 90, 135 95 C 135 100, 115 100, 115 95',
  },
  confusion: {
    left: 'M 65 85 L 85 85 L 85 105 L 65 105 Z',
    right: 'M 115 95 C 115 85, 135 85, 135 95 C 135 105, 115 105, 115 95',
    mouth: 'M 90 115 L 110 115',
  },
  love: {
    left: 'M 75 105 C 65 105, 60 95, 65 85 C 75 75, 85 95, 75 105',
    right: 'M 125 105 C 115 105, 110 95, 115 85 C 125 75, 135 95, 125 105',
  },
  embarrassment: {
    left: 'M 70 100 C 70 95, 80 95, 80 100 C 80 105, 70 105, 70 100',
    right: 'M 120 100 C 120 95, 130 95, 130 100 C 130 105, 120 105, 120 100',
  },
};

export function Robot({ emotion, size, onResize, onClick, onEmotionChange }: RobotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [tilt, setTilt] = useState<{ deg: number; scaleX: number; scaleY: number }>({ deg: 0, scaleX: 1, scaleY: 1 });

  const rafRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    hasMoved: boolean;
    resizing: boolean;
    startScreenX: number;
    startScreenY: number;
    startWinX: number;
    startWinY: number;
    startSize: number;
    bounds: WindowBounds | null;
    samples: Array<{ x: number; y: number; t: number }>;
    pendingPos: { x: number; y: number } | null;
    updatingWindow: boolean;
  }>({
    active: false,
    hasMoved: false,
    resizing: false,
    startScreenX: 0,
    startScreenY: 0,
    startWinX: 0,
    startWinY: 0,
    startSize: size,
    bounds: null,
    samples: [],
    pendingPos: null,
    updatingWindow: false,
  });

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const stopPhysics = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsFlying(false);
    setIsReturning(false);
    setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
  };

  const computeSafeWindowRange = (bounds: WindowBounds) => {
    const dpr = bounds.scale_factor || window.devicePixelRatio || 1;
    const rect = containerRef.current?.getBoundingClientRect();

    const offsetLeft = rect ? rect.left * dpr : bounds.width - size * dpr - 20 * dpr;
    const offsetTop = rect ? rect.top * dpr : bounds.height - size * dpr - 20 * dpr;
    const botW = rect ? rect.width * dpr : size * dpr;
    const botH = rect ? rect.height * dpr : size * dpr;

    const margin = Math.round(24 * dpr);
    const taskbarMargin = Math.round(56 * dpr);

    const minRobotX = bounds.monitor_x + margin;
    const maxRobotX = bounds.monitor_x + bounds.monitor_width - botW - margin;
    const minRobotY = bounds.monitor_y + margin;
    const maxRobotY = bounds.monitor_y + bounds.monitor_height - botH - taskbarMargin;

    return {
      minWinX: minRobotX - offsetLeft,
      maxWinX: Math.max(minRobotX - offsetLeft, maxRobotX - offsetLeft),
      minWinY: minRobotY - offsetTop,
      maxWinY: Math.max(minRobotY - offsetTop, maxRobotY - offsetTop),
    };
  };

  const handlePointerDown = async (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const isResizeHandle = Boolean(target.closest('.robot-resize-handle'));

    stopPhysics();
    e.currentTarget.setPointerCapture(e.pointerId);

    const screenX = e.screenX;
    const screenY = e.screenY;

    dragStateRef.current.active = true;
    dragStateRef.current.hasMoved = false;
    dragStateRef.current.resizing = isResizeHandle;
    dragStateRef.current.startScreenX = screenX;
    dragStateRef.current.startScreenY = screenY;
    dragStateRef.current.startSize = size;

    try {
      const bounds = await invoke<WindowBounds>('get_window_bounds');
      dragStateRef.current.bounds = bounds;
      dragStateRef.current.startWinX = bounds.x;
      dragStateRef.current.startWinY = bounds.y;
      dragStateRef.current.samples = [{ x: bounds.x, y: bounds.y, t: performance.now() }];
    } catch {
      dragStateRef.current.bounds = null;
    }
  };

  const flushWindowMove = async () => {
    const st = dragStateRef.current;
    if (st.updatingWindow || !st.pendingPos) return;
    st.updatingWindow = true;
    while (st.pendingPos) {
      const next = st.pendingPos;
      st.pendingPos = null;
      try {
        await invoke('set_window_pos', { x: Math.round(next.x), y: Math.round(next.y) });
      } catch {
        break;
      }
    }
    st.updatingWindow = false;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;

    const dxCss = e.screenX - st.startScreenX;
    const dyCss = e.screenY - st.startScreenY;

    if (st.resizing) {
      st.hasMoved = true;
      const delta = Math.round((-dxCss - dyCss) * 0.6);
      const nextSize = Math.max(100, Math.min(340, st.startSize + delta));
      onResize(nextSize);
      return;
    }

    if (!st.hasMoved && Math.hypot(dxCss, dyCss) > 4) {
      st.hasMoved = true;
      setIsDragging(true);
    }

    if (st.hasMoved && st.bounds) {
      const dpr = st.bounds.scale_factor || window.devicePixelRatio || 1;
      const newX = st.startWinX + Math.round(dxCss * dpr);
      const newY = st.startWinY + Math.round(dyCss * dpr);

      const now = performance.now();
      st.samples.push({ x: newX, y: newY, t: now });
      while (st.samples.length > 1 && now - st.samples[0].t > 120) {
        st.samples.shift();
      }

      // Compute instantaneous drag velocity for subtle tilt while dragging
      const oldest = st.samples[0];
      const dt = Math.max(16, now - oldest.t);
      const vxDrag = ((newX - oldest.x) / dt) * 16.67;
      setTilt({
        deg: Math.max(-22, Math.min(22, vxDrag * 0.45)),
        scaleX: 1,
        scaleY: 1,
      });

      st.pendingPos = { x: newX, y: newY };
      void flushWindowMove();
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;
    st.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (st.resizing) {
      st.resizing = false;
      return;
    }

    setIsDragging(false);

    if (!st.hasMoved) {
      setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
      onClick();
      return;
    }

    const bounds = st.bounds;
    if (!bounds) {
      setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
      return;
    }

    const now = performance.now();
    const samples = st.samples;
    const latest = samples[samples.length - 1] || { x: st.startWinX, y: st.startWinY, t: now };
    const oldest = samples[0] || latest;
    const dt = now - oldest.t;

    let vx = 0;
    let vy = 0;
    if (dt >= 8 && now - latest.t < 140) {
      vx = ((latest.x - oldest.x) / dt) * 16.67;
      vy = ((latest.y - oldest.y) / dt) * 16.67;
      // Clamp maximum throw speed
      const maxSpeed = 95;
      const speed = Math.hypot(vx, vy);
      if (speed > maxSpeed) {
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
      }
    }

    let posX = latest.x;
    let posY = latest.y;

    const safeRange = computeSafeWindowRange(bounds);
    const initialClampedX = Math.max(safeRange.minWinX, Math.min(safeRange.maxWinX, posX));
    const initialClampedY = Math.max(safeRange.minWinY, Math.min(safeRange.maxWinY, posY));
    const isInitiallyOut = Math.hypot(posX - initialClampedX, posY - initialClampedY) > 2;
    const throwSpeed = Math.hypot(vx, vy);

    if (throwSpeed > 3.5 || isInitiallyOut) {
      setIsFlying(true);
      if (throwSpeed > 14) {
        onEmotionChange?.('surprise');
      }

      const stepPhysics = () => {
        posX += vx;
        posY += vy;

        // Air resistance
        vx *= 0.945;
        vy *= 0.945;

        const clampedX = Math.max(safeRange.minWinX, Math.min(safeRange.maxWinX, posX));
        const clampedY = Math.max(safeRange.minWinY, Math.min(safeRange.maxWinY, posY));
        const distOut = Math.hypot(posX - clampedX, posY - clampedY);

        if (distOut > 1) {
          setIsReturning(true);
          // Spring pull back onto the screen so it never goes out of reach
          const springK = 0.14;
          vx += (clampedX - posX) * springK;
          vy += (clampedY - posY) * springK;
          vx *= 0.80;
          vy *= 0.80;
        } else {
          setIsReturning(false);
        }

        const speed = Math.hypot(vx, vy);
        const deg = Math.max(-28, Math.min(28, vx * 0.65));
        const stretch = Math.min(0.12, speed * 0.0025);
        setTilt({
          deg,
          scaleX: 1 + stretch * 0.5,
          scaleY: 1 - stretch * 0.5,
        });

        void invoke('set_window_pos', {
          x: Math.round(posX),
          y: Math.round(posY),
        });

        if (speed < 0.45 && distOut < 1.5) {
          void invoke('set_window_pos', {
            x: Math.round(clampedX),
            y: Math.round(clampedY),
          });
          setIsFlying(false);
          setIsReturning(false);
          setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
          if (throwSpeed > 14) {
            onEmotionChange?.('joy');
          }
          rafRef.current = null;
          return;
        }

        rafRef.current = requestAnimationFrame(stepPhysics);
      };

      rafRef.current = requestAnimationFrame(stepPhysics);
    } else {
      setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
    }
  };

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    // Allow resizing the robot smoothly with scroll wheel
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 12 : -12;
    const next = Math.max(100, Math.min(340, size + delta));
    if (next !== size) {
      onResize(next);
    }
  };

  const paths = EMOTION_PATHS[emotion] || EMOTION_PATHS.idle;

  return (
    <div
      ref={containerRef}
      className={`robot-container emotion-${emotion} ${isDragging ? 'is-dragging' : ''} ${isFlying ? 'is-flying' : ''} ${isReturning ? 'is-returning' : ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${tilt.deg}deg) scale(${tilt.scaleX}, ${tilt.scaleY})`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      title="Click to chat • Drag & flick to throw • Scroll or drag corner to resize"
    >
      {/* Multi-layered dynamic glow aura */}
      <div className="robot-glow-outer"></div>
      <div className="robot-glow-bg"></div>
      <div className="robot-glow-core"></div>

      {/* Resize corner handle to make robot border big or small */}
      <div
        className="robot-resize-handle"
        title="Drag to make bot bigger or smaller (or scroll wheel)"
      />

      {isReturning && (
        <div className="robot-status-pill">Boomerang Return!</div>
      )}

      <svg className="robot-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="screen-glare" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          <linearGradient id="head-shell" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#26273b" />
            <stop offset="100%" stopColor="#141522" />
          </linearGradient>

          <filter id="neon-eye-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="antenna-bloom" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Antenna */}
        <rect x="95" y="12" width="10" height="36" rx="5" className="robot-antenna-stem" />
        <circle cx="100" cy="12" r="10" className="robot-antenna-bulb" filter="url(#antenna-bloom)" />

        {/* Ear panels */}
        <rect x="24" y="80" width="20" height="40" rx="10" className="robot-ear" />
        <rect x="156" y="80" width="20" height="40" rx="10" className="robot-ear" />

        {/* Head with responsive glowing border */}
        <rect x="40" y="40" width="120" height="120" rx="35" className="robot-head" />

        {/* Screen Base */}
        <rect x="50" y="55" width="100" height="85" rx="20" className="robot-screen" />

        {/* Dynamic Glowing Eyes & Mouth */}
        <g className="eyes-container" filter="url(#neon-eye-glow)">
          <path className="eye left-eye" d={paths.left} />
          <path className="eye right-eye" d={paths.right} />
          {paths.mouth && <path className="mouth" d={paths.mouth} style={{ opacity: 1 }} />}
        </g>

        {/* Screen Glare Overlay */}
        <rect x="50" y="55" width="100" height="85" rx="20" fill="url(#screen-glare)" />
      </svg>
    </div>
  );
}
