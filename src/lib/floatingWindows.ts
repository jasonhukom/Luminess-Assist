import { invoke } from '@tauri-apps/api/core';

export type FloatingBoxId = 'history' | 'settings' | 'music' | 'wellbeing' | 'taskmanager';

export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export interface BoxSizeConstraints {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export interface SmartBoxSpec {
  id: FloatingBoxId;
  desiredX: number;
  desiredY: number;
  preferredWidth: number;
  preferredHeight: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export interface SmartBoxLayoutInput {
  viewportWidth: number;
  viewportHeight: number;
  gap: number;
  margin: number;
  priorityOrder: FloatingBoxId[];
  obstacles: BoxRect[];
  boxes: SmartBoxSpec[];
}

export interface SolvedBoxRect extends BoxRect {
  id: FloatingBoxId;
  scale: number;
}

export interface PresetDashboardResult {
  botStagePos: { x: number; y: number };
  botObstacleRect: BoxRect;
  boxes: Record<FloatingBoxId, SolvedBoxRect>;
}

export const STAGE_PADDING = 72;
export const BOT_VISUAL_WIDTH = 160;
export const BOT_VISUAL_HEIGHT = 175;
export const CHAT_BOT_GAP = 28;
export const DEFAULT_BOX_GAP = 16;
export const DEFAULT_SCREEN_MARGIN = 18;
export const ALL_FLOATING_BOX_IDS: FloatingBoxId[] = [
  'taskmanager',
  'music',
  'wellbeing',
  'settings',
  'history',
];

export const BOX_SIZE_CONSTRAINTS: Record<FloatingBoxId, BoxSizeConstraints> = {
  history: {
    defaultWidth: 350,
    defaultHeight: 440,
    minWidth: 250,
    minHeight: 230,
    maxWidth: 440,
    maxHeight: 540,
  },
  settings: {
    defaultWidth: 430,
    defaultHeight: 520,
    minWidth: 300,
    minHeight: 270,
    maxWidth: 520,
    maxHeight: 640,
  },
  music: {
    defaultWidth: 392,
    defaultHeight: 420,
    minWidth: 270,
    minHeight: 240,
    maxWidth: 480,
    maxHeight: 560,
  },
  wellbeing: {
    defaultWidth: 520,
    defaultHeight: 500,
    minWidth: 320,
    minHeight: 270,
    maxWidth: 640,
    maxHeight: 620,
  },
  taskmanager: {
    defaultWidth: 440,
    defaultHeight: 420,
    minWidth: 280,
    minHeight: 240,
    maxWidth: 540,
    maxHeight: 560,
  },
};

const SCALE_STEPS = [1.0, 0.92, 0.84, 0.76, 0.68, 0.6];

function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(Math.max(min, max), val));
}

export function boxesOverlap(a: BoxRect, b: BoxRect, gap: number = 14): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function overlapArea(a: BoxRect, b: BoxRect, gap: number): number {
  const half = gap * 0.5;
  const ax1 = a.x - half;
  const ay1 = a.y - half;
  const ax2 = a.x + a.width + half;
  const ay2 = a.y + a.height + half;

  const bx1 = b.x - half;
  const by1 = b.y - half;
  const bx2 = b.x + b.width + half;
  const by2 = b.y + b.height + half;

  const ox = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const oy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  return ox * oy;
}

export function clampBoxToScreen(
  rect: BoxRect,
  screen: ScreenSize,
  margin: number = 16
): BoxRect {
  const safeW = Math.min(rect.width, Math.max(160, screen.width - margin * 2));
  const safeH = Math.min(rect.height, Math.max(160, screen.height - margin * 2));
  const maxX = Math.max(margin, screen.width - safeW - margin);
  const maxY = Math.max(margin, screen.height - safeH - margin);
  return {
    x: Math.round(Math.max(margin, Math.min(maxX, rect.x))),
    y: Math.round(Math.max(margin, Math.min(maxY, rect.y))),
    width: Math.round(safeW),
    height: Math.round(safeH),
  };
}

/**
 * Converts Luminess `.companion-anchor-stage` origin into exact screen-space obstacles for Bot and optional ChatPanel.
 */
