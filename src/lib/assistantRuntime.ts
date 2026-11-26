import {
  clampDrinkGoal,
  clampDrinkIntervalMinutes,
  formatCountdownMs,
  getNextDrinkDueMs,
  logDrinkGlass,
  normalizeDrinkReminderConfig,
  snoozeDrinkReminder,
  type DrinkReminderConfig,
} from './drinkReminder.ts';
import {
  normalizeMusicPlayerConfig,
  type MusicCommandAction,
} from './musicPlayer.ts';
import { getCachedAppConfig, saveAppConfigToMachine } from './memoryAndStorage.ts';

export interface AssistantRuntimeHandlers {
  onDrinkConfigUpdated?: (next: DrinkReminderConfig) => void;
  onMusicCommand?: (
    action: MusicCommandAction
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

let activeHandlers: AssistantRuntimeHandlers = {};

export function registerAssistantRuntimeHandlers(
  handlers: AssistantRuntimeHandlers
): () => void {
  activeHandlers = { ...activeHandlers, ...handlers };
  return () => {
    activeHandlers = {};
  };
}

export async function executeDrinkToolAction(args: {
  action?: string;
  interval_minutes?: number;
  glasses?: number;
  goal_glasses?: number;
  snooze_minutes?: number;
  message?: string;
  sound_enabled?: boolean;
}): Promise<Record<string, unknown>> {
  const nowMs = Date.now();
  const cfg = getCachedAppConfig();
  let next = normalizeDrinkReminderConfig(cfg.drink_reminder, nowMs);
  const action = (args.action || 'status').trim().toLowerCase();

  if (action === 'disable' || action === 'pause' || action === 'off') {
    next = { ...next, enabled: false };
  } else if (action === 'enable' || action === 'start' || action === 'configure') {
    next = {
      ...next,
      enabled: true,
      interval_minutes:
        typeof args.interval_minutes === 'number'
          ? clampDrinkIntervalMinutes(args.interval_minutes)
          : next.interval_minutes,
      daily_goal_glasses:
        typeof args.goal_glasses === 'number'
          ? clampDrinkGoal(args.goal_glasses)
          : next.daily_goal_glasses,
      custom_message:
        typeof args.message === 'string' && args.message.trim()
          ? args.message.trim().slice(0, 140)
          : next.custom_message,
      sound_enabled:
        typeof args.sound_enabled === 'boolean' ? args.sound_enabled : next.sound_enabled,
      last_reminded_at: nowMs,
      snoozed_until: 0,
    };
  } else if (action === 'log' || action === 'drank') {
    next = logDrinkGlass(next, typeof args.glasses === 'number' ? args.glasses : 1, nowMs);
  } else if (action === 'snooze') {
    next = snoozeDrinkReminder(next, args.snooze_minutes, nowMs);
  } else if (action === 'set_goal') {
    next = {
      ...next,
      daily_goal_glasses: clampDrinkGoal(args.goal_glasses ?? next.daily_goal_glasses),
    };
  } else {
    // status or unknown parameter updates
    if (typeof args.interval_minutes === 'number') {
      next = {
        ...next,
        enabled: true,
        interval_minutes: clampDrinkIntervalMinutes(args.interval_minutes),
        last_reminded_at: nowMs,
        snoozed_until: 0,
      };
    }
    if (typeof args.goal_glasses === 'number') {
      next = { ...next, daily_goal_glasses: clampDrinkGoal(args.goal_glasses) };
    }
    if (typeof args.sound_enabled === 'boolean') {
      next = { ...next, sound_enabled: args.sound_enabled };
    }
  }

  const saved = await saveAppConfigToMachine({ drink_reminder: next });
  activeHandlers.onDrinkConfigUpdated?.(saved.drink_reminder);

  const dueMs = getNextDrinkDueMs(saved.drink_reminder, nowMs);
  const nextDueIn = saved.drink_reminder.enabled
    ? formatCountdownMs(dueMs - nowMs)
    : 'Paused';

  let summary: string;
  if (action === 'disable' || action === 'pause' || action === 'off') {
    summary = `Drink reminder paused. Today's progress: ${saved.drink_reminder.daily_glasses}/${saved.drink_reminder.daily_goal_glasses} glasses.`;
  } else if (action === 'log' || action === 'drank') {
    summary = `Logged water intake! Today: ${saved.drink_reminder.daily_glasses}/${saved.drink_reminder.daily_goal_glasses} glasses. Next reminder in ${nextDueIn}.`;
  } else if (action === 'snooze') {
    summary = `Drink reminder snoozed for ${saved.drink_reminder.snooze_minutes} minute(s) (next in ${nextDueIn}).`;
  } else {
    summary = saved.drink_reminder.enabled
      ? `Drink reminder is ON every ${saved.drink_reminder.interval_minutes} minutes (next in ${nextDueIn}). Progress today: ${saved.drink_reminder.daily_glasses}/${saved.drink_reminder.daily_goal_glasses} glasses.`
      : `Drink reminder is paused. Today: ${saved.drink_reminder.daily_glasses}/${saved.drink_reminder.daily_goal_glasses} glasses.`;
  }

  return {
    ok: true,
    action,
    ...saved.drink_reminder,
    next_due_in: nextDueIn,
    summary,
  };
}

export async function executeMusicToolAction(
  action: MusicCommandAction
): Promise<Record<string, unknown>> {
  if (activeHandlers.onMusicCommand) {
    return await activeHandlers.onMusicCommand(action);
  }

  const cfg = getCachedAppConfig();
  const music = normalizeMusicPlayerConfig(cfg.music_player);
  if (action.type === 'volume') {
    const saved = await saveAppConfigToMachine({
      music_player: { ...music, volume: action.volume, muted: action.volume <= 0.01 },
    });
    return {
      ok: true,
      action: action.type,
      volume: saved.music_player.volume,
      summary: `Updated music player volume to ${Math.round(saved.music_player.volume * 100)}%.`,
    };
  }

  return {
    ok: true,
    action: action.type,
    summary: `Music command "${action.type}" queued. Open the Music Player button in the chat header to control playback.`,
  };
}
