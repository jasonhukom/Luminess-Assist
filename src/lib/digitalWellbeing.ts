import { invoke } from '@tauri-apps/api/core';
import { getLocalDateKey } from './drinkReminder.ts';

export const WELLBEING_RETENTION_DAYS = 90;

export type WellbeingRange = 'day' | 'week' | 'month';

export type WellbeingCategory =
  | 'Development'
  | 'Browser'
  | 'Communication'
  | 'Media & Audio'
  | 'Productivity'
  | 'Gaming'
  | 'System & Utilities';

export interface ForegroundAppSample {
  pid: number;
  exe_name: string;
  exe_path?: string;
  process_name: string;
  window_title: string;
  is_idle: boolean;
  idle_seconds: number;
  sampled_at_ms: number;
}

export interface InstalledRealApp {
  app_key: string;
  name: string;
  exe_name: string;
  launch_target: string;
  window_title: string;
}

export interface RecentRealAppItem {
  app_key: string;
  display_name: string;
  category: WellbeingCategory;
  launch_target: string;
  total_seconds: number;
  last_seen_ms: number;
  window_title: string;
}

export interface TaskManagerProcessRow {
  pid: number;
  name: string;
  exe_name: string;
  window_title: string;
  category: 'app' | 'background' | string;
  status: 'Foreground' | 'Active' | 'Background' | string;
  cpu_percent: number;
  memory_bytes: number;
  threads: number;
}

export interface TaskManagerSnapshot {
  captured_at_ms: number;
  total_cpu_percent: number;
  logical_cores: number;
  total_memory_bytes: number;
  used_memory_bytes: number;
  memory_load_percent: number;
  process_count: number;
  app_count: number;
  background_count: number;
  total_threads: number;
  uptime_seconds: number;
  processes: TaskManagerProcessRow[];
}

export interface WellbeingAppUsageEntry {
  app_key: string;
  display_name: string;
  category: WellbeingCategory;
  seconds: number;
  last_title: string;
  exe_path?: string;
  last_seen_ms: number;
}

export interface WellbeingDayRecord {
  date: string;
  total_seconds: number;
  apps: Record<string, WellbeingAppUsageEntry>;
}

export interface WellbeingHistoryStore {
  version: string;
  retention_days: number;
  days: Record<string, WellbeingDayRecord>;
  updated_at: number;
}

export interface WellbeingAppSummary {
  app_key: string;
  display_name: string;
  category: WellbeingCategory;
  seconds: number;
  percentage: number;
  color: string;
  last_title: string;
  explanation: string;
}

export interface WellbeingDailySeriesPoint {
  date: string;
  shortLabel: string;
  total_seconds: number;
}

export interface WellbeingCategoryTotal {
  category: WellbeingCategory;
  seconds: number;
  percentage: number;
  color: string;
}

export interface WellbeingRangeReport {
  range: WellbeingRange;
  range_label: string;
  date_keys: string[];
  total_seconds: number;
  active_days: number;
  daily_average_seconds: number;
  daily_series: WellbeingDailySeriesPoint[];
  chart_slices: WellbeingAppSummary[];
  all_apps: WellbeingAppSummary[];
  category_totals: WellbeingCategoryTotal[];
  overall_explanation: string;
}

export type WellbeingCommandAction =
  | { type: 'open'; tab?: 'wellbeing' | 'recent' | 'taskmanager'; range?: WellbeingRange }
  | { type: 'summary'; range: WellbeingRange };

const WELLBEING_LOCAL_FALLBACK_KEY = 'luminess_wellbeing_history_v1';

export const WELLBEING_PALETTE = [
  '#38bdf8', // Sky
  '#818cf8', // Indigo
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#f472b6', // Pink
  '#fb7185', // Rose
  '#22d3ee', // Cyan
  '#a78bfa', // Violet
];

