import { invoke } from '@tauri-apps/api/core';
import {
  createDefaultMusicPlayerConfig,
  normalizeMusicPlayerConfig,
  type MusicLoopMode,
  type MusicPlayerConfig,
  type MusicPlayerTrack,
} from './memoryAndStorage.ts';

export {
  createDefaultMusicPlayerConfig,
  normalizeMusicPlayerConfig,
  type MusicLoopMode,
  type MusicPlayerConfig,
  type MusicPlayerTrack,
};

export type AmbientPresetId = 'lofi' | 'space' | 'chimes' | 'brown';

export type MusicCommandAction =
  | { type: 'play'; query?: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'volume'; volume: number }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'scan' }
  | { type: 'status' };

export const BUILT_IN_AMBIENT_TRACKS: MusicPlayerTrack[] = [
  {
    id: 'ambient:lofi',
    title: 'Warm Lo-Fi Pad',
    artist: 'Luminess Synth',
    source: 'ambient',
    uri: 'ambient://lofi',
    ambientPreset: 'lofi',
  },
  {
    id: 'ambient:space',
    title: 'Deep Space Drift',
    artist: 'Luminess Synth',
    source: 'ambient',
    uri: 'ambient://space',
    ambientPreset: 'space',
  },
  {
    id: 'ambient:chimes',
    title: 'Zen Glass Chimes',
    artist: 'Luminess Synth',
    source: 'ambient',
    uri: 'ambient://chimes',
    ambientPreset: 'chimes',
  },
  {
    id: 'ambient:brown',
    title: 'Warm Focus Noise',
    artist: 'Luminess Synth',
    source: 'ambient',
    uri: 'ambient://brown',
    ambientPreset: 'brown',
  },
];

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function sanitizeAudioStreamUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildUrlTrack(rawUrl: string, customTitle?: string): MusicPlayerTrack | null {
  const validUrl = sanitizeAudioStreamUrl(rawUrl);
  if (!validUrl) return null;
  const parsed = new URL(validUrl);
  const lastSeg = parsed.pathname.split('/').filter(Boolean).pop() || '';
  const decodedName = decodeURIComponent(lastSeg).replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  const title = (customTitle || decodedName || parsed.hostname).slice(0, 80);
  return {
    id: `url:${validUrl}`,
    title,
    artist: parsed.hostname.replace(/^www\./, ''),
    source: 'url',
    uri: validUrl,
  };
}

export function mergeMusicPlaylist(
  localTracks: MusicPlayerTrack[],
  customTracks: MusicPlayerTrack[]
): MusicPlayerTrack[] {
  const seenIds = new Set<string>();
  const out: MusicPlayerTrack[] = [];

  for (const list of [BUILT_IN_AMBIENT_TRACKS, localTracks, customTracks]) {
    for (const track of list) {
      if (!track || !track.id || seenIds.has(track.id)) continue;
      seenIds.add(track.id);
      out.push(track);
    }
  }
  return out;
}

export function pickNextTrackIndex(
  tracks: MusicPlayerTrack[],
  currentId: string | null,
  direction: 1 | -1,
  shuffle: boolean,
  loopMode: MusicLoopMode,
  randFn: () => number = Math.random
): number {
  if (tracks.length === 0) return -1;
  if (tracks.length === 1) return 0;

  const currentIdx = tracks.findIndex((t) => t.id === currentId);
  if (shuffle) {
    const candidate = Math.floor(randFn() * tracks.length) % tracks.length;
    if (candidate === currentIdx) {
      return (candidate + 1) % tracks.length;
    }
    return candidate;
  }

  if (currentIdx === -1) return direction === 1 ? 0 : tracks.length - 1;
  const rawNext = currentIdx + direction;
  if (rawNext >= 0 && rawNext < tracks.length) {
    return rawNext;
  }
  if (loopMode === 'off') {
    return -1;
  }
  return rawNext < 0 ? tracks.length - 1 : 0;
}

export async function scanLocalMusicFromMachine(
  directory?: string
): Promise<{ folder: string; tracks: MusicPlayerTrack[] }> {
  try {
    const res = await invoke<{
      ok: boolean;
      folder: string;
      tracks: Array<{
        id: string;
        title: string;
        artist: string;
        file_path: string;
        ext: string;
        size_bytes: number;
        stream_url: string;
      }>;
    }>('scan_local_music', { directory: directory || null });

    if (res && Array.isArray(res.tracks)) {
      return {
        folder: res.folder || '',
        tracks: res.tracks.map((item) => ({
          id: `local:${item.file_path}`,
          title: item.title,
          artist: item.artist,
          source: 'local',
          uri: item.file_path,
        })),
      };
    }
  } catch {
    // Web preview fallback when Tauri backend is absent.
  }
  return { folder: directory || '', tracks: [] };
}

export async function resolveLocalStreamUrl(filePath: string): Promise<string> {
  return invoke<string>('get_media_stream_url', { filePath });
}

