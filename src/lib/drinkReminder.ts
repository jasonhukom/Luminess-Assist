export interface DrinkReminderConfig {
  enabled: boolean;
  interval_minutes: number;
  snooze_minutes: number;
  daily_goal_glasses: number;
  daily_glasses: number;
  daily_date: string;
  sound_enabled: boolean;
  custom_message: string;
  last_reminded_at: number;
  snoozed_until: number;
}

export type DrinkCommandAction =
  | { type: 'enable'; intervalMinutes?: number; message?: string }
  | { type: 'disable' }
  | { type: 'log'; glasses: number }
  | { type: 'snooze'; minutes?: number }
  | { type: 'set_goal'; goal: number }
  | { type: 'status' };

const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 240;
const DEFAULT_INTERVAL_MINUTES = 45;
const DEFAULT_SNOOZE_MINUTES = 10;
const DEFAULT_DAILY_GOAL = 8;

export const DEFAULT_DRINK_MESSAGE =
  'Time to drink some water! Take a sip to stay hydrated.';

export function getLocalDateKey(nowMs: number = Date.now()): string {
  const date = new Date(nowMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function clampDrinkIntervalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_INTERVAL_MINUTES;
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(minutes)));
}

export function clampDrinkSnoozeMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_SNOOZE_MINUTES;
  return Math.min(60, Math.max(1, Math.round(minutes)));
}

export function clampDrinkGoal(glasses: number): number {
  if (!Number.isFinite(glasses)) return DEFAULT_DAILY_GOAL;
  return Math.min(24, Math.max(1, Math.round(glasses)));
}

export function createDefaultDrinkReminder(nowMs: number = Date.now()): DrinkReminderConfig {
  return {
    enabled: true,
    interval_minutes: DEFAULT_INTERVAL_MINUTES,
    snooze_minutes: DEFAULT_SNOOZE_MINUTES,
    daily_goal_glasses: DEFAULT_DAILY_GOAL,
    daily_glasses: 0,
    daily_date: getLocalDateKey(nowMs),
    sound_enabled: true,
    custom_message: DEFAULT_DRINK_MESSAGE,
    last_reminded_at: nowMs,
    snoozed_until: 0,
  };
}

export function normalizeDrinkReminderConfig(
  raw?: Partial<DrinkReminderConfig> | null,
  nowMs: number = Date.now()
): DrinkReminderConfig {
  const today = getLocalDateKey(nowMs);
  const defaults = createDefaultDrinkReminder(nowMs);
  if (!raw) return defaults;

  const sameDay = typeof raw.daily_date === 'string' && raw.daily_date === today;
  const rawLast = typeof raw.last_reminded_at === 'number' && Number.isFinite(raw.last_reminded_at)
    ? raw.last_reminded_at
    : 0;
  const rawSnooze = typeof raw.snoozed_until === 'number' && Number.isFinite(raw.snoozed_until)
    ? raw.snoozed_until
    : 0;

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    interval_minutes: clampDrinkIntervalMinutes(
      raw.interval_minutes ?? defaults.interval_minutes
    ),
    snooze_minutes: clampDrinkSnoozeMinutes(
      raw.snooze_minutes ?? defaults.snooze_minutes
    ),
    daily_goal_glasses: clampDrinkGoal(
      raw.daily_goal_glasses ?? defaults.daily_goal_glasses
    ),
    daily_glasses: sameDay && typeof raw.daily_glasses === 'number' && Number.isFinite(raw.daily_glasses)
      ? Math.max(0, Math.round(raw.daily_glasses))
      : 0,
    daily_date: today,
    sound_enabled: typeof raw.sound_enabled === 'boolean' ? raw.sound_enabled : defaults.sound_enabled,
    custom_message: typeof raw.custom_message === 'string' && raw.custom_message.trim()
      ? raw.custom_message.trim().slice(0, 140)
      : DEFAULT_DRINK_MESSAGE,
    last_reminded_at: rawLast > 0 ? rawLast : nowMs,
    snoozed_until: rawSnooze > 0 ? rawSnooze : 0,
  };
}

export function getNextDrinkDueMs(
  config: DrinkReminderConfig,
  nowMs: number = Date.now()
): number {
  const intervalMs = clampDrinkIntervalMinutes(config.interval_minutes) * 60_000;
  const baseLast = config.last_reminded_at > 0 ? config.last_reminded_at : nowMs;
  const scheduled = baseLast + intervalMs;
  const snoozeTarget = config.snoozed_until > 0 ? config.snoozed_until : 0;
  return Math.max(scheduled, snoozeTarget);
}

