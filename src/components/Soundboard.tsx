import { t, nameOf } from '../i18n';
import { useEffect, useState } from 'react';
import { AudioLines, Bell, CloudRain, Music2, Pause, Plus, Sparkles } from 'lucide-react';
import type { Studio } from '../useStudio';
import { ancestors } from '../domain/scene';
const icons = [CloudRain, Music2, Bell, Sparkles, AudioLines];
export function Soundboard({ studio, onImport }: { studio: Studio; onImport: () => void }) {
  const [selectedFilter, setFilter] = useState('all');
  const tracks = studio.scene?.tracks ?? [];
  const groups = studio.scene?.groups ?? [];
  const filter = groups.some((g) => g.id === selectedFilter && g.parentId === null) ? selectedFilter : 'all';
  const trigger = (id: string) => {
    if (studio.playback[id]?.playing) studio.pause([id]);
    else void studio.play([id]);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        studio.busy ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input,select,textarea,[contenteditable=true]'))
      )
        return;
      const match = /^F([1-9]|1[0-2])$/.exec(event.key);
      if (!match) return;
      const track = tracks[Number(match[1]) - 1];
      if (track) {
        event.preventDefault();
        trigger(track.id);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return (
    <section className="soundboard" id="soundboard" aria-label={t('Звуковая панель')}>
      <div className="soundboard-heading">
        <h2>
          <AudioLines size={18} />
          {t('Звуковая панель')}
        </h2>
        <div className="soundboard-filters">
          <button className={filter === 'all' ? 'chosen' : ''} onClick={() => setFilter('all')}>
            {t('Все')}
          </button>
          {groups
            .filter((g) => !g.parentId)
            .map((g) => (
              <button key={g.id} className={filter === g.id ? 'chosen' : ''} onClick={() => setFilter(g.id)}>
                {nameOf(g)}
              </button>
            ))}
        </div>
        <button className="button subtle" disabled={studio.busy} onClick={onImport}>
          <Plus size={15} />
          {t('Добавить аудио')}
        </button>
      </div>
      <div className="soundboard-tiles">
        {tracks
          .filter((t) => filter === 'all' || ancestors(studio.scene!, t.groupId).some((g) => g.id === filter))
          .map((track) => {
            const index = tracks.indexOf(track);
            const Icon = icons[index % icons.length];
            const playing = studio.playback[track.id]?.playing;
            return (
              <button
                key={track.id}
                className={`sound-tile tile-${index % 5} ${playing ? 'tile-playing' : ''}`}
                disabled={studio.busy || !studio.playback[track.id]}
                aria-label={t('{p0} плитку: {p1}', {
                  p0: playing ? t('Пауза') : t('Играть'),
                  p1: nameOf(track),
                })}
                onClick={() => trigger(track.id)}
              >
                {playing ? <Pause size={26} /> : <Icon size={27} />}
                <span>{nameOf(track)}</span>
                <small>{index < 12 ? `F${index + 1}` : t('Нажмите для запуска')}</small>
              </button>
            );
          })}
        {!tracks.length && (
          <p className="soundboard-empty">
            {t('Добавленные дорожки появятся здесь. Запускайте их одним нажатием.')}
          </p>
        )}
      </div>
    </section>
  );
}
