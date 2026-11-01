import { t, nameOf } from '../i18n';
import { Headphones, Repeat2, Trash2, Volume2, X } from 'lucide-react';
import { timeLabel, type Track } from '../domain/scene';
import type { Studio } from '../useStudio';
import { EditableName, IconButton, Volume } from './Controls';
export function Inspector({ track, studio, onClose }: { track: Track; studio: Studio; onClose: () => void }) {
  return (
    <aside className="inspector" aria-label={t('Информация о дорожке')}>
      <div className="inspector-heading">
        <h2>{t('Информация о дорожке')}</h2>
        <IconButton label={t('Закрыть параметры')} onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="inspector-summary">
        <div className="track-art">
          <Headphones size={27} />
        </div>
        <div>
          <strong>{nameOf(track)}</strong>
          <EditableName
            label={t('Название выбранной дорожки')}
            value={nameOf(track)}
            disabled={studio.busy}
            onCommit={(name) => studio.trackChange(track.id, { name })}
          />
          <p>{t('Длительность: {duration}', { duration: timeLabel(track.duration) })}</p>
          <span>{t('Локальная аудиозапись')}</span>
        </div>
      </div>
      <div className="inspector-tab">{t('Основные')}</div>
      <section>
        <h3>{t('Громкость')}</h3>
        <div className="inspector-volume">
          <Volume2 size={18} />
          <Volume
            label={t('Громкость выбранной дорожки')}
            value={track.gain}
            disabled={studio.busy}
            onChange={(gain) => studio.trackChange(track.id, { gain })}
          />
        </div>
        <div className="volume-scale">
          <span>{t('Тишина')}</span>
          <span>{t('Максимум')}</span>
        </div>
      </section>
      <section>
        <h3>{t('Выход звука')}</h3>
        <div className="local-output">
          <Headphones size={18} />
          <span>{t('Этот компьютер')}</span>
          <span className="online-dot" />
        </div>
        <p className="inspector-hint">{t('Звук выводится на устройство, выбранное в системе.')}</p>
      </section>
      <section>
        <h3>{t('Режим воспроизведения')}</h3>
        <label className="select-row">
          <Repeat2 size={18} />
          <select
            aria-label={t('Режим воспроизведения')}
            value={track.loop ? 'loop' : 'once'}
            disabled={studio.busy}
            onChange={(e) => studio.trackChange(track.id, { loop: e.target.value === 'loop' })}
          >
            <option value="loop">{t('Зациклить')}</option>
            <option value="once">{t('Один раз')}</option>
          </select>
        </label>
      </section>
      <section className="inspector-toggles">
        <label>
          <span>{t('Без звука')}</span>
          <input
            type="checkbox"
            role="switch"
            checked={track.muted}
            disabled={studio.busy}
            onChange={(e) => studio.trackChange(track.id, { muted: e.target.checked })}
          />
        </label>
        <label>
          <span>{t('Соло')}</span>
          <input
            type="checkbox"
            role="switch"
            checked={track.solo}
            disabled={studio.busy}
            onChange={(e) => studio.trackChange(track.id, { solo: e.target.checked })}
          />
        </label>
      </section>
      <section>
        <label className="field-label">
          {t('Группа')}
          <select
            aria-label={t('Группа выбранной дорожки')}
            value={track.groupId}
            disabled={studio.busy}
            onChange={(e) => studio.trackChange(track.id, { groupId: e.target.value })}
          >
            {studio.scene?.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {nameOf(g)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <button
        className="button danger delete-track"
        disabled={studio.busy}
        onClick={() => {
          studio.removeTrack(track.id);
          onClose();
        }}
      >
        <Trash2 size={17} />
        {t('Удалить дорожку')}
      </button>
    </aside>
  );
}
