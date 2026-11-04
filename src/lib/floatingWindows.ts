import type { FloatingBoxPosition } from './memoryAndStorage.ts';

export type BoxRect = FloatingBoxPosition;

export interface ScreenBounds {
  width: number;
  height: number;
}

const COLLISION_GAP = 16;
const SCREEN_PADDING = 12;

export function boxesOverlap(
  a: FloatingBoxPosition,
  b: FloatingBoxPosition,
  gap = COLLISION_GAP
): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

export function clampBoxToScreen(
  box: FloatingBoxPosition,
  screen: ScreenBounds,
  padding = SCREEN_PADDING
): FloatingBoxPosition {
  const maxW = Math.max(240, screen.width - padding * 2);
  const maxH = Math.max(240, screen.height - padding * 2);
  const width = Math.min(box.width, maxW);
  const height = Math.min(box.height, maxH);
  const x = Math.max(padding, Math.min(screen.width - width - padding, Math.round(box.x)));
  const y = Math.max(padding, Math.min(screen.height - height - padding, Math.round(box.y)));
  return { x, y, width, height };
}

/**
 * Ensures `movingBox` never overlaps `obstacle` (e.g. the Chatbox).
 * When touching or intersecting `obstacle`, calculates the minimal displacement vector
 * (left, right, up, or down) that fits within `screen` bounds and moves `movingBox` away.
 */
export function resolveFloatingBoxCollision(
  movingBox: FloatingBoxPosition,
  obstacle: FloatingBoxPosition | null,
  thirdArg: ScreenBounds | FloatingBoxPosition[],
  fourthArg?: FloatingBoxPosition | ScreenBounds | null,
  customGap = COLLISION_GAP
): FloatingBoxPosition {
  let screen: ScreenBounds;
  let secondaryObstacles: FloatingBoxPosition[] = [];

  if (Array.isArray(thirdArg)) {
    secondaryObstacles = thirdArg;
    screen = (fourthArg as ScreenBounds) || { width: 1920, height: 1080 };
  } else {
    screen = thirdArg;
    if (fourthArg && !('width' in fourthArg && !('x' in fourthArg))) {
      secondaryObstacles = [fourthArg as FloatingBoxPosition];
    }
  }

  const gap = Math.max(COLLISION_GAP, customGap);
  let current = clampBoxToScreen(movingBox, screen);

  const pushAwayFrom = (
    target: FloatingBoxPosition,
    obs: FloatingBoxPosition,
    minGap: number
  ): FloatingBoxPosition => {
    if (!boxesOverlap(target, obs, minGap)) {
      return target;
    }

    const candidates: Array<{ pos: FloatingBoxPosition; dist: number; valid: boolean }> = [];

    // Candidate 1: Push Left of obstacle
    const leftX = obs.x - target.width - minGap;
    candidates.push({
      pos: { ...target, x: leftX },
      dist: Math.abs(target.x - leftX),
      valid: leftX >= SCREEN_PADDING,
    });

    // Candidate 2: Push Right of obstacle
    const rightX = obs.x + obs.width + minGap;
    candidates.push({
      pos: { ...target, x: rightX },
      dist: Math.abs(target.x - rightX),
      valid: rightX + target.width <= screen.width - SCREEN_PADDING,
    });

    // Candidate 3: Push Above obstacle
    const upY = obs.y - target.height - minGap;
    candidates.push({
      pos: { ...target, y: upY },
      dist: Math.abs(target.y - upY),
      valid: upY >= SCREEN_PADDING,
    });

    // Candidate 4: Push Below obstacle
    const downY = obs.y + obs.height + minGap;
    candidates.push({
      pos: { ...target, y: downY },
      dist: Math.abs(target.y - downY),
      valid: downY + target.height <= screen.height - SCREEN_PADDING,
    });

    const validCandidates = candidates
      .filter((c) => c.valid)
      .sort((a, b) => a.dist - b.dist);

    if (validCandidates.length > 0) {
      return clampBoxToScreen(validCandidates[0].pos, screen);
    }

    const sortedAll = candidates.sort((a, b) => a.dist - b.dist);
    return clampBoxToScreen(sortedAll[0].pos, screen);
  };

  if (obstacle) {
    current = pushAwayFrom(current, obstacle, gap);
  }

  for (const sec of secondaryObstacles) {
    if (sec && boxesOverlap(current, sec, gap)) {
      const nudged = pushAwayFrom(current, sec, gap);
      if (!obstacle || !boxesOverlap(nudged, obstacle, gap)) {
        current = nudged;
      }
    }
  }

  return current;
}

/**
 * Computes a clean initial position for a floating box that does not overlap the Chatbox
 * or any other active floating box.
 */
export function spawnNonOverlappingBox(
  size: { width: number; height: number },
  preferredPos: { x: number; y: number },
  chatBox: FloatingBoxPosition | null,
  otherBoxes: FloatingBoxPosition[],
  screen: ScreenBounds,
  gap = 18
): FloatingBoxPosition {
  const initial: FloatingBoxPosition = {
    x: preferredPos.x,
    y: preferredPos.y,
    width: size.width,
    height: size.height,
  };
  return resolveFloatingBoxCollision(initial, chatBox, otherBoxes, screen, gap);
}