export function computeStageObstacles(params: {
  anchorLeft: number;
  anchorTop: number;
  viewportWidth: number;
  viewportHeight: number;
  chatOpen: boolean;
  robotSize?: number;
  chatWidth?: number;
  chatHeight?: number;
  chatSide?: 'left' | 'right';
  chatVert?: 'up' | 'down';
}): { botRect: BoxRect; chatRect: BoxRect | null; obstacles: BoxRect[] } {
  const {
    anchorLeft,
    anchorTop,
    viewportWidth,
    chatOpen,
    robotSize = BOT_VISUAL_WIDTH,
    chatWidth = 376,
    chatHeight = 472,
    chatSide,
    chatVert = 'down',
  } = params;

  const botW = Math.round(robotSize);
  const botH = Math.round(robotSize * (BOT_VISUAL_HEIGHT / BOT_VISUAL_WIDTH));

  if (!chatOpen) {
    const botRect: BoxRect = {
      x: Math.round(anchorLeft + STAGE_PADDING),
      y: Math.round(anchorTop + STAGE_PADDING),
      width: botW,
      height: botH,
    };
    return { botRect, chatRect: null, obstacles: [botRect] };
  }

  const resolvedSide =
    chatSide ?? (anchorLeft + STAGE_PADDING + botW * 0.5 < viewportWidth * 0.5 ? 'right' : 'left');

  const stageCssH = Math.max(chatHeight, botW) + STAGE_PADDING * 2;
  const botCssLeft = resolvedSide === 'left' ? STAGE_PADDING + chatWidth + CHAT_BOT_GAP : STAGE_PADDING;
  const botCssTop = chatVert === 'up' ? stageCssH - STAGE_PADDING - botW : STAGE_PADDING;

  const chatCssLeft = resolvedSide === 'right' ? STAGE_PADDING + botW + CHAT_BOT_GAP : STAGE_PADDING;
  const chatCssTop = chatVert === 'up' ? stageCssH - STAGE_PADDING - chatHeight : STAGE_PADDING;

  const botRect: BoxRect = {
    x: Math.round(anchorLeft + botCssLeft),
    y: Math.round(anchorTop + botCssTop),
    width: botW,
    height: botH,
  };

  const chatRect: BoxRect = {
    x: Math.round(anchorLeft + chatCssLeft),
    y: Math.round(anchorTop + chatCssTop),
    width: Math.round(chatWidth),
    height: Math.round(chatHeight),
  };

  return { botRect, chatRect, obstacles: [botRect, chatRect] };
}

/**
 * Converts a desired visual top-left bot screen coordinate into `.companion-anchor-stage` `(left, top)`.
 */
export function botVisualToStagePos(
  visualX: number,
  visualY: number,
  options?: {
    chatOpen?: boolean;
    robotSize?: number;
    chatWidth?: number;
    chatHeight?: number;
    chatSide?: 'left' | 'right';
    chatVert?: 'up' | 'down';
  }
): { x: number; y: number } {
  const {
    chatOpen = false,
    robotSize = BOT_VISUAL_WIDTH,
    chatWidth = 376,
    chatHeight = 472,
    chatSide = 'left',
    chatVert = 'up',
  } = options || {};

  if (!chatOpen) {
    return {
      x: Math.round(visualX - STAGE_PADDING),
      y: Math.round(visualY - STAGE_PADDING),
    };
  }

  const stageCssH = Math.max(chatHeight, robotSize) + STAGE_PADDING * 2;
  const botCssLeft = chatSide === 'left' ? STAGE_PADDING + chatWidth + CHAT_BOT_GAP : STAGE_PADDING;
  const botCssTop = chatVert === 'up' ? stageCssH - STAGE_PADDING - robotSize : STAGE_PADDING;

  return {
    x: Math.round(visualX - botCssLeft),
    y: Math.round(visualY - botCssTop),
  };
}

/**
 * Resolves overlap between a target rect and a list of obstacles by searching the nearest non-overlapping slot.
 */