export function parseMusicPlayerCommand(input: string): MusicCommandAction | null {
  const text = input.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const mentionsMusic =
    /\b(music|song|songs|track|tracks|audio|lofi|lo-fi|ambient|playlist|player|lagu|musik|chimes|brown noise)\b/i.test(
      lower
    );
  const explicitTransport =
    /^(?:play|pause|resume|stop music|next track|prev track|previous track|skip track)\b/i.test(lower);

  if (!mentionsMusic && !explicitTransport) return null;

  if (/\b(open|show|tampilkan|buka)\b.*\b(music|player|musik)\b|\bopen player\b/i.test(lower)) {
    return { type: 'open' };
  }
  if (/\b(close|hide|tutup)\b.*\b(music|player|musik)\b/i.test(lower)) {
    return { type: 'close' };
  }
  if (/\b(scan|rescan|refresh|import)\b.*\b(music|songs|folder|library|tracks)\b/i.test(lower)) {
    return { type: 'scan' };
  }
  if (/\b(pause|stop|mute playback|jeda|berhenti|matikan musik)\b/i.test(lower)) {
    return { type: 'pause' };
  }
  if (/\b(next|skip|lagu berikut|berikutnya)\b/i.test(lower)) {
    return { type: 'next' };
  }
  if (/\b(prev|previous|back|sebelumnya)\b/i.test(lower)) {
    return { type: 'prev' };
  }
  if (/\b(vol|volume)\b/i.test(lower)) {
    const numMatch = lower.match(/(\d{1,3})\s*%?/);
    if (numMatch) {
      const pct = Math.min(100, Math.max(0, Number(numMatch[1])));
      return { type: 'volume', volume: pct / 100 };
    }
  }
  if (/\b(status|what(?:'s| is)\s+playing|now playing)\b/i.test(lower)) {
    return { type: 'status' };
  }
  if (/\b(resume|unpause)\b/i.test(lower)) {
    return { type: 'resume' };
  }
  if (/\b(play|put on|start|putar|mainkan)\b/i.test(lower)) {
    const cleaned = text
      .replace(/^(?:please\s+)?(?:play|put on|start|putar|mainkan)\s+/i, '')
      .replace(/\b(?:the|some|a|music|song|track|musik|lagu)\b/gi, '')
      .trim();
    return { type: 'play', query: cleaned || undefined };
  }

  return null;
}

export class AmbientSynthController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];
  private chimeTimer: number | null = null;

  public start(preset: AmbientPresetId, volume: number, muted: boolean): void {
    this.stop();
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      const targetGain = muted ? 0.0001 : Math.max(0.0001, Math.min(1, volume) * 0.28);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 0.35);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;

      if (preset === 'brown') {
        const bufferSize = ctx.sampleRate * 3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i += 1) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 2.4;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, ctx.currentTime);
        src.connect(filter);
        filter.connect(master);
        src.start();
        this.activeNodes.push(src, filter);
        return;
      }

      if (preset === 'chimes') {
        const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
        const triggerChime = () => {
          if (!this.ctx || !this.masterGain) return;
          const now = this.ctx.currentTime;
          const freq = notes[Math.floor(Math.random() * notes.length)];
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 2.25);
        };
        triggerChime();
        this.chimeTimer = window.setInterval(triggerChime, 1900);
        return;
      }

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(preset === 'lofi' ? 620 : 410, ctx.currentTime);
      filter.connect(master);
      this.activeNodes.push(filter);

      const freqs =
        preset === 'lofi'
          ? [130.81, 196.0, 246.94, 329.63] // Cmaj7 warm pad
          : [110.0, 164.81, 246.94]; // A5 deep space drift

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const voiceGain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f + (idx % 2 === 0 ? 0.2 : -0.2), ctx.currentTime);
        voiceGain.gain.setValueAtTime(0.18 / freqs.length, ctx.currentTime);
        osc.connect(voiceGain);
        voiceGain.connect(filter);
        osc.start();
        this.activeNodes.push(osc, voiceGain);
      });
    } catch {
      this.stop();
    }
  }

  public setVolume(volume: number, muted: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const clamped = Math.max(0, Math.min(1, volume));
    const gainVal = muted ? 0.0001 : Math.max(0.0001, clamped * 0.28);
    try {
      this.masterGain.gain.setTargetAtTime(gainVal, this.ctx.currentTime, 0.05);
    } catch {
      // ignore if closing
    }
  }

  public stop(): void {
    if (this.chimeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.chimeTimer);
      this.chimeTimer = null;
    }
    for (const node of this.activeNodes) {
      try {
        node.stop?.();
      } catch {
        // already stopped
      }
      try {
        node.disconnect();
      } catch {
        // already disconnected
      }
    }
    this.activeNodes = [];
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // ignore
      }
      this.masterGain = null;
    }
    if (this.ctx) {
      const closing = this.ctx;
      this.ctx = null;
      void closing.close().catch(() => {});
    }
  }
}