export function shouldTriggerDrinkReminder(
  config: DrinkReminderConfig,
  nowMs: number = Date.now()
): boolean {
  if (!config.enabled) return false;
  return nowMs >= getNextDrinkDueMs(config, nowMs);
}

export function formatCountdownMs(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Due now';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export function logDrinkGlass(
  config: DrinkReminderConfig,
  glassesToAdd: number = 1,
  nowMs: number = Date.now()
): DrinkReminderConfig {
  const normalized = normalizeDrinkReminderConfig(config, nowMs);
  const delta = Number.isFinite(glassesToAdd) ? Math.max(0, Math.round(glassesToAdd)) : 1;
  return {
    ...normalized,
    daily_glasses: normalized.daily_glasses + delta,
    daily_date: getLocalDateKey(nowMs),
    last_reminded_at: nowMs,
    snoozed_until: 0,
  };
}

export function snoozeDrinkReminder(
  config: DrinkReminderConfig,
  minutes?: number,
  nowMs: number = Date.now()
): DrinkReminderConfig {
  const normalized = normalizeDrinkReminderConfig(config, nowMs);
  const snoozeMins = clampDrinkSnoozeMinutes(minutes ?? normalized.snooze_minutes);
  return {
    ...normalized,
    snooze_minutes: snoozeMins,
    snoozed_until: nowMs + snoozeMins * 60_000,
  };
}

export function playGentleWaterChime(): void {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [
      { freq: 1046.5, start: 0, dur: 0.16 }, // C6
      { freq: 1567.98, start: 0.11, dur: 0.28 }, // G6
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.055, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.02);
    }

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 650);
  } catch {
    // Ignore autoplay or Web Audio restrictions.
  }
}

export function parseDrinkReminderCommand(input: string): DrinkCommandAction | null {
  const text = input.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const mentionsHydration =
    /\b(drink|water|hydrate|hydration|glass(?:es)?|sip|minum|air)\b/i.test(lower);
  if (!mentionsHydration) return null;

  if (/\b(stop|disable|pause|turn off|mute|matikan|hentikan)\b/i.test(lower)) {
    return { type: 'disable' };
  }

  if (/\b(snooze|later|nanti|tunda)\b/i.test(lower)) {
    const minMatch = lower.match(/(\d+)\s*(?:m|min|mins|minute|minutes|menit)\b/i);
    return {
      type: 'snooze',
      minutes: minMatch ? Number(minMatch[1]) : undefined,
    };
  }

  if (/\b(goal|target)\b/i.test(lower)) {
    const goalMatch = lower.match(/(\d+)\s*(?:glass|glasses|cup|cups|gelas)?\b/i);
    if (goalMatch) {
      return { type: 'set_goal', goal: Number(goalMatch[1]) };
    }
  }

  if (
    /\b(i\s+drank|drank|had\s+(?:a\s+)?(?:glass|water|sip)|log\s+(?:a\s+)?(?:glass|water|drink)|sudah\s+minum)\b/i.test(
      lower
    ) ||
    /^\s*(?:\+1\s+)?(?:drank|water\s+logged)\s*$/i.test(lower)
  ) {
    const countMatch = lower.match(/(\d+)\s*(?:glass|glasses|cup|cups|gelas)\b/i);
    return { type: 'log', glasses: countMatch ? Number(countMatch[1]) : 1 };
  }

  if (/\b(status|how\s+much|how\s+many|count|progress|countdown|when\s+(?:is|next))\b/i.test(lower)) {
    return { type: 'status' };
  }

  if (/\b(remind|reminder|set|every|enable|start|turn on|ingatkan|setel|tiap)\b/i.test(lower)) {
    const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|jam)\b/i);
    const minMatch = lower.match(/(\d+)\s*(?:m|min|mins|minute|minutes|menit)\b/i);
    let intervalMinutes: number | undefined;
    if (minMatch) {
      intervalMinutes = Number(minMatch[1]);
    } else if (hourMatch) {
      intervalMinutes = Math.round(Number(hourMatch[1]) * 60);
    }
    return { type: 'enable', intervalMinutes };
  }

  return null;
}