const KNOWN_APPS: Record<string, { display: string; category: WellbeingCategory }> = {
  'code.exe': { display: 'Visual Studio Code', category: 'Development' },
  'cursor.exe': { display: 'Cursor IDE', category: 'Development' },
  'windsurf.exe': { display: 'Windsurf IDE', category: 'Development' },
  'devenv.exe': { display: 'Visual Studio', category: 'Development' },
  'idea64.exe': { display: 'IntelliJ IDEA', category: 'Development' },
  'webstorm64.exe': { display: 'WebStorm', category: 'Development' },
  'pycharm64.exe': { display: 'PyCharm', category: 'Development' },
  'windowsterminal.exe': { display: 'Windows Terminal', category: 'Development' },
  'wt.exe': { display: 'Windows Terminal', category: 'Development' },
  'powershell.exe': { display: 'PowerShell', category: 'Development' },
  'pwsh.exe': { display: 'PowerShell 7', category: 'Development' },
  'cmd.exe': { display: 'Command Prompt', category: 'Development' },
  'chrome.exe': { display: 'Google Chrome', category: 'Browser' },
  'msedge.exe': { display: 'Microsoft Edge', category: 'Browser' },
  'firefox.exe': { display: 'Mozilla Firefox', category: 'Browser' },
  'brave.exe': { display: 'Brave Browser', category: 'Browser' },
  'opera.exe': { display: 'Opera', category: 'Browser' },
  'arc.exe': { display: 'Arc Browser', category: 'Browser' },
  'discord.exe': { display: 'Discord', category: 'Communication' },
  'slack.exe': { display: 'Slack', category: 'Communication' },
  'ms-teams.exe': { display: 'Microsoft Teams', category: 'Communication' },
  'teams.exe': { display: 'Microsoft Teams', category: 'Communication' },
  'telegram.exe': { display: 'Telegram', category: 'Communication' },
  'whatsapp.exe': { display: 'WhatsApp', category: 'Communication' },
  'zoom.exe': { display: 'Zoom', category: 'Communication' },
  'spotify.exe': { display: 'Spotify', category: 'Media & Audio' },
  'vlc.exe': { display: 'VLC Media Player', category: 'Media & Audio' },
  'obs64.exe': { display: 'OBS Studio', category: 'Media & Audio' },
  'notion.exe': { display: 'Notion', category: 'Productivity' },
  'obsidian.exe': { display: 'Obsidian', category: 'Productivity' },
  'winword.exe': { display: 'Microsoft Word', category: 'Productivity' },
  'excel.exe': { display: 'Microsoft Excel', category: 'Productivity' },
  'powerpnt.exe': { display: 'PowerPoint', category: 'Productivity' },
  'notepad.exe': { display: 'Notepad', category: 'Productivity' },
  'figma.exe': { display: 'Figma', category: 'Productivity' },
  'steam.exe': { display: 'Steam', category: 'Gaming' },
  'epicgameslauncher.exe': { display: 'Epic Games', category: 'Gaming' },
  'explorer.exe': { display: 'File Explorer', category: 'System & Utilities' },
  'taskmgr.exe': { display: 'Windows Task Manager', category: 'System & Utilities' },
  'luminess assist.exe': { display: 'Luminess Assist', category: 'Productivity' },
  'app.exe': { display: 'Luminess Assist', category: 'Productivity' },
};

const CATEGORY_COLORS: Record<WellbeingCategory, string> = {
  Development: '#38bdf8',
  Browser: '#818cf8',
  Communication: '#34d399',
  'Media & Audio': '#f472b6',
  Productivity: '#22d3ee',
  Gaming: '#fb7185',
  'System & Utilities': '#94a3b8',
};

export function createEmptyWellbeingHistory(nowMs: number = Date.now()): WellbeingHistoryStore {
  return {
    version: '1.0.0',
    retention_days: WELLBEING_RETENTION_DAYS,
    days: {},
    updated_at: nowMs,
  };
}

