import { Headphones, Repeat2, Trash2, Volume2, X } from 'lucide-react';
import { timeLabel, type Track } from '../domain/scene';
import type { Studio } from '../useStudio';
import { EditableName, IconButton, Volume } from './Controls';

export function Inspector({ track, studio, onClose }: { track: Track; studio: Studio; onClose: () => void }) {
  return (
    <aside className="inspector" aria-label="Информация о дорожке">
      <div className="inspector-heading">
        <h2>Информация о дорожке</h2>
        <IconButton label="Закрыть параметры" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="inspector-summary">
        <div className="track-art">
          <Headphones size={27} />
        </div>
        <div>
          <strong>{track.name}</strong>
          <EditableName
            label="Название выбранной дорожки"
            value={track.name}
            disabled={studio.busy}
            onCommit={(name) => studio.trackChange(track.id, { name })}
          />
          <p>Длительность: {timeLabel(track.duration)}</p>
          <span>Локальная аудиозапись</span>
        </div>
      </div>
      <div className="inspector-tab">Основные</div>
      <section>
        <h3>Громкость</h3>
        <div className="inspector-volume">
          <Volume2 size={18} />
          <Volume
            label="Громкость выбранной дорожки"
            value={track.gain}
            disabled={studio.busy}
            onChange={(gain) => studio.trackChange(track.id, { gain })}
          />
        </div>
        <div className="volume-scale">
          <span>Тишина</span>
          <span>Максимум</span>
        </div>
      </section>
      <section>
        <h3>Выход звука</h3>
        <div className="local-output">
          <Headphones size={18} />
          <span>Этот компьютер</span>
          <span className="online-dot" />
        </div>
        <p className="inspector-hint">Звук выводится на устройство, выбранное в системе.</p>
      </section>
      <section>
        <h3>Режим воспроизведения</h3>
        <label className="select-row">
          <Repeat2 size={18} />
          <select
            aria-label="Режим воспроизведения"
            value={track.loop ? 'loop' : 'once'}
            disabled={studio.busy}
            onChange={(e) => studio.trackChange(track.id, { loop: e.target.value === 'loop' })}
          >
            <option value="loop">Зациклить</option>
            <option value="once">Один раз</option>
          </select>
        </label>
      </section>
      <section className="inspector-toggles">
        <label>
          <span>Без звука</span>
          <input
            type="checkbox"
            role="switch"
            checked={track.muted}
            disabled={studio.busy}
            onChange={(e) => studio.trackChange(track.id, { muted: e.target.checked })}
          />
        </label>
        <label>
          <span>Соло</span>
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
          Группа
          <select
            aria-label="Группа выбранной дорожки"
            value={track.groupId}
            disabled={studio.busy}
            onChange={(e) => studio.trackChange(track.id, { groupId: e.target.value })}
          >
            {studio.scene?.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
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
        <Trash2 size={17} /> Удалить дорожку
      </button>
    </aside>
  );
}
