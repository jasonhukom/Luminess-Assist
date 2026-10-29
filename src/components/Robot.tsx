import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import './Robot.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getAutonomousRemark, recordPersonalityEvent } from '../lib/personality.ts';

export type Emotion =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'disgust'
  | 'curiosity'
  | 'confusion'
  | 'love'
  | 'embarrassment'
  | 'idle';

export type VisualEmotion = Emotion | 'dizzy' | 'broken' | 'white-bot';

export type FrustrationStage = 0 | 1 | 2 | 3 | 4;
export type CrackStage = 0 | 1 | 2 | 3 | 4;
export type IdleAction = 'none' | 'happy' | 'spin' | 'hop' | 'look';

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

interface BotGlidePayload {
  active: boolean;
  vx: number;
  vy: number;
  screen_side: string;
  screen_vert: string;
}

interface HeartParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  driftX: number;
  duration: number;
}

interface RobotProps {
  emotion: Emotion;
  size: number;
  onResize: (newSize: number, anchor?: { clientX: number; clientY: number }) => void;
  onClick: () => void;
  onEmotionChange?: (emotion: Emotion) => void;
  onVisualEmotionChange?: (visualEmotion: VisualEmotion) => void;
  onDragStateChange?: (dragging: boolean) => void;
  onScreenSideChange?: (side: 'left' | 'right', vert: 'up' | 'down') => void;
  onBrokenCountdownChange?: (seconds: number) => void;
  onAutonomousRemark?: (remark: string) => void;
}

interface FaceConfig {
  left: string;
  right: string;
  leftBrow?: string;
  rightBrow?: string;
  mouth?: string;
  blush?: boolean;
  sweatDrop?: boolean;
}

const EMOTION_FACES: Record<Emotion, FaceConfig> = {
  idle: {
    left: 'M 65 94 C 65 86, 85 86, 85 94 C 85 102, 65 102, 65 94 Z',
    right: 'M 115 94 C 115 86, 135 86, 135 94 C 135 102, 115 102, 115 94 Z',
  },
  joy: {
    left: 'M 60 98 Q 75 74 90 98 Q 75 84 60 98',
    right: 'M 110 98 Q 125 74 140 98 Q 125 84 110 98',
    leftBrow: 'M 62 76 Q 75 70 88 75',
    rightBrow: 'M 112 75 Q 125 70 138 76',
    mouth: 'M 86 111 Q 100 125 114 111',
    blush: true,
  },
  sadness: {
    left: 'M 64 102 Q 75 90 89 95 Q 75 101 64 102',
    right: 'M 111 95 Q 125 90 136 102 Q 125 101 111 95',
    leftBrow: 'M 60 84 Q 74 79 88 74',
    rightBrow: 'M 112 74 Q 126 79 140 84',
    mouth: 'M 89 121 Q 100 112 111 121',
  },
  anger: {
    left: 'M 62 84 L 90 97 L 86 104 L 60 92 Z',
    right: 'M 110 97 L 138 84 L 140 92 L 114 104 Z',
    leftBrow: 'M 60 76 L 91 88',
    rightBrow: 'M 109 88 L 140 76',
    mouth: 'M 88 120 Q 100 111 112 120',
  },
  fear: {
    left: 'M 62 94 A 13 15 0 1 1 88 94 A 13 15 0 1 1 62 94',
    right: 'M 112 94 A 13 15 0 1 1 138 94 A 13 15 0 1 1 112 94',
    leftBrow: 'M 60 78 Q 74 72 88 68',
    rightBrow: 'M 112 68 Q 126 72 140 78',
    mouth: 'M 88 119 Q 94 114 100 119 T 112 119',
    sweatDrop: true,
  },
  surprise: {
    left: 'M 60 93 A 15 15 0 1 1 90 93 A 15 15 0 1 1 60 93',
    right: 'M 110 93 A 15 15 0 1 1 140 93 A 15 15 0 1 1 110 93',
    leftBrow: 'M 61 70 Q 75 62 89 70',
    rightBrow: 'M 111 70 Q 125 62 139 70',
    mouth: 'M 94 117 A 6 7 0 1 1 106 117 A 6 7 0 1 1 94 117',
  },
  disgust: {
    left: 'M 60 90 Q 75 85 90 94 Q 75 96 60 90',
    right: 'M 110 94 Q 125 85 140 90 Q 125 96 110 94',
    leftBrow: 'M 61 78 L 89 82',
    rightBrow: 'M 111 76 Q 125 71 139 78',
    mouth: 'M 87 119 Q 96 111 105 117 T 114 115',
  },
  curiosity: {
    left: 'M 62 93 A 13 14 0 1 1 88 93 A 13 14 0 1 1 62 93',
    right: 'M 115 95 C 115 89, 135 89, 135 95 C 135 101, 115 101, 115 95',
    leftBrow: 'M 61 71 Q 75 63 89 71',
    rightBrow: 'M 113 80 L 137 78',
    mouth: 'M 96 116 A 4 4 0 1 1 104 116 A 4 4 0 1 1 96 116',
  },
  confusion: {
    left: 'M 64 87 L 86 87 L 86 101 L 64 101 Z',
    right: 'M 113 94 C 113 84, 137 84, 137 94 C 137 104, 113 104, 113 94',
    leftBrow: 'M 62 79 L 88 82',
    rightBrow: 'M 112 72 Q 125 64 138 73',
    mouth: 'M 87 117 Q 94 112 100 117 T 113 116',
  },
  love: {
    left: 'M 75 106 C 63 98, 59 86, 66 80 C 71 76, 75 81, 75 85 C 75 81, 79 76, 84 80 C 91 86, 87 98, 75 106 Z',
    right: 'M 125 106 C 113 98, 109 86, 116 80 C 121 76, 125 81, 125 85 C 125 81, 129 76, 134 80 C 141 86, 137 98, 125 106 Z',
    leftBrow: 'M 62 72 Q 75 67 88 73',
    rightBrow: 'M 112 73 Q 125 67 138 72',
    mouth: 'M 88 112 Q 94 121 100 114 Q 106 121 112 112',
    blush: true,
  },
  embarrassment: {
    left: 'M 67 98 C 67 93, 83 93, 83 98 C 83 103, 67 103, 67 98',
    right: 'M 117 98 C 117 93, 133 93, 133 98 C 133 103, 117 103, 117 98',
    leftBrow: 'M 62 82 Q 75 78 86 74',
    rightBrow: 'M 114 74 Q 125 78 138 82',
    mouth: 'M 88 117 Q 94 113 100 117 Q 106 121 112 117',
    blush: true,
    sweatDrop: true,
  },
};