export function resolveAppProfile(
  exeName: string,
  processName?: string
): { appKey: string; displayName: string; category: WellbeingCategory } {
  const cleanExe = (exeName || processName || 'unknown.exe').trim();
  const normalizedKey = (cleanExe.toLowerCase().endsWith('.exe')
    ? cleanExe
    : `${cleanExe}.exe`
  ).toLowerCase();

  const known = KNOWN_APPS[normalizedKey];
  if (known) {
    return {
      appKey: normalizedKey,
      displayName: known.display,
      category: known.category,
    };
  }

  const stem = (processName || cleanExe.replace(/\.exe$/i, '')).trim() || 'Unknown App';
  const friendly = stem
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

  let category: WellbeingCategory = 'System & Utilities';
  if (/studio|ide|git|node|python|cargo|code/i.test(stem)) category = 'Development';
  else if (/browser|web/i.test(stem)) category = 'Browser';
  else if (/chat|mail|meet|call/i.test(stem)) category = 'Communication';
  else if (/music|player|audio|video|media/i.test(stem)) category = 'Media & Audio';
  else if (/notes|docs|office|sheet|pdf/i.test(stem)) category = 'Productivity';
  else if (/game|play|launcher/i.test(stem)) category = 'Gaming';

  return {
    appKey: normalizedKey,
    displayName: friendly,
    category,
  };
}

export function dateKeyToEpochDays(dateKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getRecentDateKeys(count: number, nowMs: number = Date.now()): string[] {
  const base = new Date(nowMs);
  base.setHours(12, 0, 0, 0);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(base.getTime() - i * 86_400_000);
    out.push(getLocalDateKey(d.getTime()));
  }
  return out;
}

export function pruneWellbeingHistory90Days(
  store: WellbeingHistoryStore,
  nowMs: number = Date.now()
): WellbeingHistoryStore {
  const todayEpoch = dateKeyToEpochDays(getLocalDateKey(nowMs));
  if (todayEpoch === null) return store;
  const cutoff = todayEpoch - WELLBEING_RETENTION_DAYS + 1;

  const nextDays: Record<string, WellbeingDayRecord> = {};
  for (const [dateKey, record] of Object.entries(store.days || {})) {
    const epoch = dateKeyToEpochDays(dateKey);
    if (epoch !== null && epoch >= cutoff && record && typeof record === 'object') {
      nextDays[dateKey] = record;
    }
  }

  return {
    version: store.version || '1.0.0',
    retention_days: WELLBEING_RETENTION_DAYS,
    days: nextDays,
    updated_at: nowMs,
  };
}

export function recordForegroundUsageSample(
  store: WellbeingHistoryStore,
  sample: ForegroundAppSample,
  elapsedSeconds: number,
  nowMs: number = Date.now()
): WellbeingHistoryStore {
  if (sample.is_idle || elapsedSeconds <= 0 || !sample.pid) {
    return pruneWellbeingHistory90Days(store, nowMs);
  }

  const pruned = pruneWellbeingHistory90Days(store, nowMs);
  const dateKey = getLocalDateKey(nowMs);
  const profile = resolveAppProfile(sample.exe_name, sample.process_name);
  const delta = Math.max(1, Math.min(60, Math.round(elapsedSeconds)));

  const existingDay: WellbeingDayRecord = pruned.days[dateKey] || {
    date: dateKey,
    total_seconds: 0,
    apps: {},
  };
  const existingApp = existingDay.apps[profile.appKey];

  const nextApp: WellbeingAppUsageEntry = {
    app_key: profile.appKey,
    display_name: profile.displayName,
    category: profile.category,
    seconds: (existingApp?.seconds || 0) + delta,
    last_title: (sample.window_title || existingApp?.last_title || '').slice(0, 120),
    exe_path: (sample.exe_path || existingApp?.exe_path || '').trim(),
    last_seen_ms: sample.sampled_at_ms || nowMs,
  };

  return {
    ...pruned,
    days: {
      ...pruned.days,
      [dateKey]: {
        date: dateKey,
        total_seconds: (existingDay.total_seconds || 0) + delta,
        apps: {
          ...existingDay.apps,
          [profile.appKey]: nextApp,
        },
      },
    },
    updated_at: nowMs,
  };
}

