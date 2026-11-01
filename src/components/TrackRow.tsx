import { t, nameOf, errorText } from '../i18n';
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
        label={`${playing ? t('Пауза') : t('Играть')}: ${nameOf(track)}`}
        className="track-play"
        disabled={studio.busy || !state}
        onClick={() => (playing ? studio.pause([track.id]) : void studio.play([track.id]))}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </IconButton>
      <div className="track-info">
        <button
          className="track-name"
          aria-label={t('Параметры: {p0}', { p0: nameOf(track) })}
          onClick={() => onSelect(track.id)}
        >
          <AudioLines size={18} />
          {nameOf(track)}
        </button>
        <span>
          {errorText(state?.error) ||
            (!state && !studio.busy
              ? t('Файл не найден')
              : t('Аудио · {p0}', { p0: timeLabel(track.duration) }))}
        </span>
      </div>
      <div className="track-progress">
        <input
          type="range"
          aria-label={t('Позиция: {p0}', { p0: nameOf(track) })}
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
        label={t('Повтор: {p0}', { p0: nameOf(track) })}
        active={track.loop}
        disabled={studio.busy}
        onClick={() => change({ loop: !track.loop })}
      >
        <Repeat2 size={18} />
      </IconButton>
      <div className="track-volume">
        <Volume2 size={17} />
        <Volume
          label={t('Громкость дорожки: {p0}', { p0: nameOf(track) })}
          value={track.gain}
          disabled={studio.busy}
          onChange={(gain) => change({ gain })}
        />
      </div>
      <details className="menu">
        <summary
          aria-label={t('Настройки дорожки: {p0}', { p0: nameOf(track) })}
          title={t('Настройки дорожки')}
        >
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
            {t('Без звука')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={track.solo}
              disabled={studio.busy}
              onChange={(e) => change({ solo: e.target.checked })}
            />{' '}
            {t('Соло')}
          </label>
          <label>
            {t('Группа')}
            <select
              aria-label={t('Группа дорожки: {p0}', { p0: nameOf(track) })}
              value={track.groupId}
              disabled={studio.busy}
              onChange={(e) => change({ groupId: e.target.value })}
            >
              {studio.scene?.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {nameOf(g)}
                </option>
              ))}
            </select>
          </label>
          <button className="danger" disabled={studio.busy} onClick={() => studio.removeTrack(track.id)}>
            <Trash2 size={15} />
            {t('Удалить дорожку')}
          </button>
        </div>
      </details>
    </div>
  );
}