export function resolveFloatingBoxCollision(
  desired: BoxRect,
  obstacles: BoxRect[],
  screen: ScreenSize,
  gap: number = DEFAULT_BOX_GAP,
  margin: number = DEFAULT_SCREEN_MARGIN
): BoxRect {
  const clamped = clampBoxToScreen(desired, screen, margin);
  if (!obstacles.some((obs) => boxesOverlap(clamped, obs, gap))) {
    return clamped;
  }

  const maxX = Math.max(margin, screen.width - clamped.width - margin);
  const maxY = Math.max(margin, screen.height - clamped.height - margin);
  const candidates: Array<{ x: number; y: number }> = [];

  for (const obs of obstacles) {
    candidates.push(
      { x: obs.x + obs.width + gap, y: clamped.y },
      { x: obs.x - gap - clamped.width, y: clamped.y },
      { x: clamped.x, y: obs.y + obs.height + gap },
      { x: clamped.x, y: obs.y - gap - clamped.height },
      { x: obs.x + obs.width + gap, y: obs.y },
      { x: obs.x - gap - clamped.width, y: obs.y }
    );
  }

  const step = 42;
  for (let gx = margin; gx <= maxX; gx += step) {
    for (let gy = margin; gy <= maxY; gy += step) {
      candidates.push({ x: gx, y: gy });
    }
  }
  candidates.push({ x: maxX, y: margin }, { x: margin, y: maxY }, { x: maxX, y: maxY });

  let bestRect: BoxRect | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const cand of candidates) {
    const test = clampBoxToScreen(
      { x: cand.x, y: cand.y, width: clamped.width, height: clamped.height },
      screen,
      margin
    );
    if (!obstacles.some((obs) => boxesOverlap(test, obs, gap))) {
      const dist = Math.hypot(test.x - clamped.x, test.y - clamped.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestRect = test;
      }
    }
  }

  if (bestRect) return bestRect;
  return clamped;
}

export function spawnNonOverlappingBox(
  preferred: BoxRect,
  existingBoxes: BoxRect[],
  screen: ScreenSize
): BoxRect {
  return resolveFloatingBoxCollision(preferred, existingBoxes, screen, DEFAULT_BOX_GAP, DEFAULT_SCREEN_MARGIN);
}