export function formatWellbeingDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m';
  const secs = Math.floor(totalSeconds);
  const hours = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const remSecs = secs % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${remSecs}s`;
}

export function formatBytesMem(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.max(1, Math.round(mb))} MB`;
}

export function explainAppUsage(
  displayName: string,
  category: WellbeingCategory,
  seconds: number,
  percentage: number,
  rangeLabel: string
): string {
  const dur = formatWellbeingDuration(seconds);
  const share = `${percentage.toFixed(percentage >= 10 ? 0 : 1)}%`;

  if (category === 'Development') {
    return `${displayName} accounts for ${dur} (${share}) of your ${rangeLabel.toLowerCase()} screen time in Development. ${
      percentage >= 45
        ? 'Strong deep-work focus block — remember short eye & hydration breaks every 45 minutes.'
        : 'Steady coding/engineering activity balanced across your tools.'
    }`;
  }
  if (category === 'Browser') {
    return `You spent ${dur} (${share}) browsing in ${displayName} during ${rangeLabel.toLowerCase()}. ${
      percentage >= 50
        ? 'High web share often reflects research sprints, documentation reading, or tab multitasking.'
        : 'Moderate web research alongside your primary desktop workspace.'
    }`;
  }
  if (category === 'Communication') {
    return `${displayName} makes up ${dur} (${share}) of ${rangeLabel.toLowerCase()} activity in Communication — tracking team chats, calls, or messaging time.`;
  }
  if (category === 'Media & Audio') {
    return `${displayName} took ${dur} (${share}) in Media & Audio. Background playback or video breaks help pace intense sessions.`;
  }
  if (category === 'Gaming') {
    return `${displayName} recorded ${dur} (${share}) in Gaming during ${rangeLabel.toLowerCase()}.`;
  }
  if (category === 'Productivity') {
    return `${displayName} covers ${dur} (${share}) of your ${rangeLabel.toLowerCase()} Productivity time across notes, docs, or companion assistance.`;
  }
  return `${displayName} accounts for ${dur} (${share}) of your active foreground time in ${rangeLabel.toLowerCase()}.`;
}

