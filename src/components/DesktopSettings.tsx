import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { IconButton } from './Controls';

export function DesktopSettings({ onClose, canRestart }: { onClose: () => void; canRestart: boolean }) {
  const [status, setStatus] = useState<DesktopStatus>();
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    const refresh = () =>
      void window.bardforge
        ?.status()
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch(() => {
          if (active) setError('Не удалось прочитать состояние приложения.');
        });
    refresh();
    const timer = setInterval(refresh, 500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const action = (promise?: Promise<void>) =>
    void promise?.catch(() => setError('Не удалось выполнить действие. Попробуйте ещё раз.'));
  return (
    <dialog ref={dialog} className="dialog desktop-settings" onCancel={onClose}>
      <header>
        <h2>Приложение и компоненты</h2>
        <IconButton label="Закрыть настройки" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </header>
      <p>
        Микшер работает сразу после установки. Дополнительные компоненты хранятся отдельно от системных
        программ.
      </p>
      {error && <p role="alert">{error}</p>}
      {!window.bardforge ? (
        <p>Управление компонентами доступно в приложении Windows.</p>
      ) : !status ? (
        <p>Загрузка…</p>
      ) : (
        <>
          <section className="component-card">
            <h3>
              BardForge Studio <small>{status.version}</small>
            </h3>
            <p role="status">{status.update.message}</p>
            {status.update.percent !== undefined && (
              <progress max={100} value={status.update.percent} aria-label="Загрузка обновления" />
            )}
            {status.update.status === 'ready' ? (
              <>
                <button
                  className="button primary"
                  disabled={!canRestart}
                  onClick={() => action(window.bardforge?.installUpdate())}
                >
                  Установить и перезапустить
                </button>
                {!canRestart && <small>Остановите воспроизведение и дождитесь сохранения сцены.</small>}
              </>
            ) : (
              <button
                className="button"
                disabled={['development', 'checking', 'downloading'].includes(status.update.status)}
                onClick={() => action(window.bardforge?.checkUpdates())}
              >
                Проверить обновления
              </button>
            )}
          </section>
          {status.components.map((component) => (
            <section className="component-card" key={component.id}>
              <h3>
                {component.name} <small>{(component.bytes / 1024 / 1024).toFixed(1)} МБ</small>
              </h3>
              <p>{component.description}</p>
              <p role="status">
                {component.status === 'installed'
                  ? 'Установлен и проверен'
                  : component.status === 'installing'
                    ? 'Распаковка и проверка…'
                    : component.status === 'downloading'
                      ? `Загрузка: ${Math.round((component.received / component.bytes) * 100)}%`
                      : (component.message ?? 'Можно загрузить заранее')}
              </p>
              {component.status === 'downloading' && (
                <progress
                  max={component.bytes}
                  value={component.received}
                  aria-label={`Загрузка: ${component.name}`}
                />
              )}
              {['downloading', 'installing'].includes(component.status) ? (
                <button
                  className="button"
                  onClick={() => action(window.bardforge?.cancelComponent(component.id))}
                >
                  Приостановить
                </button>
              ) : (
                component.status !== 'installed' && (
                  <button
                    className="button"
                    onClick={() => action(window.bardforge?.installComponent(component.id))}
                  >
                    <Download size={16} />{' '}
                    {component.status === 'paused'
                      ? 'Продолжить загрузку'
                      : component.status === 'error'
                        ? 'Повторить'
                        : 'Подготовить компонент'}
                  </button>
                )
              )}
            </section>
          ))}
          <small>
            AI-модели появятся вместе с соответствующими функциями. Сейчас генерация звука и каталог
            AI-моделей ещё не реализованы.
          </small>
        </>
      )}
    </dialog>
  );
}
