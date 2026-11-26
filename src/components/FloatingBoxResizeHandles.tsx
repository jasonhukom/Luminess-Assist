import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { FloatingBoxPosition } from '../lib/memoryAndStorage.ts';

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface FloatingBoxResizeHandlesProps {
  position: FloatingBoxPosition;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  onChangePosition: (next: FloatingBoxPosition, isUserResize?: boolean) => void;
  onResizingChange?: (active: boolean) => void;
  onActivity?: () => void;
}

const DIRECTIONS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export function FloatingBoxResizeHandles({
  position,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  onChangePosition,
  onResizingChange,
  onActivity,
}: FloatingBoxResizeHandlesProps) {
  const resizeRef = useRef<{
    active: boolean;
    dir: ResizeDir;
    startX: number;
    startY: number;
    orig: FloatingBoxPosition;
  }>({
    active: false,
    dir: 'se',
    startX: 0,
    startY: 0,
    orig: position,
  });

  const handlePointerDown = (dir: ResizeDir) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onActivity?.();
    onResizingChange?.(true);
    resizeRef.current = {
      active: true,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...position },
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = resizeRef.current;
    if (!st.active) return;
    e.stopPropagation();
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const margin = 12;

    const effMaxW = Math.min(maxWidth, vw - margin * 2);
    const effMaxH = Math.min(maxHeight, vh - margin * 2);

    let nextX = st.orig.x;
    let nextY = st.orig.y;
    let nextW = st.orig.width;
    let nextH = st.orig.height;

    if (st.dir.includes('e')) {
      nextW = Math.max(minWidth, Math.min(effMaxW, st.orig.width + dx));
    }
    if (st.dir.includes('s')) {
      nextH = Math.max(minHeight, Math.min(effMaxH, st.orig.height + dy));
    }
    if (st.dir.includes('w')) {
      const targetW = Math.max(minWidth, Math.min(effMaxW, st.orig.width - dx));
      nextX = st.orig.x + (st.orig.width - targetW);
      nextW = targetW;
    }
    if (st.dir.includes('n')) {
      const targetH = Math.max(minHeight, Math.min(effMaxH, st.orig.height - dy));
      nextY = st.orig.y + (st.orig.height - targetH);
      nextH = targetH;
    }

    nextX = Math.max(margin, Math.min(vw - nextW - margin, nextX));
    nextY = Math.max(margin, Math.min(vh - nextH - margin, nextY));

    onChangePosition(
      {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextW),
        height: Math.round(nextH),
      },
      true
    );
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current.active) return;
    resizeRef.current.active = false;
    onResizingChange?.(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {DIRECTIONS.map((dir) => (
        <div
          key={dir}
          className={`box-resize-handle box-resize-${dir}`}
          onPointerDown={handlePointerDown(dir)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