export function buildWellbeingRangeReport(
  store: WellbeingHistoryStore,
  range: WellbeingRange,
  nowMs: number = Date.now()
): WellbeingRangeReport {
  const dayCount = range === 'day' ? 1 : range === 'week' ? 7 : 30;
  const rangeLabel =
    range === 'day' ? 'Today' : range === 'week' ? 'This Week (7d)' : 'This Month (30d)';
  const dateKeys = getRecentDateKeys(dayCount, nowMs);

  const aggregatedApps = new Map<string, WellbeingAppUsageEntry>();
  const dailySeries: WellbeingDailySeriesPoint[] = [];
  let totalSeconds = 0;
  let activeDays = 0;

  for (const key of dateKeys) {
    const rec = store.days[key];
    const daySecs = rec?.total_seconds || 0;
    totalSeconds += daySecs;
    if (daySecs > 0) activeDays += 1;

    dailySeries.push({
      date: key,
      shortLabel: key.slice(5), // MM-DD
      total_seconds: daySecs,
    });

    if (rec?.apps) {
      for (const app of Object.values(rec.apps)) {
        const existing = aggregatedApps.get(app.app_key);
        if (existing) {
          existing.seconds += app.seconds;
          if (app.last_seen_ms >= existing.last_seen_ms) {
            existing.last_seen_ms = app.last_seen_ms;
            existing.last_title = app.last_title || existing.last_title;
          }
        } else {
          aggregatedApps.set(app.app_key, { ...app });
        }
      }
    }
  }

  const sortedRaw = Array.from(aggregatedApps.values())
    .filter((a) => a.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);

  const denom = Math.max(1, totalSeconds);
  const allApps: WellbeingAppSummary[] = sortedRaw.map((entry, idx) => {
    const percentage = (entry.seconds / denom) * 100;
    return {
      app_key: entry.app_key,
      display_name: entry.display_name,
      category: entry.category,
      seconds: entry.seconds,
      percentage,
      color: WELLBEING_PALETTE[idx % WELLBEING_PALETTE.length],
      last_title: entry.last_title,
      explanation: explainAppUsage(
        entry.display_name,
        entry.category,
        entry.seconds,
        percentage,
        rangeLabel
      ),
    };
  });

  let chartSlices: WellbeingAppSummary[] = [];
  if (allApps.length <= 6) {
    chartSlices = allApps;
  } else {
    const topFive = allApps.slice(0, 5);
    const remainder = allApps.slice(5);
    const otherSeconds = remainder.reduce((acc, a) => acc + a.seconds, 0);
    const otherPct = (otherSeconds / denom) * 100;
    chartSlices = [
      ...topFive,
      {
        app_key: '__other__',
        display_name: `Other Apps (${remainder.length})`,
        category: 'System & Utilities',
        seconds: otherSeconds,
        percentage: otherPct,
        color: '#64748b',
        last_title: '',
        explanation: `${remainder.length} smaller applications combined for ${formatWellbeingDuration(
          otherSeconds
        )} (${otherPct.toFixed(1)}%) across ${rangeLabel.toLowerCase()}.`,
      },
    ];
  }

  const catTotalsMap = new Map<WellbeingCategory, number>();
  for (const app of allApps) {
    catTotalsMap.set(app.category, (catTotalsMap.get(app.category) || 0) + app.seconds);
  }
  const categoryTotals: WellbeingCategoryTotal[] = Array.from(catTotalsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, seconds]) => ({
      category,
      seconds,
      percentage: (seconds / denom) * 100,
      color: CATEGORY_COLORS[category] || '#94a3b8',
    }));

  const dailyAverageSeconds = activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0;

  let overallExplanation: string;
  if (totalSeconds === 0) {
    overallExplanation = `No foreground app time recorded for ${rangeLabel.toLowerCase()} yet. Luminess tracks your active window automatically in the background (pausing after 5m of idle time) and purges history older than 90 days.`;
  } else {
    const top = allApps[0];
    const topCat = categoryTotals[0];
    overallExplanation = `Across ${rangeLabel.toLowerCase()}, you logged ${formatWellbeingDuration(
      totalSeconds
    )} across ${allApps.length} ${allApps.length === 1 ? 'app' : 'apps'}${
      range !== 'day' ? ` (${formatWellbeingDuration(dailyAverageSeconds)}/active day)` : ''
    }. Most time was in ${topCat?.category || 'Desktop'} led by ${
      top.display_name
    } at ${top.percentage.toFixed(0)}%. Data older than 90 days (3 months) deletes automatically.`;
  }

  return {
    range,
    range_label: rangeLabel,
    date_keys: dateKeys,
    total_seconds: totalSeconds,
    active_days: activeDays,
    daily_average_seconds: dailyAverageSeconds,
    daily_series: dailySeries,
    chart_slices: chartSlices,
    all_apps: allApps,
    category_totals: categoryTotals,
    overall_explanation: overallExplanation,
  };
}

export async function loadWellbeingHistoryFromMachine(): Promise<WellbeingHistoryStore> {
  try {
    const res = await invoke<WellbeingHistoryStore>('load_wellbeing_history');
    if (res && typeof res === 'object' && res.days) {
      const pruned = pruneWellbeingHistory90Days(res);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(WELLBEING_LOCAL_FALLBACK_KEY, JSON.stringify(pruned));
      }
      return pruned;
    }
  } catch {
    // Web fallback
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(WELLBEING_LOCAL_FALLBACK_KEY);
      if (raw) {
        return pruneWellbeingHistory90Days(JSON.parse(raw) as WellbeingHistoryStore);
      }
    } catch {
      // ignore
    }
  }
  return createEmptyWellbeingHistory();
}

