import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_AMBIENT_TRACKS,
  buildUrlTrack,
  formatAudioTime,
  mergeMusicPlaylist,
  parseMusicPlayerCommand,
  pickNextTrackIndex,
  sanitizeAudioStreamUrl,
} from './musicPlayer';

describe('musicPlayer', () => {
  it('formats durations cleanly across seconds, minutes, and hours', () => {
    expect(formatAudioTime(0)).toBe('0:00');
    expect(formatAudioTime(-5)).toBe('0:00');
    expect(formatAudioTime(65)).toBe('1:05');
    expect(formatAudioTime(3665)).toBe('1:01:05');
  });

  it('validates HTTP/HTTPS audio URLs and builds clean track entries', () => {
    expect(sanitizeAudioStreamUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeAudioStreamUrl('file:///C:/music/song.mp3')).toBeNull();
    expect(sanitizeAudioStreamUrl('https://example.com/audio/Chill_Mix.mp3')).toBe(
      'https://example.com/audio/Chill_Mix.mp3'
    );

    const track = buildUrlTrack('https://cdn.example.org/streams/Night%20Drive.mp3');
    expect(track).toEqual({
      id: 'url:https://cdn.example.org/streams/Night%20Drive.mp3',
      title: 'Night Drive',
      artist: 'cdn.example.org',
      source: 'url',
      uri: 'https://cdn.example.org/streams/Night%20Drive.mp3',
    });
  });

  it('merges playlists without duplicates and handles next/prev/shuffle logic', () => {
    const merged = mergeMusicPlaylist(
      [
        {
          id: 'local:a.mp3',
          title: 'Track A',
          artist: 'Artist',
          source: 'local',
          uri: 'C:/Music/a.mp3',
        },
        BUILT_IN_AMBIENT_TRACKS[0], // duplicate ambient should be skipped
      ],
      [
        {
          id: 'url:https://example.com/b.mp3',
          title: 'Stream B',
          artist: 'example.com',
          source: 'url',
          uri: 'https://example.com/b.mp3',
        },
      ]
    );

    expect(merged.length).toBe(BUILT_IN_AMBIENT_TRACKS.length + 2);

    expect(pickNextTrackIndex(merged, 'ambient:lofi', 1, false, 'all')).toBe(1);
    expect(pickNextTrackIndex(merged, 'ambient:lofi', -1, false, 'all')).toBe(merged.length - 1);
    expect(pickNextTrackIndex(merged, merged[merged.length - 1].id, 1, false, 'off')).toBe(-1);

    const shuffledIdx = pickNextTrackIndex(merged, 'ambient:lofi', 1, true, 'all', () => 0);
    expect(shuffledIdx).toBe(1);
  });

  it('parses natural music control commands accurately', () => {
    expect(parseMusicPlayerCommand('play lofi')).toEqual({ type: 'play', query: 'lofi' });
    expect(parseMusicPlayerCommand('pause music')).toEqual({ type: 'pause' });
    expect(parseMusicPlayerCommand('next track')).toEqual({ type: 'next' });
    expect(parseMusicPlayerCommand('previous song')).toEqual({ type: 'prev' });
    expect(parseMusicPlayerCommand('set music volume to 40%')).toEqual({
      type: 'volume',
      volume: 0.4,
    });
    expect(parseMusicPlayerCommand('open music player')).toEqual({ type: 'open' });
    expect(parseMusicPlayerCommand('rescan my music folder')).toEqual({ type: 'scan' });
    expect(parseMusicPlayerCommand('what time is it')).toBeNull();
  });
});