const ANNOYED_FACE: FaceConfig = {
  left: 'M 63 92 L 88 94 L 88 100 L 63 99 Z',
  right: 'M 112 94 L 137 92 L 137 99 L 112 100 Z',
  leftBrow: 'M 61 83 L 89 87',
  rightBrow: 'M 111 87 L 139 83',
  mouth: 'M 90 117 L 110 115',
};

const FURIOUS_FACE: FaceConfig = {
  left: 'M 60 81 L 91 96 L 86 105 L 58 91 Z',
  right: 'M 109 96 L 140 81 L 142 91 L 114 105 Z',
  leftBrow: 'M 58 73 L 92 88',
  rightBrow: 'M 108 88 L 142 73',
  mouth: 'M 84 122 L 92 114 L 100 121 L 108 114 L 116 122',
};

const LEFT_SPIRAL_PATH =
  'M 75 94 m 0 -2.2 a 2.2 2.2 0 1 1 0 4.4 a 4.8 4.8 0 1 1 0 -9.6 a 7.8 7.8 0 1 1 0 15.6 a 11.2 11.2 0 1 1 0 -22.4 a 14.2 14.2 0 1 1 -10.5 4.5';

const RIGHT_SPIRAL_PATH =
  'M 125 94 m 0 -2.2 a 2.2 2.2 0 1 1 0 4.4 a 4.8 4.8 0 1 1 0 -9.6 a 7.8 7.8 0 1 1 0 15.6 a 11.2 11.2 0 1 1 0 -22.4 a 14.2 14.2 0 1 1 -10.5 4.5';

const WHITE_BOT_FACE: FaceConfig = {
  left: 'M 65 96 Q 75 90 85 96',
  right: 'M 115 96 Q 125 90 135 96',
  mouth: 'M 95 114 Q 100 117 105 114',
};

const BROKEN_FACE: FaceConfig = {
  left: 'M 64 83 L 86 105 M 86 83 L 64 105',
  right: 'M 114 83 L 136 105 M 136 83 L 114 105',
  mouth: 'M 83 121 L 90 115 L 97 122 L 105 115 L 114 121',
};

const LONELY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const BROKEN_REPAIR_SECONDS = 30;

function getFrustrationStage(val: number): FrustrationStage {
  if (val >= 80) return 4;
  if (val >= 60) return 3;
  if (val >= 40) return 2;
  if (val >= 20) return 1;
  return 0;
}

function getCrackStage(damage: number): CrackStage {
  if (damage >= 100) return 4;
  if (damage >= 70) return 3;
  if (damage >= 45) return 2;
  if (damage >= 20) return 1;
  return 0;
}

