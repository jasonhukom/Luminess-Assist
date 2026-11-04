import { describe, it, expect } from 'vitest';
import {
  boxesOverlap,
  clampBoxToScreen,
  resolveFloatingBoxCollision,
  spawnNonOverlappingBox,
  type BoxRect,
} from './floatingWindows.ts';

describe('floatingWindows collision avoidance', () => {
  const screen = { width: 1920, height: 1080 };
  const chatBox: BoxRect = { x: 800, y: 300, width: 380, height: 500 };

  it('detects when a floating box touches or overlaps the chatbox within the safety gap', () => {
    const overlapping: BoxRect = { x: 850, y: 350, width: 350, height: 470 };
    expect(boxesOverlap(overlapping, chatBox, 18)).toBe(true);

    const farAway: BoxRect = { x: 50, y: 80, width: 350, height: 470 };
    expect(boxesOverlap(farAway, chatBox, 18)).toBe(false);
  });

  it('automatically moves a floating box away when it touches the chatbox', () => {
    const touchingLeft: BoxRect = { x: 600, y: 320, width: 350, height: 470 };
    const resolved = resolveFloatingBoxCollision(touchingLeft, chatBox, [], screen, 18);
    expect(boxesOverlap(resolved, chatBox, 16)).toBe(false);
  });

  it('clamps floating boxes within the visible desktop screen bounds', () => {
    const offscreen: BoxRect = { x: -200, y: 2000, width: 350, height: 470 };
    const clamped = clampBoxToScreen(offscreen, screen);
    expect(clamped.x).toBeGreaterThanOrEqual(12);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(screen.height - 12);
  });

  it('spawns new floating boxes without overlapping the chatbox or other floating panels', () => {
    const historyBox = spawnNonOverlappingBox(
      { width: 350, height: 470 },
      { x: 820, y: 320 }, // Right on top of chatbox
      chatBox,
      [],
      screen
    );
    expect(boxesOverlap(historyBox, chatBox, 16)).toBe(false);

    const settingsBox = spawnNonOverlappingBox(
      { width: 380, height: 500 },
      { x: historyBox.x, y: historyBox.y },
      chatBox,
      [historyBox],
      screen
    );
    expect(boxesOverlap(settingsBox, chatBox, 16)).toBe(false);
  });
});