function packBoxesWithScaleCap(
  ordered: SmartBoxSpec[],
  vw: number,
  vh: number,
  gap: number,
  margin: number,
  initialObstacles: BoxRect[],
  maxScale: number
): { result: Record<FloatingBoxId, SolvedBoxRect>; collisions: number; totalPenalty: number } {
  const screen: ScreenSize = { width: vw, height: vh };
  const occupied: BoxRect[] = [...initialObstacles];
  const result = {} as Record<FloatingBoxId, SolvedBoxRect>;
  let collisions = 0;
  let totalPenalty = 0;

  for (const spec of ordered) {
    const maxFitW = Math.max(180, vw - margin * 2);
    const maxFitH = Math.max(180, vh - margin * 2);
    const baseW = Math.min(maxFitW, clampNum(spec.preferredWidth, spec.minWidth, spec.maxWidth));
    const baseH = Math.min(maxFitH, clampNum(spec.preferredHeight, spec.minHeight, spec.maxHeight));

    let chosen: SolvedBoxRect | null = null;
    let fallbackBest: { penalty: number; rect: SolvedBoxRect } | null = null;

    for (const scale of SCALE_STEPS) {
      if (scale > maxScale + 1e-6) continue;
      const w = clampNum(Math.round(baseW * scale), Math.min(spec.minWidth, maxFitW), maxFitW);
      const h = clampNum(Math.round(baseH * scale), Math.min(spec.minHeight, maxFitH), maxFitH);

      const desired = clampBoxToScreen({ x: spec.desiredX, y: spec.desiredY, width: w, height: h }, screen, margin);
      const seen = new Set<string>();
      const candidates: Array<{ x: number; y: number }> = [];
      const addCand = (x: number, y: number) => {
        const rx = Math.round(x);
        const ry = Math.round(y);
        const key = `${rx}:${ry}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push({ x: rx, y: ry });
        }
      };

      addCand(desired.x, desired.y);
      for (const obs of occupied) {
        addCand(obs.x - gap - w, desired.y);
        addCand(obs.x + obs.width + gap, desired.y);
        addCand(desired.x, obs.y - gap - h);
        addCand(desired.x, obs.y + obs.height + gap);
        addCand(obs.x - gap - w, obs.y);
        addCand(obs.x + obs.width + gap, obs.y);
        addCand(obs.x, obs.y - gap - h);
        addCand(obs.x, obs.y + obs.height + gap);
      }

      const maxX = Math.max(margin, vw - w - margin);
      const maxY = Math.max(margin, vh - h - margin);
      const stepX = Math.max(40, (maxX - margin) / 7);
      const stepY = Math.max(40, (maxY - margin) / 6);

      for (let gy = margin; gy <= maxY + 0.5; gy += stepY) {
        for (let gx = margin; gx <= maxX + 0.5; gx += stepX) {
          addCand(gx, gy);
        }
      }
      addCand(maxX, margin);
      addCand(margin, maxY);
      addCand(maxX, maxY);

      candidates.sort(
        (a, b) =>
          (a.x - desired.x) ** 2 + (a.y - desired.y) ** 2 - ((b.x - desired.x) ** 2 + (b.y - desired.y) ** 2)
      );

      for (const cand of candidates) {
        const rect = clampBoxToScreen({ x: cand.x, y: cand.y, width: w, height: h }, screen, margin);
        const zeroCollision = !occupied.some((obs) => boxesOverlap(rect, obs, gap));
        const solvedCandidate: SolvedBoxRect = {
          id: spec.id,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scale,
        };

        if (zeroCollision) {
          chosen = solvedCandidate;
          break;
        }

        const totalOverlap = occupied.reduce((sum, obs) => sum + overlapArea(rect, obs, gap), 0);
        const dist = Math.hypot(rect.x - desired.x, rect.y - desired.y);
        const penalty = totalOverlap * 1000 + dist;
        if (!fallbackBest || penalty < fallbackBest.penalty) {
          fallbackBest = { penalty, rect: solvedCandidate };
        }
      }

      if (chosen) break;
    }

    let finalRect: SolvedBoxRect;
    if (chosen) {
      finalRect = chosen;
    } else {
      collisions += 1;
      totalPenalty += fallbackBest?.penalty ?? 0;
      finalRect = fallbackBest?.rect || {
        id: spec.id,
        x: Math.round(spec.desiredX),
        y: Math.round(spec.desiredY),
        width: Math.round(baseW),
        height: Math.round(baseH),
        scale: maxScale,
      };
    }

    occupied.push({
      x: finalRect.x,
      y: finalRect.y,
      width: finalRect.width,
      height: finalRect.height,
    });
    result[spec.id] = finalRect;
  }

  return { result, collisions, totalPenalty };
}

/**
 * Multi-box smart layout solver mirroring Rust `box_layout.rs`.
 * Automatically scales boxes down (`1.0 -> 0.60`) when space is constrained (auto-smallen)
 * and restores up to `preferredWidth`/`preferredHeight` when room opens up (auto-biggen),
 * guaranteeing zero pairwise overlaps among open boxes, Bot, and ChatPanel.
 */
export function solveSmartBoxLayout(
  input: SmartBoxLayoutInput
): Record<FloatingBoxId, SolvedBoxRect> {
  const vw = Math.max(640, input.viewportWidth);
  const vh = Math.max(480, input.viewportHeight);
  const gap = Math.max(8, input.gap);
  const margin = Math.max(8, input.margin);

  const ordered = [...input.boxes].sort((a, b) => {
    const ai = input.priorityOrder.indexOf(a.id);
    const bi = input.priorityOrder.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  let best: { result: Record<FloatingBoxId, SolvedBoxRect>; collisions: number; totalPenalty: number } | null = null;
  for (const cap of SCALE_STEPS) {
    const pass = packBoxesWithScaleCap(ordered, vw, vh, gap, margin, input.obstacles, cap);
    if (pass.collisions === 0) {
      return pass.result;
    }
    if (
      !best ||
      pass.collisions < best.collisions ||
      (pass.collisions === best.collisions && pass.totalPenalty < best.totalPenalty)
    ) {
      best = pass;
    }
  }

  return best?.result || ({} as Record<FloatingBoxId, SolvedBoxRect>);
}

/**
 * Computes preset non-overlapping positions when double-clicking Luminess Bot:
 * - Bot moves to Top Right
 * - Task Manager: Top Right (immediately left of Bot)
 * - Music Player: Top Middle
 * - History: Top Left
 * - Digital Wellbeing: Bottom Left
 * - Settings: Bottom Right
 */
export function computePresetDashboardLayout(
  viewportWidth: number,
  viewportHeight: number
): PresetDashboardResult {
  const vw = Math.max(760, viewportWidth);
  const vh = Math.max(540, viewportHeight);
  const margin = DEFAULT_SCREEN_MARGIN;
  const gap = DEFAULT_BOX_GAP;

  const botObstacleRect: BoxRect = {
    x: Math.round(Math.max(margin, vw - margin - BOT_VISUAL_WIDTH)),
    y: margin,
    width: BOT_VISUAL_WIDTH,
    height: BOT_VISUAL_HEIGHT,
  };

  const historyW = clampNum(vw * 0.21, 270, 340);
  const historyH = clampNum(vh * 0.42, 260, 420);
  const musicW = clampNum(vw * 0.24, 300, 392);
  const musicH = clampNum(vh * 0.41, 260, 410);
  const tmW = clampNum(vw * 0.26, 320, 440);
  const tmH = clampNum(vh * 0.42, 260, 420);
  const wbW = clampNum(vw * 0.36, 380, 540);
  const wbH = clampNum(vh * 0.45, 290, 470);
  const setW = clampNum(vw * 0.31, 340, 430);
  const setH = clampNum(vh * 0.47, 300, 490);

  const tmDesiredX = Math.max(margin, botObstacleRect.x - gap - tmW);
  const musicDesiredX = clampNum(
    (vw - musicW) * 0.5,
    margin + historyW + gap * 0.5,
    Math.max(margin, tmDesiredX - musicW - gap * 0.5)
  );

  const boxes = solveSmartBoxLayout({
    viewportWidth: vw,
    viewportHeight: vh,
    gap,
    margin,
    priorityOrder: ['taskmanager', 'music', 'wellbeing', 'settings', 'history'],
    obstacles: [botObstacleRect],
    boxes: [
      {
        id: 'taskmanager',
        desiredX: tmDesiredX,
        desiredY: margin,
        preferredWidth: tmW,
        preferredHeight: tmH,
        minWidth: BOX_SIZE_CONSTRAINTS.taskmanager.minWidth,
        minHeight: BOX_SIZE_CONSTRAINTS.taskmanager.minHeight,
        maxWidth: 480,
        maxHeight: 520,
      },
      {
        id: 'music',
        desiredX: musicDesiredX,
        desiredY: margin,
        preferredWidth: musicW,
        preferredHeight: musicH,
        minWidth: BOX_SIZE_CONSTRAINTS.music.minWidth,
        minHeight: BOX_SIZE_CONSTRAINTS.music.minHeight,
        maxWidth: 440,
        maxHeight: 520,
      },
      {
        id: 'history',
        desiredX: margin,
        desiredY: margin,
        preferredWidth: historyW,
        preferredHeight: historyH,
        minWidth: BOX_SIZE_CONSTRAINTS.history.minWidth,
        minHeight: BOX_SIZE_CONSTRAINTS.history.minHeight,
        maxWidth: 400,
        maxHeight: 500,
      },
      {
        id: 'wellbeing',
        desiredX: margin,
        desiredY: Math.max(margin + historyH + gap, vh - margin - wbH),
        preferredWidth: wbW,
        preferredHeight: wbH,
        minWidth: BOX_SIZE_CONSTRAINTS.wellbeing.minWidth,
        minHeight: BOX_SIZE_CONSTRAINTS.wellbeing.minHeight,
        maxWidth: 620,
        maxHeight: 600,
      },
      {
        id: 'settings',
        desiredX: Math.max(margin + wbW + gap, vw - margin - setW),
        desiredY: Math.max(margin + Math.max(botObstacleRect.height, tmH) + gap, vh - margin - setH),
        preferredWidth: setW,
        preferredHeight: setH,
        minWidth: BOX_SIZE_CONSTRAINTS.settings.minWidth,
        minHeight: BOX_SIZE_CONSTRAINTS.settings.minHeight,
        maxWidth: 500,
        maxHeight: 620,
      },
    ],
  });

  return {
    botStagePos: botVisualToStagePos(botObstacleRect.x, botObstacleRect.y),
    botObstacleRect,
    boxes,
  };
}

/**
 * Computes new non-overlapping box positions so every open box follows Bot's delta movement
 * without colliding with Bot, ChatPanel, or other open boxes.
 */
export function computeBotFollowLayout(params: {
  openBoxIds: FloatingBoxId[];
  currentBoxes: Record<FloatingBoxId, BoxRect>;
  preferredSizes: Record<FloatingBoxId, { width: number; height: number }>;
  followOffsets: Partial<Record<FloatingBoxId, { dx: number; dy: number }>>;
  botRect: BoxRect;
  chatRect: BoxRect | null;
  viewportWidth: number;
  viewportHeight: number;
  priorityOrder?: FloatingBoxId[];
}): Record<FloatingBoxId, SolvedBoxRect> {
  const {
    openBoxIds,
    currentBoxes,
    preferredSizes,
    followOffsets,
    botRect,
    chatRect,
    viewportWidth,
    viewportHeight,
    priorityOrder = ALL_FLOATING_BOX_IDS,
  } = params;

  const obstacles: BoxRect[] = chatRect ? [botRect, chatRect] : [botRect];
  const specs: SmartBoxSpec[] = openBoxIds.map((id) => {
    const cur = currentBoxes[id];
    const pref = preferredSizes[id] || {
      width: BOX_SIZE_CONSTRAINTS[id].defaultWidth,
      height: BOX_SIZE_CONSTRAINTS[id].defaultHeight,
    };
    const off = followOffsets[id];
    const desiredX = off ? botRect.x + off.dx : cur.x;
    const desiredY = off ? botRect.y + off.dy : cur.y;
    const limits = BOX_SIZE_CONSTRAINTS[id];
    return {
      id,
      desiredX,
      desiredY,
      preferredWidth: pref.width,
      preferredHeight: pref.height,
      minWidth: limits.minWidth,
      minHeight: limits.minHeight,
      maxWidth: limits.maxWidth,
      maxHeight: limits.maxHeight,
    };
  });

  return solveSmartBoxLayout({
    viewportWidth,
    viewportHeight,
    gap: DEFAULT_BOX_GAP,
    margin: DEFAULT_SCREEN_MARGIN,
    priorityOrder,
    obstacles,
    boxes: specs,
  });
}

export async function computeSmartBoxLayoutViaRust(
  input: SmartBoxLayoutInput
): Promise<Record<FloatingBoxId, SolvedBoxRect>> {
  try {
    return await invoke<Record<FloatingBoxId, SolvedBoxRect>>('compute_smart_box_layout', { input });
  } catch {
    return solveSmartBoxLayout(input);
  }
}

export async function computePresetDashboardViaRust(
  viewportWidth: number,
  viewportHeight: number
): Promise<PresetDashboardResult> {
  try {
    const out = await invoke<{ botPos: BoxRect; rects: Record<FloatingBoxId, SolvedBoxRect> }>(
      'compute_preset_dashboard_layout',
      {
        viewportWidth,
        viewportHeight,
        botWidth: BOT_VISUAL_WIDTH,
        botHeight: BOT_VISUAL_HEIGHT,
      }
    );
    if (out && out.botPos && out.rects) {
      return {
        botStagePos: botVisualToStagePos(out.botPos.x, out.botPos.y),
        botObstacleRect: out.botPos,
        boxes: out.rects,
      };
    }
  } catch {
    // Web / vitest fallback
  }
  return computePresetDashboardLayout(viewportWidth, viewportHeight);
}
