import { MoreHorizontal, Pause, Play, Repeat2, Trash2, Volume2, AudioLines } from 'lucide-react';
import { timeLabel, type Track } from '../domain/scene';
import type { Studio } from '../useStudio';
import { IconButton, Volume } from './Controls';

export function TrackRow({
  track,
  studio,
  selectedId,
  onSelect,
}: {
  track: Track;
  studio: Studio;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const state = studio.playback[track.id];
  const playing = state?.playing ?? false;
  const position = state?.position ?? 0;
  const change = (patch: Partial<Track>) => studio.trackChange(track.id, patch);
  return (
    <div
      className={`track-row ${playing ? 'playing' : ''} ${track.muted ? 'muted' : ''} ${selectedId === track.id ? 'selected-track' : ''}`}
      data-testid="track-row"
      data-position={position.toFixed(2)}
    >
      <IconButton
        label={`${playing ? 'Пауза' : 'Играть'}: ${track.name}`}
        className="track-play"
        disabled={studio.busy || !state}
        onClick={() => (playing ? studio.pause([track.id]) : void studio.play([track.id]))}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </IconButton>
      <div className="track-info">
        <button
          className="track-name"
          aria-label={`Параметры: ${track.name}`}
          onClick={() => onSelect(track.id)}
        >
          <AudioLines size={18} />
          {track.name}
        </button>
        <span>
          {state?.error ??
            (!state && !studio.busy ? 'Файл не найден' : `Аудио · ${timeLabel(track.duration)}`)}
        </span>
      </div>
      <div className="track-progress">
        <input
          type="range"
          aria-label={`Позиция: ${track.name}`}
          min={0}
          max={track.duration}
          step={0.1}
          value={position}
          disabled={studio.busy || !state}
          onChange={(e) => studio.seek(track.id, Number(e.target.value))}
        />
        <span>
          {timeLabel(position)} / {timeLabel(track.duration)}
        </span>
      </div>
      <IconButton
        label={`Повтор: ${track.name}`}
        active={track.loop}
        disabled={studio.busy}
        onClick={() => change({ loop: !track.loop })}
      >
        <Repeat2 size={18} />
      </IconButton>
      <div className="track-volume">
        <Volume2 size={17} />
        <Volume
          label={`Громкость дорожки: ${track.name}`}
          value={track.gain}
          disabled={studio.busy}
          onChange={(gain) => change({ gain })}
        />
      </div>
      <details className="menu">
        <summary aria-label={`Настройки дорожки: ${track.name}`} title="Настройки дорожки">
          <MoreHorizontal size={20} />
        </summary>
        <div className="menu-content">
          <label className="check">
            <input
              type="checkbox"
              checked={track.muted}
              disabled={studio.busy}
              onChange={(e) => change({ muted: e.target.checked })}
            />{' '}
            Без звука
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={track.solo}
              disabled={studio.busy}
              onChange={(e) => change({ solo: e.target.checked })}
            />{' '}
            Соло
          </label>
          <label>
            Группа
            <select
              aria-label={`Группа дорожки: ${track.name}`}
              value={track.groupId}
              disabled={studio.busy}
              onChange={(e) => change({ groupId: e.target.value })}
            >
              {studio.scene?.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <button className="danger" disabled={studio.busy} onClick={() => studio.removeTrack(track.id)}>
            <Trash2 size={15} /> Удалить дорожку
          </button>
        </div>
      </details>
    </div>
  );
}