export function Robot({
  emotion,
  size,
  onResize,
  onClick,
  onEmotionChange,
  onVisualEmotionChange,
  onDragStateChange,
  onScreenSideChange,
  onBrokenCountdownChange,
  onAutonomousRemark,
}: RobotProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Physical & interaction states
  const [isGrabbed, setIsGrabbed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isDizzy, setIsDizzy] = useState(false);
  const [isPatting, setIsPatting] = useState(false);
  const [patBounceKey, setPatBounceKey] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isHappy, setIsHappy] = useState<boolean>(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isImpactShaking, setIsImpactShaking] = useState(false);
  const [frustration, setFrustration] = useState<number>(0);
  const [damage, setDamage] = useState<number>(0);
  const [isBroken, setIsBroken] = useState<boolean>(false);
  const [brokenCountdown, setBrokenCountdown] = useState<number>(0);
  const [isLonelySad, setIsLonelySad] = useState<boolean>(false);
  const [isWhiteBot, setIsWhiteBot] = useState<boolean>(false);
  const hoverPettingDurationRef = useRef<number>(0);
  const lastHoverTimeRef = useRef<number>(0);
  const [idleAction, setIdleAction] = useState<IdleAction>('none');
  const [isGliding, setIsGliding] = useState<boolean>(false);
  const [convEmotionActive, setConvEmotionActive] = useState<boolean>(false);
  const [hearts, setHearts] = useState<HeartParticle[]>([]);
  const [autonomousRemark, setAutonomousRemark] = useState<string | null>(null);

  const [tilt, setTilt] = useState<{ deg: number; scaleX: number; scaleY: number }>({
    deg: 0,
    scaleX: 1,
    scaleY: 1,
  });
  const [gaze, setGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const rafRef = useRef<number | null>(null);
  const dizzyTimerRef = useRef<number | null>(null);
  const patTimerRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const happyTimerRef = useRef<number | null>(null);
  const hoverMoveAccumRef = useRef<number>(0);
  const hoverLeaveTimerRef = useRef<number | null>(null);
  const recoveryTimerRef = useRef<number | null>(null);
  const impactShakeTimerRef = useRef<number | null>(null);
  const idleActionTimerRef = useRef<number | null>(null);
  const autonomousRemarkTimerRef = useRef<number | null>(null);
  const heartCleanupTimersRef = useRef<number[]>([]);

  const tapCountRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);
  const dizzyEnergyRef = useRef<number>(0);
  const lastDragVelRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const lastHoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRubAccumRef = useRef<number>(0);
  const hoverHeartAccumRef = useRef<number>(0);
  const sootheHeartAccumRef = useRef<number>(0);
  const lastBounceTimeRef = useRef<number>(0);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const lastImpactTimeRef = useRef<number>(0);
  const idleBusyRef = useRef<boolean>(false);
  const autonomousBusyRef = useRef<boolean>(false);
  const heartIdCounterRef = useRef<number>(1);
  const isDizzyRef = useRef<boolean>(false);
  const isPattingRef = useRef<boolean>(false);
  const isBrokenRef = useRef<boolean>(false);
  const frustrationRef = useRef<number>(0);
  const damageRef = useRef<number>(0);

  const onScreenSideChangeRef = useRef(onScreenSideChange);
  const onEmotionChangeRef = useRef(onEmotionChange);
  const onVisualEmotionChangeRef = useRef(onVisualEmotionChange);
  const onBrokenCountdownChangeRef = useRef(onBrokenCountdownChange);
  const onAutonomousRemarkRef = useRef(onAutonomousRemark);

  useEffect(() => {
    onScreenSideChangeRef.current = onScreenSideChange;
  }, [onScreenSideChange]);

  useEffect(() => {
    onEmotionChangeRef.current = onEmotionChange;
  }, [onEmotionChange]);

  useEffect(() => {
    onVisualEmotionChangeRef.current = onVisualEmotionChange;
  }, [onVisualEmotionChange]);

  useEffect(() => {
    onBrokenCountdownChangeRef.current = onBrokenCountdownChange;
  }, [onBrokenCountdownChange]);

  useEffect(() => {
    onAutonomousRemarkRef.current = onAutonomousRemark;
  }, [onAutonomousRemark]);

  useEffect(() => {
    isDizzyRef.current = isDizzy;
  }, [isDizzy]);

  useEffect(() => {
    isPattingRef.current = isPatting;
  }, [isPatting]);

  useEffect(() => {
    isBrokenRef.current = isBroken;
  }, [isBroken]);

  useEffect(() => {
    frustrationRef.current = frustration;
  }, [frustration]);

  useEffect(() => {
    damageRef.current = damage;
  }, [damage]);

  const recordUserActivity = useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    setIsWhiteBot(false);
    setIsLonelySad((prev) => (prev ? false : prev));
  }, []);

  useEffect(() => {
    recordUserActivity();
  }, [emotion, recordUserActivity]);

  // 15-minute untouched check: white bot only shows if not interacted with at all for 15 whole minutes
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityTimeRef.current >= LONELY_THRESHOLD_MS) {
        setIsWhiteBot(true);
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, []);

  const dragStateRef = useRef<{
    active: boolean;
    hasMoved: boolean;
    startScreenX: number;
    startScreenY: number;
    startWinX: number;
    startWinY: number;
    bounds: WindowBounds | null;
    samples: Array<{ x: number; y: number; t: number }>;
    pendingPos: { x: number; y: number } | null;
    updatingWindow: boolean;
  }>({
    active: false,
    hasMoved: false,
    startScreenX: 0,
    startScreenY: 0,
    startWinX: 0,
    startWinY: 0,
    bounds: null,
    samples: [],
    pendingPos: null,
    updatingWindow: false,
  });

  const spawnHearts = useCallback((count: number, centerRelX = 50, centerRelY = 22) => {
    const created: HeartParticle[] = [];
    for (let i = 0; i < count; i++) {
      const id = heartIdCounterRef.current++;
      const spreadX = (Math.random() - 0.5) * 38;
      const spreadY = (Math.random() - 0.5) * 14;
      created.push({
        id,
        x: Math.max(18, Math.min(82, centerRelX + spreadX)),
        y: Math.max(10, Math.min(42, centerRelY + spreadY)),
        size: 13 + Math.round(Math.random() * 9),
        driftX: (Math.random() - 0.5) * 34,
        duration: 950 + Math.round(Math.random() * 450),
      });
    }

    setHearts((prev) => [...prev.slice(-14), ...created]);

    const timerId = window.setTimeout(() => {
      const ids = new Set(created.map((c) => c.id));
      setHearts((prev) => prev.filter((h) => !ids.has(h.id)));
      heartCleanupTimersRef.current = heartCleanupTimersRef.current.filter((t) => t !== timerId);
    }, 1450);
    heartCleanupTimersRef.current.push(timerId);
  }, []);

  const triggerHappy = useCallback((durationMs = 4500) => {
    setIsHappy(true);
    if (happyTimerRef.current) {
      window.clearTimeout(happyTimerRef.current);
    }
    happyTimerRef.current = window.setTimeout(() => {
      setIsHappy(false);
      happyTimerRef.current = null;
    }, durationMs);
  }, []);

  const triggerDizzy = useCallback((durationMs = 2600) => {
    setIsDizzy(true);
    isDizzyRef.current = true;
    if (dizzyTimerRef.current) {
      window.clearTimeout(dizzyTimerRef.current);
    }
    dizzyTimerRef.current = window.setTimeout(() => {
      if (dragStateRef.current.active) return;
      setIsDizzy(false);
      isDizzyRef.current = false;
      dizzyEnergyRef.current = 0;
      setIsRecovering(true);
      if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = window.setTimeout(() => {
        setIsRecovering(false);
      }, 420);
    }, durationMs);
  }, []);

  // Robot is completely broken: stop all reactions and start the repair countdown
  const breakRobot = useCallback(() => {
    if (isBrokenRef.current) return;
    isBrokenRef.current = true;
    setIsBroken(true);
    setBrokenCountdown(BROKEN_REPAIR_SECONDS);
    setIsDizzy(false);
    isDizzyRef.current = false;
    setIsPatting(false);
    isPattingRef.current = false;
    setIdleAction('none');
    setGaze({ x: 0, y: 0 });
    recordPersonalityEvent('broken');
  }, []);

  const registerWallImpact = useCallback((impactSpeed: number) => {
    if (impactSpeed < 9.5 || isBrokenRef.current) return;
    lastImpactTimeRef.current = Date.now();
    recordPersonalityEvent('wall_impact', { impactSpeed });
    const gain = Math.round(Math.min(30, Math.max(16, impactSpeed * 0.52)));
    const prevFrust = frustrationRef.current;
    const nextFrust = Math.min(100, prevFrust + gain);
    frustrationRef.current = nextFrust;
    setFrustration(nextFrust);

    // Once it's already mad, every further wall hit slowly cracks it until it breaks
    if (prevFrust >= 40) {
      const dmgGain = prevFrust >= 80 ? 16 : prevFrust >= 60 ? 11 : 6;
      const nextDmg = Math.min(100, damageRef.current + dmgGain);
      damageRef.current = nextDmg;
      setDamage(nextDmg);
      if (nextDmg >= 100) {
        breakRobot();
      }
    }

    setIsImpactShaking(true);
    if (impactShakeTimerRef.current) {
      window.clearTimeout(impactShakeTimerRef.current);
    }
    impactShakeTimerRef.current = window.setTimeout(() => {
      setIsImpactShaking(false);
    }, 480);
  }, [breakRobot]);

  // Repair countdown while broken (AI is disabled until it reaches 0)
  useEffect(() => {
    if (!isBroken) return;
    const id = window.setInterval(() => {
      setBrokenCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isBroken]);

  useEffect(() => {
    onBrokenCountdownChangeRef.current?.(isBroken ? brokenCountdown : 0);
    if (isBroken && brokenCountdown <= 0) {
      // Fully repaired: reset damage and anger, shake it off
      recordPersonalityEvent('repaired');
      isBrokenRef.current = false;
      setIsBroken(false);
      damageRef.current = 0;
      setDamage(0);
      frustrationRef.current = 0;
      setFrustration(0);
      setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
      setIsRecovering(true);
      if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = window.setTimeout(() => setIsRecovering(false), 420);
    }
  }, [isBroken, brokenCountdown]);

  // Very slow self-healing of cracks when left calm for a minute (not while broken)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (isBrokenRef.current || damageRef.current <= 0) return;
      if (Date.now() - lastImpactTimeRef.current < 60_000) return;
      const next = Math.max(0, damageRef.current - 2);
      damageRef.current = next;
      setDamage(next);
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  // Keep a ref of "busy" so the random idle scheduler never interrupts real interactions
  useEffect(() => {
    idleBusyRef.current =
      isHovered ||
      isGrabbed ||
      isDragging ||
      isFlying ||
      isBroken ||
      isDizzy ||
      isPatting ||
      isLonelySad ||
      isWhiteBot ||
      frustration >= 20;
    autonomousBusyRef.current =
      isHovered ||
      isGrabbed ||
      isDragging ||
      isFlying ||
      isBroken ||
      isDizzy ||
      isPatting ||
      isLonelySad ||
      isWhiteBot;
  });

  // Completely randomized idle animations: happy, spin, hop, look around, or visit the cursor
  useEffect(() => {
    let timer = 0;
    const durations: Record<Exclude<IdleAction, 'none'>, number> = {
      happy: 2400,
      spin: 1100,
      hop: 950,
      look: 2600,
    };
    const run = () => {
      if (!idleBusyRef.current && !dragStateRef.current.active && !rafRef.current) {
        const choices = ['happy', 'spin', 'hop', 'look'] as const;
        const pick = choices[Math.floor(Math.random() * choices.length)];
        setIdleAction(pick);
        if (pick === 'look') {
          setGaze({ x: (Math.random() - 0.5) * 11, y: (Math.random() - 0.5) * 7 });
        }
        if (idleActionTimerRef.current) window.clearTimeout(idleActionTimerRef.current);
        idleActionTimerRef.current = window.setTimeout(() => {
          setIdleAction('none');
          if (pick === 'look') setGaze({ x: 0, y: 0 });
        }, durations[pick]);
      }
      timer = window.setTimeout(run, 6000 + Math.random() * 10000);
    };
    timer = window.setTimeout(run, 5000 + Math.random() * 6000);
    return () => {
      window.clearTimeout(timer);
      if (idleActionTimerRef.current) window.clearTimeout(idleActionTimerRef.current);
    };
  }, []);

  // Autonomous speech uses the existing status pill; it never opens chat or adds new UI.
  // When chat is already open, the same remark is forwarded into the existing message list.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        !onAutonomousRemarkRef.current ||
        autonomousBusyRef.current ||
        dragStateRef.current.active ||
        rafRef.current ||
        isBrokenRef.current
      ) return;
      if (Math.random() > 0.42) return;

      const remark = getAutonomousRemark();
      if (!remark) return;
      setAutonomousRemark(remark);
      onAutonomousRemarkRef.current?.(remark);
      if (autonomousRemarkTimerRef.current) window.clearTimeout(autonomousRemarkTimerRef.current);
      autonomousRemarkTimerRef.current = window.setTimeout(() => {
        setAutonomousRemark(null);
        autonomousRemarkTimerRef.current = null;
      }, 5200);
    }, 9000);

    return () => {
      window.clearInterval(interval);
      if (autonomousRemarkTimerRef.current) window.clearTimeout(autonomousRemarkTimerRef.current);
    };
  }, []);

  // Show conversational emotions briefly, then return to neutral white
  useEffect(() => {
    if (emotion === 'idle') {
      setConvEmotionActive(false);
      return;
    }
    setConvEmotionActive(true);
    const id = window.setTimeout(() => setConvEmotionActive(false), 9000);
    return () => window.clearTimeout(id);
  }, [emotion]);

  const triggerHeadPat = useCallback(
    (clientX?: number, clientY?: number) => {
      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      let relX = 50;
      let relY = 20;
      if (clientX !== undefined && clientY !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          relX = ((clientX - rect.left) / rect.width) * 100;
          relY = Math.min(34, ((clientY - rect.top) / rect.height) * 100);
        }
      }

      // Pats build affection and trust over repeated interactions, even if the robot is still calming down.
      recordPersonalityEvent('pat');
      // Gentle pats reduce frustration incrementally
      const nextFrustration = Math.max(0, frustrationRef.current - 8);
      frustrationRef.current = nextFrustration;
      setFrustration(nextFrustration);

      if (nextFrustration >= 20) {
        // Still mad, but show a tiny heart to indicate it's slowly calming down
        spawnHearts(1, relX, relY);
        return;
      }

      setIsPatting(true);
      isPattingRef.current = true;
      setPatBounceKey((k) => k + 1);
      lastBounceTimeRef.current = performance.now();
      spawnHearts(4, relX, relY);

      if (patTimerRef.current) {
        window.clearTimeout(patTimerRef.current);
      }
      patTimerRef.current = window.setTimeout(() => {
        setIsPatting(false);
        isPattingRef.current = false;
        hoverRubAccumRef.current = 0;
        triggerHappy(5000);
      }, 1400);
    },
    [spawnHearts, triggerHappy]
  );

  // Prevent refresh and right-click when broken
  useEffect(() => {
    const handleKeyDownBroken = (e: KeyboardEvent) => {
      if (isBroken) {
        if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    const handleContextMenuBroken = (e: MouseEvent) => {
      if (isBroken) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDownBroken, true);
    window.addEventListener('contextmenu', handleContextMenuBroken, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDownBroken, true);
      window.removeEventListener('contextmenu', handleContextMenuBroken, true);
    };
  }, [isBroken]);

  // Listen to Rust auto-glide events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<BotGlidePayload>('bot-glide', (event) => {
      if (dragStateRef.current.active || rafRef.current) return;
      const { active, vx, vy, screen_side, screen_vert } = event.payload;
      if (active) {
        setIsGliding(true);
        const speed = Math.hypot(vx, vy);
        const deg = Math.max(-22, Math.min(22, vx * 0.55));
        const stretch = Math.min(0.08, speed * 0.002);
        setTilt({
          deg,
          scaleX: 1 + stretch * 0.5,
          scaleY: 1 - stretch * 0.5,
        });
      } else {
        setIsGliding(false);
        setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
        const h = screen_side === 'left' ? 'left' : 'right';
        const v = screen_vert === 'up' ? 'up' : 'down';
        onScreenSideChangeRef.current?.(h, v);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (dizzyTimerRef.current) window.clearTimeout(dizzyTimerRef.current);
      if (patTimerRef.current) window.clearTimeout(patTimerRef.current);
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
      if (hoverLeaveTimerRef.current) window.clearTimeout(hoverLeaveTimerRef.current);
      if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
      if (impactShakeTimerRef.current) window.clearTimeout(impactShakeTimerRef.current);
      if (autonomousRemarkTimerRef.current) window.clearTimeout(autonomousRemarkTimerRef.current);
      heartCleanupTimersRef.current.forEach((t) => window.clearTimeout(t));
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

    const offsetLeft = rect ? rect.left * dpr : 0;
    const offsetTop = rect ? rect.top * dpr : 0;
    const botW = rect ? rect.width * dpr : size * dpr;
    const botH = rect ? rect.height * dpr : size * dpr;

    const margin = Math.round(16 * dpr);
    const taskbarMargin = Math.round(52 * dpr);

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

  const handlePointerEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    recordUserActivity();
    if (hoverLeaveTimerRef.current) {
      window.clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    lastHoverPosRef.current = { x: e.clientX, y: e.clientY };
    hoverRubAccumRef.current = 0;
    hoverHeartAccumRef.current = 0;
    hoverMoveAccumRef.current = 0;
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    lastHoverPosRef.current = null;
    hoverRubAccumRef.current = 0;
    hoverHeartAccumRef.current = 0;
    hoverMoveAccumRef.current = 0;
    setGaze({ x: 0, y: 0 });

    if (hoverLeaveTimerRef.current) window.clearTimeout(hoverLeaveTimerRef.current);
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 280);
  };

  // Broken robot drops to the bottom of the screen with gravity and a couple of small bounces
  const startBrokenFall = (bounds: WindowBounds, fromX: number, fromY: number) => {
    const safe = computeSafeWindowRange(bounds);
    let x = Math.max(safe.minWinX, Math.min(safe.maxWinX, fromX));
    let y = fromY;
    let vx = 0;
    let vy = 0;
    let bounces = 0;
    setIsFlying(true);
    setIsReturning(false);

    const step = () => {
      vy += 1.7;
      y += vy;
      x += vx;
      if (y >= safe.maxWinY) {
        y = safe.maxWinY;
        if (bounces < 2 && vy > 7) {
          vy = -vy * 0.3;
          vx = (Math.random() - 0.5) * 3;
          bounces++;
        } else {
          void invoke('set_window_pos', { x: Math.round(x), y: Math.round(y) });
          setIsFlying(false);
          onDragStateChange?.(false);
          setTilt({ deg: 0, scaleX: 1.04, scaleY: 0.96 });
          const monCenterX = bounds.monitor_x + bounds.monitor_width / 2;
          onScreenSideChangeRef.current?.(x < monCenterX ? 'left' : 'right', 'down');
          rafRef.current = null;
          return;
        }
      }
      setTilt({ deg: Math.min(24, vy * 0.9), scaleX: 1, scaleY: 1 });
      void invoke('set_window_pos', { x: Math.round(x), y: Math.round(y) });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const handlePointerDown = async (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    recordUserActivity();

    // While broken it can't be picked up; a click still opens the chat to show the countdown
    if (isBrokenRef.current) {
      onClick();
      return;
    }

    stopPhysics();
    e.currentTarget.setPointerCapture(e.pointerId);
    onDragStateChange?.(true);

    const now = performance.now();
    const isRapidFollowUpTap = now - lastTapTimeRef.current < 380;

    // Immediately acknowledge pickup with startled reaction unless continuing a rapid pat sequence
    if (!isRapidFollowUpTap && !isPattingRef.current) {
      setIsGrabbed(true);
      setTilt({ deg: 0, scaleX: 1.05, scaleY: 0.94 });
    }

    const screenX = e.screenX;
    const screenY = e.screenY;

    dragStateRef.current.active = true;
    dragStateRef.current.hasMoved = false;
    dragStateRef.current.startScreenX = screenX;
    dragStateRef.current.startScreenY = screenY;
    lastDragVelRef.current = { vx: 0, vy: 0 };

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
    recordUserActivity();
    const st = dragStateRef.current;

    // Update cursor gaze tracking and handle mouse-move petting / soothing when hovering and not dragging
    if (!st.active && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let relX = 50;
      let relY = 22;
      if (rect.width > 0 && rect.height > 0) {
        const normX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const normY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        setGaze({
          x: Math.max(-6, Math.min(6, normX * 5.5)),
          y: Math.max(-4.5, Math.min(4.5, normY * 4)),
        });
        relX = ((e.clientX - rect.left) / rect.width) * 100;
        relY = Math.min(34, ((e.clientY - rect.top) / rect.height) * 100);
      }

      if (lastHoverPosRef.current && !isDizzyRef.current && !isBrokenRef.current) {
        const moveDist = Math.hypot(
          e.clientX - lastHoverPosRef.current.x,
          e.clientY - lastHoverPosRef.current.y
        );
        lastHoverPosRef.current = { x: e.clientX, y: e.clientY };

        if (moveDist >= 1.5) {
          const stepDist = Math.min(moveDist, 26);

          if (frustrationRef.current >= 20) {
            // Robot is mad: moving mouse on top slowly calms it down toward liking you again
            const nextFrust = Math.max(
              0,
              Number((frustrationRef.current - stepDist * 0.068).toFixed(2))
            );
            frustrationRef.current = nextFrust;
            setFrustration(nextFrust);

            sootheHeartAccumRef.current += stepDist;
            if (sootheHeartAccumRef.current >= 195) {
              sootheHeartAccumRef.current = 0;
              spawnHearts(1, relX, relY);
            }
          } else {
            // Robot is not mad: clear any residual <20 frustration and accumulate petting into love
            if (frustrationRef.current > 0) {
              const nextFrust = Math.max(0, Number((frustrationRef.current - stepDist * 0.14).toFixed(2)));
              frustrationRef.current = nextFrust;
              setFrustration(nextFrust);
            }

            const nowMove = performance.now();
            const dtMove = nowMove - (lastHoverTimeRef.current || nowMove);
            lastHoverTimeRef.current = nowMove;

            if (dtMove < 350) {
              hoverPettingDurationRef.current += dtMove;
              hoverMoveAccumRef.current += stepDist;
              if (hoverMoveAccumRef.current >= 24 && !isPattingRef.current) {
                triggerHappy(4500);
              }
            }

            // Only trigger love after moving mouse around for a couple of seconds (>= 2000ms)
            if (hoverPettingDurationRef.current >= 2000) {
              if (!isPattingRef.current) {
                recordPersonalityEvent('gentle_hover');
                setIsPatting(true);
                isPattingRef.current = true;
                spawnHearts(4, relX, relY);
                const now = performance.now();
                if (now - lastBounceTimeRef.current > 750) {
                  lastBounceTimeRef.current = now;
                  setPatBounceKey((k) => k + 1);
                }
              } else {
                hoverHeartAccumRef.current += stepDist;
                if (hoverHeartAccumRef.current >= 110) {
                  hoverHeartAccumRef.current = 0;
    hoverMoveAccumRef.current = 0;
                  spawnHearts(2, relX, relY);
                  const now = performance.now();
                  if (now - lastBounceTimeRef.current > 900) {
                    lastBounceTimeRef.current = now;
                    setPatBounceKey((k) => k + 1);
                  }
                }
              }

              if (patTimerRef.current) {
                window.clearTimeout(patTimerRef.current);
              }
              patTimerRef.current = window.setTimeout(() => {
                setIsPatting(false);
                isPattingRef.current = false;
                hoverPettingDurationRef.current = 0;
                hoverRubAccumRef.current = 0;
        triggerHappy(5000);
                hoverHeartAccumRef.current = 0;
    hoverMoveAccumRef.current = 0;
              }, 1600);
            }
          }
        }
      } else {
        lastHoverPosRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (!st.active) return;

    const dxCss = e.screenX - st.startScreenX;
    const dyCss = e.screenY - st.startScreenY;

    if (!st.hasMoved && Math.hypot(dxCss, dyCss) > 5) {
      st.hasMoved = true;
      setIsDragging(true);
      setIsGrabbed(true);
      tapCountRef.current = 0;
      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
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

      const oldest = st.samples[0];
      const dt = Math.max(16, now - oldest.t);
      const vxDrag = ((newX - oldest.x) / dt) * 16.67;
      const vyDrag = ((newY - oldest.y) / dt) * 16.67;
      const dragSpeed = Math.hypot(vxDrag, vyDrag);

      // Accumulate dizziness when shaken rapidly, whipped back-and-forth, or dragged very fast
      const prevVx = lastDragVelRef.current.vx;
      const prevVy = lastDragVelRef.current.vy;
      const reversedX = prevVx * vxDrag < -35;
      const reversedY = prevVy * vyDrag < -35;
      lastDragVelRef.current = { vx: vxDrag, vy: vyDrag };

      if (dragSpeed > 18) {
        const reversalBonus = reversedX || reversedY ? 16 : 0;
        dizzyEnergyRef.current += (dragSpeed - 14) * 0.14 + reversalBonus;
        if (dizzyEnergyRef.current >= 95) {
          triggerDizzy(2700);
        } else if (isDizzyRef.current) {
          triggerDizzy(2700);
        }
      } else {
        dizzyEnergyRef.current = Math.max(0, dizzyEnergyRef.current - 0.8);
      }

      const stretch = Math.min(0.09, dragSpeed * 0.0018);
      setTilt({
        deg: Math.max(-24, Math.min(24, vxDrag * 0.45)),
        scaleX: 1 + stretch * 0.4,
        scaleY: 1 - stretch * 0.4,
      });

      st.pendingPos = { x: newX, y: newY };
      void flushWindowMove();
    } else if (st.hasMoved) {
      // Fallback when outside Tauri runtime (e.g. modal preview drag shake)
      const dragSpeed = Math.hypot(e.movementX, e.movementY);
      if (dragSpeed > 16) {
        dizzyEnergyRef.current += dragSpeed * 0.45;
        if (dizzyEnergyRef.current >= 95) {
          triggerDizzy(2700);
        }
      }
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

    setIsGrabbed(false);
    setIsDragging(false);

    // Handle click vs. gentle head-pat sequence when not dragged
    if (!st.hasMoved) {
      onDragStateChange?.(false);
      setTilt({ deg: 0, scaleX: 1, scaleY: 1 });

      const now = performance.now();
      if (now - lastTapTimeRef.current < 380) {
        tapCountRef.current += 1;
      } else {
        tapCountRef.current = 1;
      }
      lastTapTimeRef.current = now;

      if (tapCountRef.current >= 2 || isPattingRef.current) {
        triggerHeadPat(e.clientX, e.clientY);
        return;
      }

      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
      }
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        tapCountRef.current = 0;
        triggerHappy(4500);
        onClick();
      }, 220);
      return;
    }

    const bounds = st.bounds;
    if (!bounds) {
      onDragStateChange?.(false);
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

    // Very violent fling can also trigger dizziness
    if (throwSpeed > 52) {
      triggerDizzy(2700);
    }

    // Track whether this throw has already registered a boundary collision
    let hasCountedImpactThisThrow = false;
    if (isInitiallyOut && throwSpeed >= 12) {
      hasCountedImpactThisThrow = true;
      registerWallImpact(throwSpeed);
    }

    if (throwSpeed > 3.5 || isInitiallyOut) {
      setIsFlying(true);

      const stepPhysics = () => {
        // Broke mid-flight: hand off to the falling animation
        if (isBrokenRef.current) {
          rafRef.current = null;
          startBrokenFall(bounds, posX, posY);
          return;
        }

        posX += vx;
        posY += vy;

        vx *= 0.945;
        vy *= 0.945;

        const clampedX = Math.max(safeRange.minWinX, Math.min(safeRange.maxWinX, posX));
        const clampedY = Math.max(safeRange.minWinY, Math.min(safeRange.maxWinY, posY));
        const distOut = Math.hypot(posX - clampedX, posY - clampedY);
        const speed = Math.hypot(vx, vy);

        if (distOut > 1) {
          setIsReturning(true);
          if (!hasCountedImpactThisThrow && speed >= 9.5) {
            hasCountedImpactThisThrow = true;
            registerWallImpact(speed);
          }
          const springK = 0.14;
          vx += (clampedX - posX) * springK;
          vy += (clampedY - posY) * springK;
          vx *= 0.80;
          vy *= 0.80;
        } else {
          setIsReturning(false);
        }

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
          const dpr = bounds.scale_factor || window.devicePixelRatio || 1;
          const rect = containerRef.current?.getBoundingClientRect();
          const botCenterX = clampedX + (rect ? (rect.left + rect.width / 2) * dpr : bounds.width / 2);
          const botCenterY = clampedY + (rect ? (rect.top + rect.height / 2) * dpr : bounds.height / 2);
          const monCenterX = bounds.monitor_x + bounds.monitor_width / 2;
          const monCenterY = bounds.monitor_y + bounds.monitor_height / 2;

          void invoke('set_window_pos', {
            x: Math.round(clampedX),
            y: Math.round(clampedY),
          }).finally(() => {
            onScreenSideChangeRef.current?.(
              botCenterX < monCenterX ? 'left' : 'right',
              botCenterY < monCenterY ? 'up' : 'down'
            );
          });
          setIsFlying(false);
          setIsReturning(false);
          onDragStateChange?.(false);
          setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
          if (!isDizzyRef.current) {
            setIsRecovering(true);
            if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
            recoveryTimerRef.current = window.setTimeout(() => {
              setIsRecovering(false);
            }, 340);
          }
          rafRef.current = null;
          return;
        }

        rafRef.current = requestAnimationFrame(stepPhysics);
      };

      rafRef.current = requestAnimationFrame(stepPhysics);
    } else {
      onDragStateChange?.(false);
      setTilt({ deg: 0, scaleX: 1, scaleY: 1 });
      setIsRecovering(true);
      if (recoveryTimerRef.current) window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = window.setTimeout(() => {
        setIsRecovering(false);
      }, 280);

      const dpr = bounds.scale_factor || window.devicePixelRatio || 1;
      const rect = containerRef.current?.getBoundingClientRect();
      const botCenterX = posX + (rect ? (rect.left + rect.width / 2) * dpr : bounds.width / 2);
      const botCenterY = posY + (rect ? (rect.top + rect.height / 2) * dpr : bounds.height / 2);
      const monCenterX = bounds.monitor_x + bounds.monitor_width / 2;
      const monCenterY = bounds.monitor_y + bounds.monitor_height / 2;
      void invoke('set_window_pos', {
        x: Math.round(posX),
        y: Math.round(posY),
      }).finally(() => {
        onScreenSideChangeRef.current?.(
          botCenterX < monCenterX ? 'left' : 'right',
          botCenterY < monCenterY ? 'up' : 'down'
        );
      });
    }
  };

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 12 : -12;
    const next = Math.max(110, Math.min(320, size + delta));
    if (next !== size) {
      onResize(next, { clientX: e.clientX, clientY: e.clientY });
    }
  };

  // Resolve active visual emotion according to strict priority hierarchy
  const frustrationStage = getFrustrationStage(frustration);
  const crackStage: CrackStage = isBroken ? 4 : getCrackStage(damage);
  const idleBusy =
    isHovered ||
    isGrabbed ||
    isDragging ||
    isFlying ||
    isBroken ||
    isDizzy ||
    isPatting ||
    isLonelySad ||
    frustrationStage >= 1;
  const activeIdleAction: IdleAction = idleBusy ? 'none' : idleAction;

  // Neutral white by default. Conversational emotions only show briefly and never as sadness;
  // the robot only gets sad after being left alone for 15 minutes.
  const convEmotion: Emotion =
    convEmotionActive && emotion !== 'sadness' ? emotion : 'idle';

  let visualEmotion: VisualEmotion = convEmotion;
  if (isBroken) {
    visualEmotion = 'broken';
  } else if (isDizzy) {
    visualEmotion = 'dizzy';
  } else if (isGrabbed || isDragging || isFlying) {
    visualEmotion = frustrationStage >= 3 ? 'anger' : 'surprise';
  } else if (frustrationStage >= 1) {
    visualEmotion = 'anger';
  } else if (isPatting) {
    visualEmotion = 'love' as const;

  } else if (isHappy) {
    visualEmotion = 'joy';


  } else if (isWhiteBot) {
    visualEmotion = 'white-bot';


  } else if (activeIdleAction === 'happy') {
    visualEmotion = 'joy';

  } else if (activeIdleAction === 'look') {
    visualEmotion = 'curiosity';
  } else if (isLonelySad) {
    visualEmotion = 'sadness';
  }

  useEffect(() => {
    onVisualEmotionChangeRef.current?.(visualEmotion);
  }, [visualEmotion]);

  // Select coordinated face geometry
  let face: FaceConfig;
  if (visualEmotion === 'broken') {
    face = BROKEN_FACE;
  } else if (visualEmotion === 'white-bot') {
    face = WHITE_BOT_FACE;
  } else if (visualEmotion === 'dizzy') {
    face = {
      left: LEFT_SPIRAL_PATH,
      right: RIGHT_SPIRAL_PATH,
      leftBrow: 'M 62 74 Q 75 80 88 72',
      rightBrow: 'M 112 72 Q 125 80 138 74',
      mouth: 'M 83 118 Q 89 111 95 118 T 107 118 T 117 118',
    };
  } else if (!isPatting && !isGrabbed && frustrationStage >= 3) {
    face = FURIOUS_FACE;
  } else if (!isPatting && !isGrabbed && frustrationStage === 1) {
    face = ANNOYED_FACE;
  } else {
    face = EMOTION_FACES[visualEmotion as Emotion] || EMOTION_FACES.idle;
  }

  // Compute subtle hover tilt when not dragging/flying
  const hoverTiltDeg =
    isHovered && !isDragging && !isFlying && !isDizzy && !isBroken && frustrationStage < 2
      ? gaze.x * 0.75
      : 0;
  const activeTiltDeg = tilt.deg + hoverTiltDeg + (isBroken && !isFlying ? 14 : 0);

  // Status pill text
  let statusPillText: string | null = null;
  if (isBroken) {
    statusPillText = isFlying ? '💥 *FALLING*' : `🔧 Broken! Repairing... ${brokenCountdown}s`;
  } else if (isWhiteBot) {
    statusPillText = '💤 Resting... (15m idle)';
  } else if (isDizzy) {
    statusPillText = '🌀 So dizzy...';
  } else if (isPatting) {
    statusPillText = '💖 Hehe~';
  } else if (isHappy) {
    statusPillText = '✨ Yay~';
  } /*
  } else if (isPatting) {
    visualEmotion = 'love' as const;
    statusPillText = '💖 Hehe~';
  } else if (isHappy) {
    statusPillText = '✨ Yay~';

  } else if (isPatting) {
    visualEmotion = 'love' as const;

  } else if (isHappy) {
    visualEmotion = 'joy';

    statusPillText = '💖 Hehe~';
  */ else if (crackStage >= 2 && isImpactShaking) {
    statusPillText = crackStage >= 3 ? '💔 I\'m breaking!!' : '💥 *crack*';
  } else if (frustrationStage === 4 && (isImpactShaking || isReturning || isHovered)) {
    statusPillText = '💢 STOP THROWING ME!';
  } else if (frustrationStage === 3 && (isImpactShaking || isReturning)) {
    statusPillText = '😠 Watch it!';
  } else if (frustrationStage === 2 && isImpactShaking) {
    statusPillText = '😤 Hey!';
  } else if (isReturning) {
    statusPillText = 'Boomerang Return!';
  } else if (autonomousRemark) {
    statusPillText = autonomousRemark;
  }

  return (
    <div
      ref={containerRef}
      className={[
        'robot-container',
        `emotion-${visualEmotion}`,
        `frustration-stage-${frustrationStage}`,
        `crack-stage-${crackStage}`,
        activeIdleAction !== 'none' ? `idle-action-${activeIdleAction}` : '',
        isBroken ? 'is-broken' : '',
        isWhiteBot ? 'is-white-bot' : '',
        isGliding ? 'is-gliding' : '',
        isLonelySad ? 'is-lonely' : '',
        isGrabbed ? 'is-grabbed' : '',
        isDragging ? 'is-dragging' : '',
        isFlying ? 'is-flying' : '',
        isReturning ? 'is-returning' : '',
        isDizzy ? 'is-dizzy' : '',
        isPatting ? 'is-patting' : '',
        isHovered ? 'is-hovered' : '',
        isRecovering ? 'is-recovering' : '',
        isImpactShaking ? 'is-impact-shaking' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${activeTiltDeg}deg) scale(${tilt.scaleX}, ${tilt.scaleY})`,
      }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      title="Click to chat • Double-tap to pat head • Drag & flick to move • Scroll wheel to resize"
    >
      <div className="robot-glow-bg"></div>
      <div className="robot-glow-core"></div>

      {/* Floating Heart Particles for Head Pats & Affectionate Hover */}
      <div className="robot-hearts-layer" aria-hidden="true">
        {hearts.map((h) => (
          <svg
            key={h.id}
            className="floating-heart"
            viewBox="0 0 24 24"
            style={{
              left: `${h.x}%`,
              top: `${h.y}%`,
              width: `${h.size}px`,
              height: `${h.size}px`,
              '--heart-drift-x': `${h.driftX}px`,
              '--heart-duration': `${h.duration}ms`,
            } as CSSProperties}
          >
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#f472b6"
            />
          </svg>
        ))}
      </div>

      {statusPillText && <div className="robot-status-pill">{statusPillText}</div>}

      <svg
        key={patBounceKey > 0 ? `pat-${patBounceKey}` : 'base'}
        className={`robot-svg ${patBounceKey > 0 && isPatting ? 'pat-bounce-anim' : ''}`}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
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
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur2" />
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

        {/* Antenna Group */}
        <g className="robot-antenna-group">
          <rect x="95" y="12" width="10" height="36" rx="5" className="robot-antenna-stem" />
          <circle
            cx="100"
            cy="12"
            r="10"
            className="robot-antenna-bulb"
            filter="url(#antenna-bloom)"
          />
          {/* Orbiting stars when dizzy */}
          {visualEmotion === 'dizzy' && (
            <g className="dizzy-stars" filter="url(#neon-eye-glow)">
              <circle cx="72" cy="14" r="3.2" className="dizzy-star star-1" />
              <circle cx="128" cy="14" r="3.2" className="dizzy-star star-2" />
              <circle cx="100" cy="4" r="2.5" className="dizzy-star star-3" />
            </g>
          )}
        </g>

        <g className="robot-head-group">
          {/* Ear panels */}
          <rect x="24" y="80" width="20" height="40" rx="10" className="robot-ear left-ear" />
          <rect x="156" y="80" width="20" height="40" rx="10" className="robot-ear right-ear" />

          {/* Head */}
          <rect x="40" y="40" width="120" height="120" rx="35" className="robot-head" />

          {/* Comic anger vein symbol when frustration is high (stage 3 or 4) */}
          {frustrationStage >= 3 && !isDizzy && !isPatting && !isBroken && (
            <g className="anger-vein-mark" filter="url(#neon-eye-glow)">
              <path d="M 136 46 Q 142 52 136 58" />
              <path d="M 148 46 Q 142 52 148 58" />
              <path d="M 136 46 Q 142 52 148 46" />
              <path d="M 136 58 Q 142 52 148 58" />
            </g>
          )}

          {/* Screen Base */}
          <rect x="50" y="55" width="100" height="85" rx="20" className="robot-screen" />
          <rect x="50" y="55" width="100" height="85" rx="20" fill="url(#screen-glare)" opacity="0.85" />

          {/* Dynamic Glowing Eyes, Brows, Blush & Mouth */}
          <g
            className="eyes-container"
            filter="url(#neon-eye-glow)"
            style={{
              transform: `translate(${gaze.x}px, ${gaze.y}px)`,
            }}
          >
            {/* Cheek blush ovals */}
            {face.blush && (
              <g className="cheek-blush-group">
                <ellipse cx="64" cy="109" rx="9" ry="4.5" className="cheek-blush" />
                <ellipse cx="136" cy="109" rx="9" ry="4.5" className="cheek-blush" />
              </g>
            )}

            {/* Eyebrows */}
            {face.leftBrow && <path className="brow left-brow" d={face.leftBrow} />}
            {face.rightBrow && <path className="brow right-brow" d={face.rightBrow} />}

            {/* Eyes (X when broken, swirling spirals when dizzy, normal filled shapes otherwise) */}
            {visualEmotion === 'broken' ? (
              <>
                <path className="eye-broken" d={face.left} />
                <path className="eye-broken" d={face.right} />
              </>
            ) : visualEmotion === 'dizzy' ? (
              <>
                <path className="eye-spiral left-spiral" d={face.left} />
                <path className="eye-spiral right-spiral" d={face.right} />
              </>
            ) : (
              <>
                <path className="eye left-eye" d={face.left} />
                <path className="eye right-eye" d={face.right} />
              </>
            )}

            {/* Mouth */}
            {face.mouth && <path className="mouth" d={face.mouth} style={{ opacity: 1 }} />}

            {/* Sweat drop accent for fear / embarrassment */}
            {face.sweatDrop && (
              <path
                className="sweat-drop"
                d="M 141 68 C 141 68, 146 76, 146 80 A 5 5 0 1 1 136 80 C 136 76, 141 68, 141 68 Z"
              />
            )}
          </g>

          {/* Screen Glare Overlay */}


          {/* Cracks that slowly spread across the shell as it keeps hitting walls */}
          {crackStage >= 1 && (
            <g className="robot-cracks">
              <path d="M 52 62 L 61 70 L 57 78 L 67 87" />
              {crackStage >= 2 && <path d="M 148 66 L 139 75 L 144 83 L 135 93" />}
              {crackStage >= 3 && (
                <>
                  <path d="M 97 140 L 103 131 L 97 123 L 105 113" />
                  <path d="M 42 118 L 53 123 L 49 132" />
                </>
              )}
              {crackStage >= 4 && (
                <>
                  <path d="M 158 128 L 147 122 L 151 111" />
                  <path d="M 122 41 L 117 51 L 125 58 L 120 66" />
                  <path d="M 70 150 L 76 142 L 72 136" />
                </>
              )}
            </g>
          )}

          {/* Little sparks while broken */}
          {isBroken && !isFlying && (
            <g className="broken-sparks">
              <circle cx="58" cy="60" r="2.2" className="spark spark-1" />
              <circle cx="146" cy="70" r="1.8" className="spark spark-2" />
              <circle cx="104" cy="146" r="2" className="spark spark-3" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
