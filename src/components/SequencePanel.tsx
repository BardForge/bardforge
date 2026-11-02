import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowUp, ListOrdered, Play, Plus, SkipForward, Square, Trash2 } from 'lucide-react';
import { nameOf, t } from '../i18n';
import type { Studio } from '../useStudio';
import {
  maxSequenceStages,
  readStages,
  registerSequenceStop,
  SequenceController,
  sequenceStorageKey,
  type SequenceStage,
} from '../sequence';
import '../sequence.css';

export function SequencePanel({ studio }: { studio: Studio }) {
  const latest = useRef(studio);
  latest.current = studio;
  const [stages, setStages] = useState<SequenceStage[]>(() => {
    try {
      return readStages(localStorage);
    } catch {
      return [];
    }
  });
  const [storageError, setStorageError] = useState(false);
  const [controller] = useState(
    () =>
      new SequenceController({
        currentSceneId: () => latest.current.scene?.id,
        sceneExists: (id) => latest.current.scenes.some((scene) => scene.id === id),
        activateAndPlay: (id, signal) => latest.current.activateAndPlay(id, signal),
        restoreScene: (id, signal) => latest.current.restoreSequenceScene(id, signal),
        stopPlayback: () => latest.current.stop(),
      }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const active = state.phase !== 'idle';
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(
    () =>
      registerSequenceStop(() => {
        void controller.stop();
      }),
    [controller],
  );
  // A scene manually selected or deleted while running ends the sequence safely.
  useEffect(() => {
    if (
      state.phase === 'running' &&
      !state.transitioning &&
      studio.scene?.id !== stages[state.index]?.sceneId
    )
      void controller.stop();
  }, [controller, stages, state, studio.scene?.id]);

  const edit = (next: SequenceStage[]) => {
    if (active) return;
    setStages(next);
    try {
      localStorage.setItem(sequenceStorageKey, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  const reorder = (index: number, delta: number) => {
    const next = [...stages];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    edit(next);
  };
  const messages = {
    completed: 'Последовательность завершена.',
    stopped: 'Последовательность остановлена.',
    failed: 'Не удалось запустить этап последовательности.',
    'restore-failed': 'Не удалось восстановить исходную сцену.',
    empty: 'Добавьте хотя бы одну доступную сцену.',
  } as const;
  return (
    <details className="sequence-panel">
      <summary>
        <ListOrdered size={17} />
        {t('Последовательность сцен')}
        <span>{stages.length}</span>
      </summary>
      <div className="sequence-body">
        <p>
          {t(
            'Этапы переключают сцены и запускают их дорожки. После завершения вернётся исходная сцена без воспроизведения.',
          )}
        </p>
        <fieldset disabled={active || studio.busy}>
          <legend>{t('Ритуал')}</legend>
          <ol className="sequence-stages">
            {stages.map((stage, index) => (
              <li key={stage.id} aria-current={active && state.index === index ? 'step' : undefined}>
                <span className="sequence-stage-number">{index + 1}</span>
                <select
                  aria-label={`${t('Сцена этапа')} ${index + 1}`}
                  value={stage.sceneId}
                  onChange={(event) =>
                    edit(
                      stages.map((item) =>
                        item.id === stage.id ? { ...item, sceneId: event.target.value } : item,
                      ),
                    )
                  }
                >
                  {!studio.scenes.some((scene) => scene.id === stage.sceneId) && (
                    <option value={stage.sceneId}>{t('Удалённая сцена (будет пропущена)')}</option>
                  )}
                  {studio.scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {nameOf(scene)}
                    </option>
                  ))}
                </select>
                <label className="sequence-duration">
                  <span>{t('Длительность этапа, секунд')}</span>
                  <input
                    type="number"
                    min="0"
                    max="86400"
                    step="1"
                    aria-label={`${t('Длительность этапа, секунд')} ${index + 1}`}
                    value={stage.seconds}
                    onChange={(event) => {
                      const seconds = Math.min(
                        86400,
                        Math.max(0, Math.floor(Number(event.target.value) || 0)),
                      );
                      edit(stages.map((item) => (item.id === stage.id ? { ...item, seconds } : item)));
                    }}
                  />
                </label>
                <div className="sequence-stage-actions">
                  <button
                    type="button"
                    aria-label={`${t('Поднять этап')} ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => reorder(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t('Опустить этап')} ${index + 1}`}
                    disabled={index === stages.length - 1}
                    onClick={() => reorder(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`${t('Удалить этап')} ${index + 1}`}
                    onClick={() => edit(stages.filter((item) => item.id !== stage.id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <small>{t('0 — переход вручную; 1–86400 — по таймеру.')}</small>
          <button
            className="button"
            disabled={!studio.scene || stages.length >= maxSequenceStages}
            onClick={() => {
              if (studio.scene)
                edit([...stages, { id: crypto.randomUUID(), sceneId: studio.scene.id, seconds: 0 }]);
            }}
          >
            <Plus size={16} />
            {t('Добавить текущую сцену')}
          </button>
        </fieldset>
        <div className="sequence-controls">
          <button
            className="button primary"
            disabled={
              active ||
              studio.busy ||
              !stages.some((stage) => studio.scenes.some((scene) => scene.id === stage.sceneId))
            }
            onClick={() => void controller.start(stages)}
          >
            <Play size={16} />
            {t('Запустить последовательность')}
          </button>
          <button
            className="button"
            disabled={state.phase !== 'running' || state.transitioning || studio.busy}
            onClick={() => void controller.next()}
          >
            <SkipForward size={16} />
            {t('Следующий этап')}
          </button>
          <button
            className="button"
            disabled={state.phase !== 'running'}
            onClick={() => void controller.stop()}
          >
            <Square size={16} />
            {t('Остановить последовательность')}
          </button>
        </div>
        <p role="status" aria-label={t('Последовательность сцен')}>
          {state.phase === 'stopping'
            ? t('Возврат к исходной сцене…')
            : state.transitioning
              ? t('Переключение сцены…')
              : state.phase === 'running'
                ? t('Этап {number} из {count}', { number: state.index + 1, count: stages.length })
                : state.result
                  ? t(messages[state.result])
                  : ''}
        </p>
        {storageError && (
          <p role="alert">{t('Не удалось сохранить последовательность на этом устройстве.')}</p>
        )}
      </div>
    </details>
  );
}