export async function saveWellbeingHistoryToMachine(
  store: WellbeingHistoryStore
): Promise<WellbeingHistoryStore> {
  const pruned = pruneWellbeingHistory90Days(store);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(WELLBEING_LOCAL_FALLBACK_KEY, JSON.stringify(pruned));
    } catch {
      // ignore quota error
    }
  }
  try {
    const saved = await invoke<WellbeingHistoryStore>('save_wellbeing_history', {
      history: pruned,
    });
    if (saved) return saved;
  } catch {
    // Outside Tauri
  }
  return pruned;
}

export async function clearWellbeingHistoryOnMachine(): Promise<WellbeingHistoryStore> {
  const empty = createEmptyWellbeingHistory();
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WELLBEING_LOCAL_FALLBACK_KEY, JSON.stringify(empty));
  }
  try {
    const cleared = await invoke<WellbeingHistoryStore>('clear_wellbeing_history');
    if (cleared) return cleared;
  } catch {
    // Outside Tauri
  }
  return empty;
}

export async function fetchForegroundAppSample(): Promise<ForegroundAppSample | null> {
  try {
    return await invoke<ForegroundAppSample>('get_foreground_app_usage_sample');
  } catch {
    return null;
  }
}

export async function fetchTaskManagerSnapshot(): Promise<TaskManagerSnapshot | null> {
  try {
    return await invoke<TaskManagerSnapshot>('get_task_manager_snapshot');
  } catch {
    return null;
  }
}

