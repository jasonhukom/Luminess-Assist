import { describe, expect, it } from 'vitest';
import {
  ALL_FLOATING_BOX_IDS,
  BOX_SIZE_CONSTRAINTS,
  boxesOverlap,
  computeBotFollowLayout,
  computePresetDashboardLayout,
  solveSmartBoxLayout,
  type BoxRect,
  type FloatingBoxId,
} from './floatingWindows';

function assertZeroOverlaps(rects: BoxRect[], gap: number = 12) {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      expect(
        boxesOverlap(rects[i], rects[j], gap),
        `Expected zero overlap between rect[${i}]=${JSON.stringify(rects[i])} and rect[${j}]=${JSON.stringify(rects[j])}`
      ).toBe(false);
    }
  }
}

describe('floatingWindows smart layout & preset dashboard', () => {
  it('places Bot top-right and all 5 floating boxes in preset quadrants with zero overlap on 1080p and 768p', () => {
    for (const [vw, vh] of [
      [1920, 1080],
      [1366, 768],
    ]) {
      const preset = computePresetDashboardLayout(vw, vh);

      // Bot moves to top-right
      expect(preset.botObstacleRect.x).toBeGreaterThan(vw * 0.75);
      expect(preset.botObstacleRect.y).toBeLessThanOrEqual(24);

      const { taskmanager, music, history, wellbeing, settings } = preset.boxes;
      expect(taskmanager).toBeDefined();
      expect(music).toBeDefined();
      expect(history).toBeDefined();
      expect(wellbeing).toBeDefined();
      expect(settings).toBeDefined();

      // Quadrant verification:
      // Task Manager: top-right (left of Bot)
      expect(taskmanager.x).toBeGreaterThan(vw * 0.45);
      expect(taskmanager.y).toBeLessThan(vh * 0.3);
      expect(taskmanager.x + taskmanager.width).toBeLessThanOrEqual(preset.botObstacleRect.x);

      // Music Player: top-middle
      expect(music.x).toBeGreaterThan(history.x);
      expect(music.x).toBeLessThan(taskmanager.x);
      expect(music.y).toBeLessThan(vh * 0.3);

      // History: top-left
      expect(history.x).toBeLessThan(vw * 0.2);
      expect(history.y).toBeLessThan(vh * 0.3);

      // Digital Wellbeing: bottom-left
      expect(wellbeing.x).toBeLessThan(vw * 0.2);
      expect(wellbeing.y).toBeGreaterThan(vh * 0.35);

      // Settings: bottom-right
      expect(settings.x).toBeGreaterThan(vw * 0.45);
      expect(settings.y).toBeGreaterThan(vh * 0.35);

      const allRects: BoxRect[] = [
        preset.botObstacleRect,
        ...ALL_FLOATING_BOX_IDS.map((id) => preset.boxes[id]),
      ];
      assertZeroOverlaps(allRects, 12);
    }
  });

  it('automatically smallens boxes in cramped viewports and biggens them back when space opens up', () => {
    const specs = [
      {
        id: 'settings' as FloatingBoxId,
        desiredX: 380,
        desiredY: 60,
        preferredWidth: 430,
        preferredHeight: 520,
        minWidth: BOX_SIZE_CONSTRAINTS.settings.minWidth,
        minHeight: BOX_SIZE_CONSTRAINTS.settings.minHeight,
        maxWidth: 500,
        maxHeight: 620,
      },
      {
        id: 'wellbeing' as FloatingBoxId,
        desiredX: 20,
        desiredY: 60,
        preferredWidth: 520,
        preferredHeight: 500,
        minWidth: BOX_SIZE_CONSTRAINTS.wellbeing.minWidth,
        minHeight: BOX_SIZE_CONSTRAINTS.wellbeing.minHeight,
        maxWidth: 620,
        maxHeight: 600,
      },
    ];

    const cramped = solveSmartBoxLayout({
      viewportWidth: 820,
      viewportHeight: 640,
      gap: 16,
      margin: 16,
      priorityOrder: ['settings', 'wellbeing'],
      obstacles: [{ x: 640, y: 20, width: 160, height: 175 }],
      boxes: specs,
    });
    expect(cramped.wellbeing.scale).toBeLessThan(1);
    assertZeroOverlaps(
      [
        { x: 640, y: 20, width: 160, height: 175 },
        cramped.settings,
        cramped.wellbeing,
      ],
      12
    );

    const open = solveSmartBoxLayout({
      viewportWidth: 1600,
      viewportHeight: 960,
      gap: 16,
      margin: 16,
      priorityOrder: ['settings', 'wellbeing'],
      obstacles: [{ x: 1400, y: 20, width: 160, height: 175 }],
      boxes: specs,
    });
    expect(open.settings.scale).toBe(1);
    expect(open.wellbeing.scale).toBe(1);
    expect(open.wellbeing.width).toBe(520);
  });

  it('follows Bot movement while keeping open boxes separated from Bot, Chat, and each other', () => {
    const botMoved: BoxRect = { x: 260, y: 220, width: 160, height: 175 };
    const chatRect: BoxRect = { x: 448, y: 184, width: 376, height: 472 };

    const solved = computeBotFollowLayout({
      openBoxIds: ['music', 'taskmanager'],
      currentBoxes: {
        history: { x: 20, y: 20, width: 350, height: 440 },
        settings: { x: 860, y: 430, width: 430, height: 520 },
        music: { x: 500, y: 20, width: 392, height: 420 },
        wellbeing: { x: 20, y: 430, width: 520, height: 500 },
        taskmanager: { x: 900, y: 20, width: 440, height: 420 },
      },
      preferredSizes: {
        history: { width: 350, height: 440 },
        settings: { width: 430, height: 520 },
        music: { width: 392, height: 420 },
        wellbeing: { width: 520, height: 500 },
        taskmanager: { width: 440, height: 420 },
      },
      followOffsets: {
        music: { dx: 180, dy: 0 }, // collides with moved Bot/Chat if not resolved!
        taskmanager: { dx: 420, dy: -160 },
      },
      botRect: botMoved,
      chatRect,
      viewportWidth: 1366,
      viewportHeight: 768,
    });

    assertZeroOverlaps([botMoved, chatRect, solved.music, solved.taskmanager], 12);
  });
});
