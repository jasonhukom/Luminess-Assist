import { useState, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, FormEvent } from 'react';
import './FloatingBoxes.css';
import {
  Disc3,
  FolderOpen,
  Link2,
  ListMusic,
  Move,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { VisualEmotion } from './Robot.tsx';
import type { FloatingBoxPosition } from '../lib/memoryAndStorage.ts';
import {
  formatAudioTime,
  type MusicLoopMode,
  type MusicPlayerConfig,
  type MusicPlayerTrack,
} from '../lib/musicPlayer.ts';

interface FloatingMusicBoxProps {
  position: FloatingBoxPosition;
  onChangePosition: (next: FloatingBoxPosition) => void;
  emotion: VisualEmotion;
  config: MusicPlayerConfig;
  playlist: MusicPlayerTrack[];
  activeTrack: MusicPlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isScanning: boolean;
  resolvedMusicFolder: string;
  playerError: string | null;
  onPlayPause: () => void;
  onSelectTrack: (track: MusicPlayerTrack) => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onToggleShuffle: () => void;
  onCycleLoop: () => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onScanFolder: (folderOverride?: string) => void;
  onAddUrlTrack: (url: string, title?: string) => string | null;
  onRemoveCustomTrack: (trackId: string) => void;
  onClose: () => void;
}

const LOOP_LABELS: Record<MusicLoopMode, string> = {
  off: 'Loop Off',
  all: 'Loop Playlist',
  one: 'Loop Track',
};

export function FloatingMusicBox({
  position,
  onChangePosition,
  emotion,
  config,
  playlist,
  activeTrack,
  isPlaying,
  currentTime,
  duration,
  isScanning,
  resolvedMusicFolder,
  playerError,
  onPlayPause,
  onSelectTrack,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onCycleLoop,
  onSetVolume,
  onToggleMute,
  onScanFolder,
  onAddUrlTrack,
  onRemoveCustomTrack,
  onClose,
}: FloatingMusicBoxProps) {
  const [activeTab, setActiveTab] = useState<'player' | 'library'>('player');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderInput, setFolderInput] = useState(config.music_folder || resolvedMusicFolder || '');
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: position.x,
    origY: position.y,
  });

  const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    setIsDragging(true);
  };

  const handleHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    onChangePosition({
      ...position,
      x: dragRef.current.origX + dx,
      y: dragRef.current.origY + dy,
    });
  };

  const handleHeaderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleAddUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = onAddUrlTrack(urlInput, titleInput.trim() || undefined);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError(null);
    setUrlInput('');
    setTitleInput('');
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredTracks = playlist.filter((t) => {
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.source.toLowerCase().includes(q)
    );
  });

  const isAmbient = activeTrack?.source === 'ambient';
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrent = Math.min(safeDuration || 0, Math.max(0, currentTime));
  const ambientCount = playlist.filter((t) => t.source === 'ambient').length;
  const localCount = playlist.filter((t) => t.source === 'local').length;
  const urlCount = playlist.filter((t) => t.source === 'url').length;

  return (
    <div
      className={`floating-ui-box emotion-border-${emotion} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
      }}
    >
      <div
        className="floating-box-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        title="Drag anywhere on screen • Auto-dodges Chatbox & Companion"
      >
        <div className="floating-box-title">
          <Disc3 size={16} className={isPlaying ? 'text-glow animate-spin' : 'text-glow'} />
          <span>Music Player</span>
          <span className="floating-avoid-pill" title="Moves away automatically if touching Chatbox">
            <Move size={10} />
            <span>Auto-Dodge</span>
          </span>
        </div>
        <div className="chat-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => onScanFolder(folderInput || undefined)}
            title="Scan local Music folder"
            disabled={isScanning}
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
          </button>
          <button type="button" className="icon-btn" onClick={onClose} title="Close Music Player">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="floating-box-tabs">
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'player' ? 'active' : ''}`}
          onClick={() => setActiveTab('player')}
        >
          <Music2 size={13} />
          <span>Player</span>
        </button>
        <button
          type="button"
          className={`floating-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          <ListMusic size={13} />
          <span>Library ({playlist.length})</span>
        </button>
      </div>

      <div className="floating-box-body">
        {activeTab === 'player' ? (
          <>
            <div className="music-now-playing">
              <div className="floating-card-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="floating-card-title" style={{ fontSize: 13.5 }}>
                    {activeTrack ? activeTrack.title : 'No Track Selected'}
                  </div>
                  <div className="floating-card-sub">
                    {activeTrack ? `${activeTrack.artist} • ${activeTrack.source.toUpperCase()}` : 'Pick a track below'}
                  </div>
                </div>
                <div className={`music-eq-bars ${isPlaying ? 'playing' : ''}`} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="music-scrubber-row">
                <span>{isAmbient ? 'LIVE' : formatAudioTime(safeCurrent)}</span>
                <input
                  type="range"
                  min={0}
                  max={isAmbient ? 1 : Math.max(1, safeDuration)}
                  step={isAmbient ? 1 : 0.25}
                  value={isAmbient ? 1 : safeCurrent}
                  disabled={isAmbient || safeDuration <= 0}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  aria-label="Track progress"
                />
                <span>{isAmbient ? '∞' : formatAudioTime(safeDuration)}</span>
              </div>

              <div className="music-transport-row">
                <button
                  type="button"
                  className={`music-icon-btn ${config.shuffle ? 'active' : ''}`}
                  onClick={onToggleShuffle}
                  title={config.shuffle ? 'Shuffle On' : 'Shuffle Off'}
                >
                  <Shuffle size={14} />
                </button>
                <button type="button" className="music-icon-btn" onClick={onPrev} title="Previous Track">
                  <SkipBack size={15} />
                </button>
                <button
                  type="button"
                  className="music-play-btn"
                  onClick={onPlayPause}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                </button>
                <button type="button" className="music-icon-btn" onClick={onNext} title="Next Track">
                  <SkipForward size={15} />
                </button>
                <button
                  type="button"
                  className={`music-icon-btn ${config.loop_mode !== 'off' ? 'active' : ''}`}
                  onClick={onCycleLoop}
                  title={LOOP_LABELS[config.loop_mode]}
                >
                  {config.loop_mode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                </button>
              </div>

              <div className="music-scrubber-row" style={{ marginTop: 2 }}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onToggleMute}
                  title={config.muted ? 'Unmute' : 'Mute'}
                  style={{ padding: 4 }}
                >
                  {config.muted || config.volume <= 0.01 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  className="music-volume-slider"
                  min={0}
                  max={1}
                  step={0.02}
                  value={config.muted ? 0 : config.volume}
                  onChange={(e) => onSetVolume(Number(e.target.value))}
                  aria-label="Volume"
                />
                <span style={{ minWidth: 32, textAlign: 'right' }}>
                  {config.muted ? '0%' : `${Math.round(config.volume * 100)}%`}
                </span>
              </div>
            </div>

            {playerError && (
              <div className="floating-card-sub" style={{ color: '#fca5a5', padding: '0 4px' }}>
                {playerError}
              </div>
            )}

            <div className="floating-card-row" style={{ padding: '0 2px' }}>
              <span className="floating-card-sub" style={{ fontWeight: 600 }}>
                Queue & Built-In Ambient ({playlist.length})
              </span>
              <button
                type="button"
                className="floating-btn-secondary"
                onClick={() => setActiveTab('library')}
                style={{ padding: '4px 8px', fontSize: 10.5 }}
              >
                <FolderOpen size={12} />
                <span>Add Local / URL</span>
              </button>
            </div>

            <div className="music-track-list">
              {playlist.map((track) => {
                const isSelected = activeTrack?.id === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    className={`music-track-row ${isSelected ? 'active' : ''}`}
                    onClick={() => onSelectTrack(track)}
                    style={{ textAlign: 'left', width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      {track.source === 'ambient' ? (
                        <Sparkles size={13} className="text-glow" />
                      ) : track.source === 'url' ? (
                        <Link2 size={13} className="text-glow" />
                      ) : (
                        <Music2 size={13} className="text-glow" />
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="floating-card-title" style={{ fontSize: 12 }}>
                          {track.title}
                        </div>
                        <div className="floating-card-sub" style={{ fontSize: 10 }}>
                          {track.artist}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.07)',
                        color: isSelected && isPlaying ? '#7dd3fc' : '#94a3b8',
                      }}
                    >
                      {isSelected && isPlaying ? 'PLAYING' : track.source.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="floating-card-item">
              <div className="floating-card-title">Local Music Folder</div>
              <div className="floating-card-sub">
                Scan MP3, WAV, FLAC, OGG, M4A, AAC or OPUS files directly without copying them.
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  type="text"
                  className="floating-input"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="Default: Windows Music folder"
                />
                <button
                  type="button"
                  className="floating-btn-primary"
                  onClick={() => onScanFolder(folderInput.trim() || undefined)}
                  disabled={isScanning}
                >
                  <FolderOpen size={13} />
                  <span>{isScanning ? 'Scanning' : 'Scan'}</span>
                </button>
              </div>
              <div className="floating-card-sub" style={{ marginTop: 2 }}>
                Found {localCount} local {localCount === 1 ? 'track' : 'tracks'}
                {resolvedMusicFolder ? ` in ${resolvedMusicFolder}` : ''}.
              </div>
            </div>

            <form className="floating-card-item" onSubmit={handleAddUrlSubmit}>
              <div className="floating-card-title">Add Direct Audio / Radio Stream URL</div>
              <input
                type="url"
                className="floating-input"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/stream.mp3"
                required
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  type="text"
                  className="floating-input"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="Optional title (e.g. Night Rain FM)"
                />
                <button type="submit" className="floating-btn-secondary">
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </div>
              {urlError && (
                <div className="floating-card-sub" style={{ color: '#fca5a5' }}>
                  {urlError}
                </div>
              )}
            </form>

            <div className="floating-box-search" style={{ margin: 0 }}>
              <Search size={13} className="text-muted" />
              <input
                type="text"
                placeholder="Filter tracks by title, artist, source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="music-track-list">
              {filteredTracks.map((track) => {
                const isSelected = activeTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`music-track-row ${isSelected ? 'active' : ''}`}
                    onClick={() => onSelectTrack(track)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectTrack(track);
                      }
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="floating-card-title" style={{ fontSize: 12 }}>
                        {track.title}
                      </div>
                      <div className="floating-card-sub" style={{ fontSize: 10 }}>
                        {track.artist} • {track.source}
                      </div>
                    </div>
                    {track.source === 'url' && (
                      <button
                        type="button"
                        className="icon-btn"
                        title="Remove stream URL"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveCustomTrack(track.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="floating-box-footer">
        <span>
          {playlist.length} tracks ({ambientCount} synth • {localCount} local • {urlCount} URL)
        </span>
        <span>Keeps playing when minimized</span>
      </div>
    </div>
  );
}
