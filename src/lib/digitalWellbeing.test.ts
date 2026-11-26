import { describe, expect, it } from 'vitest';
import {
  buildRecentRealAppsList,
  buildWellbeingRangeReport,
  createEmptyWellbeingHistory,
  formatBytesMem,
  formatWellbeingDuration,
  isLuminessSelfApp,
  isRealUserApplication,
  parseWellbeingCommand,
  pruneWellbeingHistory90Days,
  recordForegroundUsageSample,
  resolveAppProfile,
} from './digitalWellbeing';

describe('digitalWellbeing', () => {
  it('resolves known apps into clean display names and categories', () => {
    expect(resolveAppProfile('Code.exe')).toEqual({
      appKey: 'code.exe',
      displayName: 'Visual Studio Code',
      category: 'Development',
    });
    expect(resolveAppProfile('chrome.exe')).toEqual({
      appKey: 'chrome.exe',
      displayName: 'Google Chrome',
      category: 'Browser',
    });
  });

  it('records foreground samples, ignores idle samples, and auto-deletes data older than 90 days', () => {
    const today = new Date(2026, 10, 26, 14, 0, 0).getTime();
    let store = createEmptyWellbeingHistory(today);

    // Inject an expired 95-day-old entry + a valid 80-day-old entry
    store.days['2026-08-23'] = {
      date: '2026-08-23',
      total_seconds: 500,
      apps: {},
    };
    store.days['2026-09-08'] = {
      date: '2026-09-08',
      total_seconds: 300,
      apps: {},
    };

    // Idle sample must NOT add seconds
    store = recordForegroundUsageSample(
      store,
      {
        pid: 123,
        exe_name: 'chrome.exe',
        process_name: 'chrome',
        window_title: 'Docs',
        is_idle: true,
        idle_seconds: 350,
        sampled_at_ms: today,
      },
      10,
      today
    );
    expect(store.days['2026-11-26']).toBeUndefined();
    expect(store.days['2026-08-23']).toBeUndefined(); // purged (> 90 days old)
    expect(store.days['2026-09-08']?.total_seconds).toBe(300);

    // Active sample records cleanly
    store = recordForegroundUsageSample(
      store,
      {
        pid: 456,
        exe_name: 'Code.exe',
        process_name: 'Code',
        window_title: 'App.tsx - Luminess',
        is_idle: false,
        idle_seconds: 2,
        sampled_at_ms: today,
      },
      12,
      today
    );

    const pruned = pruneWellbeingHistory90Days(store, today);
    expect(pruned.days['2026-11-26']?.total_seconds).toBe(12);
    expect(pruned.days['2026-11-26']?.apps['code.exe']?.seconds).toBe(12);
  });

  it('builds day, week, and month reports with circle slices and explanations', () => {
    const today = new Date(2026, 10, 26, 14, 0, 0).getTime();
    const yesterday = today - 86_400_000;
    let store = createEmptyWellbeingHistory(today);

    store = recordForegroundUsageSample(
      store,
      {
        pid: 10,
        exe_name: 'Code.exe',
        process_name: 'Code',
        window_title: 'Editor',
        is_idle: false,
        idle_seconds: 0,
        sampled_at_ms: yesterday,
      },
      60,
      yesterday
    );

    store = recordForegroundUsageSample(
      store,
      {
        pid: 20,
        exe_name: 'chrome.exe',
        process_name: 'chrome',
        window_title: 'Research',
        is_idle: false,
        idle_seconds: 0,
        sampled_at_ms: today,
      },
      40,
      today
    );

    const dayReport = buildWellbeingRangeReport(store, 'day', today);
    expect(dayReport.total_seconds).toBe(40);
    expect(dayReport.chart_slices[0].display_name).toBe('Google Chrome');

    const weekReport = buildWellbeingRangeReport(store, 'week', today);
    expect(weekReport.date_keys).toHaveLength(7);
    expect(weekReport.total_seconds).toBe(100);
    expect(weekReport.active_days).toBe(2);
    expect(weekReport.chart_slices[0].display_name).toBe('Visual Studio Code');
    expect(weekReport.overall_explanation).toContain('90 days');

    const monthReport = buildWellbeingRangeReport(store, 'month', today);
    expect(monthReport.date_keys).toHaveLength(30);
    expect(monthReport.total_seconds).toBe(100);
  });

  it('formats durations, memory bytes, and natural chat commands cleanly', () => {
    expect(formatWellbeingDuration(45)).toBe('45s');
    expect(formatWellbeingDuration(5400)).toBe('1h 30m');
    expect(formatBytesMem(512 * 1024 * 1024)).toBe('512 MB');
    expect(formatBytesMem(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');

    expect(parseWellbeingCommand('open digital wellbeing')).toEqual({
      type: 'open',
      tab: 'wellbeing',
      range: 'day',
    });
    expect(parseWellbeingCommand('show task manager')).toEqual({
      type: 'open',
      tab: 'taskmanager',
    });
    expect(parseWellbeingCommand('how much screen time this week?')).toEqual({
      type: 'summary',
      range: 'week',
    });
  });

  it('filters out system processes and returns up to 5 real recent apps', () => {
    expect(isRealUserApplication('svchost.exe', 'C:\\Windows\\System32\\svchost.exe')).toBe(false);
    expect(isRealUserApplication('RuntimeBroker.exe', 'C:\\Windows\\System32\\RuntimeBroker.exe')).toBe(false);
    expect(isRealUserApplication('explorer.exe', 'C:\\Windows\\explorer.exe')).toBe(false);
    expect(isRealUserApplication('Luminess Assist.exe', 'C:\\Program Files\\Luminess\\Luminess Assist.exe')).toBe(false);
    expect(isRealUserApplication('Code.exe', 'C:\\Program Files\\Microsoft VS Code\\Code.exe')).toBe(true);

    const today = new Date(2026, 10, 26, 14, 0, 0).getTime();
    let store = createEmptyWellbeingHistory(today);
    // System noise entry that should be excluded from Recent Apps
    store = recordForegroundUsageSample(
      store,
      {
        pid: 1,
        exe_name: 'SearchHost.exe',
        exe_path: 'C:\\Windows\\SystemApps\\SearchHost.exe',
        process_name: 'SearchHost',
        window_title: 'Search',
        is_idle: false,
        idle_seconds: 0,
        sampled_at_ms: today,
      },
      25,
      today
    );
    // Real apps
    for (const [idx, exe] of ['Code.exe', 'chrome.exe', 'Discord.exe'].entries()) {
      store = recordForegroundUsageSample(
        store,
        {
          pid: 100 + idx,
          exe_name: exe,
          exe_path: `C:\\Apps\\${exe}`,
          process_name: exe.replace('.exe', ''),
          window_title: exe,
          is_idle: false,
          idle_seconds: 0,
          sampled_at_ms: today + idx * 1000,
        },
        30,
        today
      );
    }

    const recent = buildRecentRealAppsList(
      store,
      [
        {
          app_key: 'spotify.exe',
          name: 'Spotify',
          exe_name: 'Spotify.exe',
          launch_target: 'C:\\Apps\\Spotify.lnk',
          window_title: '',
        },
        {
          app_key: 'obsidian.exe',
          name: 'Obsidian',
          exe_name: 'Obsidian.exe',
          launch_target: 'C:\\Apps\\Obsidian.lnk',
          window_title: '',
        },
        {
          app_key: 'figma.exe',
          name: 'Figma',
          exe_name: 'Figma.exe',
          launch_target: 'C:\\Apps\\Figma.lnk',
          window_title: '',
        },
      ],
      5
    );

    expect(recent).toHaveLength(5);
    expect(recent.map((r) => r.app_key)).not.toContain('searchhost.exe');
    expect(recent[0].app_key).toBe('discord.exe');
  });

  it('never records or reports Luminess Assist itself in digital wellbeing', () => {
    const today = new Date(2026, 10, 26, 14, 0, 0).getTime();
    expect(isLuminessSelfApp('Luminess Assist.exe')).toBe(true);
    expect(isLuminessSelfApp('luminess-assist.exe')).toBe(true);
    expect(isLuminessSelfApp('app.exe')).toBe(true);
    expect(isLuminessSelfApp('Code.exe', 'C:\\Apps\\Code.exe', 'Visual Studio Code')).toBe(false);

    let store = createEmptyWellbeingHistory(today);
    store = recordForegroundUsageSample(
      store,
      {
        pid: 999,
        exe_name: 'Luminess Assist.exe',
        exe_path: 'C:\\Program Files\\Luminess Assist\\Luminess Assist.exe',
        process_name: 'Luminess Assist',
        window_title: 'Luminess',
        is_idle: false,
        idle_seconds: 0,
        sampled_at_ms: today,
      },
      30,
      today
    );
    expect(store.days['2026-11-26']).toBeUndefined();

    // Historical Luminess entries should be scrubbed cleanly on prune/report
    store.days['2026-11-26'] = {
      date: '2026-11-26',
      total_seconds: 90,
      apps: {
        'luminess assist.exe': {
          app_key: 'luminess assist.exe',
          display_name: 'Luminess Assist',
          category: 'Productivity',
          seconds: 40,
          last_title: 'Luminess',
          exe_path: '',
          last_seen_ms: today,
        },
        'code.exe': {
          app_key: 'code.exe',
          display_name: 'Visual Studio Code',
          category: 'Development',
          seconds: 50,
          last_title: 'App.tsx - Luminess',
          exe_path: 'C:\\Apps\\Code.exe',
          last_seen_ms: today,
        },
      },
    };

    const pruned = pruneWellbeingHistory90Days(store, today);
    expect(pruned.days['2026-11-26']?.total_seconds).toBe(50);
    expect(pruned.days['2026-11-26']?.apps['luminess assist.exe']).toBeUndefined();

    const report = buildWellbeingRangeReport(store, 'day', today);
    expect(report.total_seconds).toBe(50);
    expect(report.all_apps.map((a) => a.app_key)).toEqual(['code.exe']);
  });
});
