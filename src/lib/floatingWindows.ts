import type { FloatingBoxPosition } from './memoryAndStorage.ts';

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
  screen: ScreenBounds,
  secondaryObstacle?: FloatingBoxPosition | null
): FloatingBoxPosition {
  let current = clampBoxToScreen(movingBox, screen);

  const pushAwayFrom = (
    target: FloatingBoxPosition,
    obs: FloatingBoxPosition
  ): FloatingBoxPosition => {
    if (!boxesOverlap(target, obs, COLLISION_GAP)) {
      return target;
    }

    const candidates: Array<{ pos: FloatingBoxPosition; dist: number; valid: boolean }> = [];

    // Candidate 1: Push Left of obstacle
    const leftX = obs.x - target.width - COLLISION_GAP;
    candidates.push({
      pos: { ...target, x: leftX },
      dist: Math.abs(target.x - leftX),
      valid: leftX >= SCREEN_PADDING,
    });

    // Candidate 2: Push Right of obstacle
    const rightX = obs.x + obs.width + COLLISION_GAP;
    candidates.push({
      pos: { ...target, x: rightX },
      dist: Math.abs(target.x - rightX),
      valid: rightX + target.width <= screen.width - SCREEN_PADDING,
    });

    // Candidate 3: Push Above obstacle
    const upY = obs.y - target.height - COLLISION_GAP;
    candidates.push({
      pos: { ...target, y: upY },
      dist: Math.abs(target.y - upY),
      valid: upY >= SCREEN_PADDING,
    });

    // Candidate 4: Push Below obstacle
    const downY = obs.y + obs.height + COLLISION_GAP;
    candidates.push({
      pos: { ...target, y: downY },
      dist: Math.abs(target.y - downY),
      valid: downY + target.height <= screen.height - SCREEN_PADDING,
    });

    // Prefer valid in-screen candidates sorted by smallest movement distance
    const validCandidates = candidates
      .filter((c) => c.valid)
      .sort((a, b) => a.dist - b.dist);

    if (validCandidates.length > 0) {
      return clampBoxToScreen(validCandidates[0].pos, screen);
    }

    // If obstacle is very large, pick candidate with largest available space and clamp
    const sortedAll = candidates.sort((a, b) => a.dist - b.dist);
    return clampBoxToScreen(sortedAll[0].pos, screen);
  };

  if (obstacle) {
    current = pushAwayFrom(current, obstacle);
  }

  if (secondaryObstacle && boxesOverlap(current, secondaryObstacle, 8)) {
    const nudged = pushAwayFrom(current, secondaryObstacle);
    // Only apply secondary nudge if it doesn't push us back into the primary obstacle (the chatbox)
    if (!obstacle || !boxesOverlap(nudged, obstacle, COLLISION_GAP)) {
      current = nudged;
    }
  }

  return current;
}