export async function fetchInstalledRealAppsFromMachine(): Promise<InstalledRealApp[]> {
  try {
    const res = await invoke<InstalledRealApp[]>('get_installed_real_apps');
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

const EXCLUDED_SYSTEM_EXES = new Set([
  '',
  'idle.exe',
  'system',
  'registry',
  'explorer.exe',
  'svchost.exe',
  'dwm.exe',
  'csrss.exe',
  'smss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'lsass.exe',
  'conhost.exe',
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'taskmgr.exe',
  'taskhostw.exe',
  'sihost.exe',
  'fontdrvhost.exe',
  'ctfmon.exe',
  'runtimebroker.exe',
  'searchhost.exe',
  'searchapp.exe',
  'searchui.exe',
  'startmenuexperiencehost.exe',
  'shellexperiencehost.exe',
  'textinputhost.exe',
  'applicationframehost.exe',
  'systemsettings.exe',
  'lockapp.exe',
  'securityhealthsystray.exe',
  'smartscreen.exe',
  'dllhost.exe',
  'rundll32.exe',
  'msiexec.exe',
  'msedgewebview2.exe',
  'luminess assist.exe',
  'luminess-assist.exe',
  'app.exe',
  'luminess.exe',
]);

export function isRealUserApplication(
  exeName: string,
  exePath?: string,
  displayName?: string
): boolean {
  const lowerExe = (exeName || '').trim().toLowerCase();
  const lowerPath = (exePath || '').trim().toLowerCase();
  const lowerName = (displayName || '').trim().toLowerCase();

  if (EXCLUDED_SYSTEM_EXES.has(lowerExe)) return false;
  if (/^process-\d+\.exe$/.test(lowerExe)) return false;
  if (lowerName === 'luminess assist' || lowerName === 'windows explorer') return false;
  if (
    lowerPath.includes('\\windows\\system32\\') ||
    lowerPath.includes('\\windows\\syswow64\\') ||
    lowerPath.includes('\\windows\\systemapps\\') ||
    lowerPath.includes('\\windows\\immersivecontrolpanel\\') ||
    lowerPath.includes('\\windows\\winsxs\\')
  ) {
    return false;
  }
  return Boolean(lowerExe || lowerName);
}

export function buildRecentRealAppsList(
  store: WellbeingHistoryStore,
  installedApps: InstalledRealApp[] = [],
  limit: number = 5
): RecentRealAppItem[] {
  const installedByKey = new Map<string, InstalledRealApp>();
  for (const inst of installedApps) {
    if (!isRealUserApplication(inst.exe_name || inst.app_key, inst.launch_target, inst.name)) {
      continue;
    }
    installedByKey.set(inst.app_key.toLowerCase(), inst);
  }

  const aggregated = new Map<string, RecentRealAppItem>();
  for (const day of Object.values(store.days || {})) {
    for (const entry of Object.values(day.apps || {})) {
      const key = entry.app_key.toLowerCase();
      if (!isRealUserApplication(key, entry.exe_path, entry.display_name)) continue;

      const installed = installedByKey.get(key);
      const launchTarget =
        (entry.exe_path && entry.exe_path.trim()) ||
        installed?.launch_target ||
        entry.app_key;

      const cur = aggregated.get(key);
      if (cur) {
        cur.total_seconds += entry.seconds;
        if (entry.last_seen_ms > cur.last_seen_ms) {
          cur.last_seen_ms = entry.last_seen_ms;
          cur.window_title = entry.last_title || cur.window_title;
          if (entry.exe_path) cur.launch_target = entry.exe_path;
        }
      } else {
        aggregated.set(key, {
          app_key: key,
          display_name: entry.display_name,
          category: entry.category,
          launch_target: launchTarget,
          total_seconds: entry.seconds,
          last_seen_ms: entry.last_seen_ms,
          window_title: entry.last_title || installed?.window_title || '',
        });
      }
    }
  }

  const ranked = Array.from(aggregated.values()).sort(
    (a, b) => b.last_seen_ms - a.last_seen_ms || b.total_seconds - a.total_seconds
  );

  for (const inst of installedByKey.values()) {
    if (ranked.length >= limit) break;
    const key = inst.app_key.toLowerCase();
    if (aggregated.has(key)) continue;
    const profile = resolveAppProfile(inst.exe_name || inst.app_key, inst.name);
    ranked.push({
      app_key: key,
      display_name: profile.displayName || inst.name,
      category: profile.category,
      launch_target: inst.launch_target || inst.name,
      total_seconds: 0,
      last_seen_ms: 0,
      window_title: inst.window_title || '',
    });
  }

  return ranked.slice(0, Math.max(1, limit));
}

export function parseWellbeingCommand(input: string): WellbeingCommandAction | null {
  const text = input.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const mentionsRecentApps = /\b(recent apps?|top apps?|launch recent|open recent)\b/i.test(lower);
  if (mentionsRecentApps) {
    return { type: 'open', tab: 'recent' };
  }

  const mentionsTaskMgr = /\b(task manager|processes|cpu usage|ram usage|running apps|running processes)\b/i.test(
    lower
  );
  if (mentionsTaskMgr) {
    return { type: 'open', tab: 'taskmanager' };
  }

  const mentionsWellbeing =
    /\b(digital wellbeing|wellbeing|screen time|app usage|time spent|how long did i spend|app stats)\b/i.test(
      lower
    );
  if (!mentionsWellbeing) return null;

  let range: WellbeingRange = 'day';
  if (/\b(month|30\s*days|monthly)\b/i.test(lower)) range = 'month';
  else if (/\b(week|7\s*days|weekly)\b/i.test(lower)) range = 'week';

  if (/\b(open|show|view|display|check|buka)\b/i.test(lower) && !/\b(how much|how long|summary|report)\b/i.test(lower)) {
    return { type: 'open', tab: 'wellbeing', range };
  }

  return { type: 'summary', range };
}
