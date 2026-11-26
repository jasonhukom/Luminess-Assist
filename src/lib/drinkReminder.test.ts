import { describe, expect, it } from 'vitest';
import {
  clampDrinkIntervalMinutes,
  createDefaultDrinkReminder,
  formatCountdownMs,
  getLocalDateKey,
  getNextDrinkDueMs,
  logDrinkGlass,
  normalizeDrinkReminderConfig,
  parseDrinkReminderCommand,
  shouldTriggerDrinkReminder,
  snoozeDrinkReminder,
} from './drinkReminder';

describe('drinkReminder', () => {
  it('creates enabled defaults with safe bounds', () => {
    const now = new Date(2026, 10, 26, 10, 0, 0).getTime();
    const cfg = createDefaultDrinkReminder(now);
    expect(cfg.enabled).toBe(true);
    expect(cfg.interval_minutes).toBe(45);
    expect(cfg.daily_goal_glasses).toBe(8);
    expect(cfg.daily_glasses).toBe(0);
    expect(cfg.daily_date).toBe(getLocalDateKey(now));
    expect(cfg.last_reminded_at).toBe(now);
  });

  it('resets daily glass counter when date changes and clamps interval', () => {
    const today = new Date(2026, 10, 26, 9, 0, 0).getTime();
    const normalized = normalizeDrinkReminderConfig(
      {
        enabled: true,
        interval_minutes: 1,
        daily_glasses: 6,
        daily_date: '2026-11-25',
        last_reminded_at: 0,
      },
      today
    );

    expect(normalized.interval_minutes).toBe(clampDrinkIntervalMinutes(1));
    expect(normalized.interval_minutes).toBe(5);
    expect(normalized.daily_glasses).toBe(0);
    expect(normalized.daily_date).toBe(getLocalDateKey(today));
    expect(normalized.last_reminded_at).toBe(today);
  });

  it('evaluates trigger timing and respects snooze', () => {
    const start = 1_000_000;
    const cfg = createDefaultDrinkReminder(start);

    expect(shouldTriggerDrinkReminder(cfg, start + 10_000)).toBe(false);
    expect(shouldTriggerDrinkReminder(cfg, start + 45 * 60_000)).toBe(true);

    const snoozed = snoozeDrinkReminder(cfg, 15, start + 45 * 60_000);
    expect(shouldTriggerDrinkReminder(snoozed, start + 50 * 60_000)).toBe(false);
    expect(shouldTriggerDrinkReminder(snoozed, start + 60 * 60_000)).toBe(true);
    expect(getNextDrinkDueMs(snoozed, start)).toBe(start + 60 * 60_000);
  });

  it('logs glasses and resets reminder timer + snooze', () => {
    const start = 2_000_000;
    const base = snoozeDrinkReminder(createDefaultDrinkReminder(start), 10, start);
    const afterLog = logDrinkGlass(base, 2, start + 5000);

    expect(afterLog.daily_glasses).toBe(2);
    expect(afterLog.snoozed_until).toBe(0);
    expect(afterLog.last_reminded_at).toBe(start + 5000);
  });

  it('formats countdowns cleanly', () => {
    expect(formatCountdownMs(0)).toBe('Due now');
    expect(formatCountdownMs(35_000)).toBe('35s');
    expect(formatCountdownMs(125_000)).toBe('2m 05s');
    expect(formatCountdownMs(3_900_000)).toBe('1h 05m');
  });

  it('parses natural drink reminder phrases accurately', () => {
    expect(parseDrinkReminderCommand('remind me to drink water every 30 minutes')).toEqual({
      type: 'enable',
      intervalMinutes: 30,
    });
    expect(parseDrinkReminderCommand('remind me to drink every 2 hours')).toEqual({
      type: 'enable',
      intervalMinutes: 120,
    });
    expect(parseDrinkReminderCommand('pause drink reminder')).toEqual({ type: 'disable' });
    expect(parseDrinkReminderCommand('I drank 2 glasses of water')).toEqual({
      type: 'log',
      glasses: 2,
    });
    expect(parseDrinkReminderCommand('snooze water reminder for 15 min')).toEqual({
      type: 'snooze',
      minutes: 15,
    });
    expect(parseDrinkReminderCommand('set daily water goal to 10 glasses')).toEqual({
      type: 'set_goal',
      goal: 10,
    });
    expect(parseDrinkReminderCommand('how much water did I drink today?')).toEqual({
      type: 'status',
    });
    expect(parseDrinkReminderCommand('open chrome')).toBeNull();
  });
});
