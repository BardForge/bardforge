import { t, numberText, errorText } from '../i18n';
import type { MessageKey } from '../messages';
import { LanguagePicker } from './LanguagePicker';
import { WorkspaceSettings } from './WorkspaceSettings';
import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { IconButton } from './Controls';
export function DesktopSettings({ onClose, canRestart }: { onClose: () => void; canRestart: boolean }) {
  const [status, setStatus] = useState<DesktopStatus>();
  const [error, setError] = useState<MessageKey | ''>('');
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
  const updateMessages: Record<DesktopStatus['update']['status'], MessageKey> = {
    idle: 'Проверка обновлений ещё не выполнялась.',
    development: 'Тестовая сборка. Обновления включатся в стабильном выпуске.',
    checking: 'Проверяем обновления…',
    current: 'Установлена последняя версия.',
    downloading: 'Обновление загружается в фоне…',
    ready: 'Обновление готово. Установите его после завершения сессии.',
    error: 'Не удалось получить обновление. Проверьте подключение и повторите позже.',
  };
  return (
    <dialog ref={dialog} className="dialog desktop-settings" onCancel={onClose}>
      <header>
        <h2>{t('Приложение и компоненты')}</h2>
        <IconButton label={t('Закрыть настройки')} onClick={onClose}>
          <X size={20} />
        </IconButton>
      </header>
      <LanguagePicker />
      <WorkspaceSettings />
      <p>
        {t(
          'Микшер работает сразу после установки. Дополнительные компоненты хранятся отдельно от системных программ.',
        )}
      </p>
      {error && <p role="alert">{errorText(error)}</p>}
      {!window.bardforge ? (
        <p>{t('Управление компонентами доступно в приложении Windows.')}</p>
      ) : !status ? (
        <p>{t('Загрузка…')}</p>
      ) : (
        <>
          <section className="component-card">
            <h3>
              BardForge Studio <small>{status.version}</small>
            </h3>
            <p role="status">{t(updateMessages[status.update.status])}</p>
            {status.update.percent !== undefined && (
              <progress max={100} value={status.update.percent} aria-label={t('Загрузка обновления')} />
            )}
            {status.update.status === 'ready' ? (
              <>
                <button
                  className="button primary"
                  disabled={!canRestart}
                  onClick={() => action(window.bardforge?.installUpdate())}
                >
                  {t('Установить и перезапустить')}
                </button>
                {!canRestart && (
                  <small>{t('Остановите воспроизведение и дождитесь сохранения сцены.')}</small>
                )}
              </>
            ) : (
              <button
                className="button"
                disabled={['development', 'checking', 'downloading'].includes(status.update.status)}
                onClick={() => action(window.bardforge?.checkUpdates())}
              >
                {t('Проверить обновления')}
              </button>
            )}
          </section>
          {status.components.map((component) => (
            <section className="component-card" key={component.id}>
              <h3>
                {t('Python для модулей')}{' '}
                <small>
                  {numberText(component.bytes / 1024 / 1024, 1)} {t('МБ')}
                </small>
              </h3>
              <p>
                {t(
                  'Изолированный Python {version}. Микшер работает без него; среда предназначена для дополнительных модулей.',
                  { version: component.version },
                )}
              </p>
              <p role="status">
                {component.status === 'installed'
                  ? t('Установлен и проверен')
                  : component.status === 'installing'
                    ? t('Распаковка и проверка…')
                    : component.status === 'downloading'
                      ? t('Загрузка: {percent}%', {
                          percent: numberText((component.received / component.bytes) * 100),
                        })
                      : component.status === 'paused'
                        ? t('Загрузка приостановлена. Можно продолжить.')
                        : component.status === 'error'
                          ? t(
                              component.errorCode === 'disk-space'
                                ? 'Недостаточно места на диске.'
                                : 'Не удалось подготовить компонент. Проверьте сеть и место на диске, затем повторите.',
                            )
                          : t('Можно загрузить заранее')}
              </p>
              {component.status === 'downloading' && (
                <progress
                  max={component.bytes}
                  value={component.received}
                  aria-label={t('Загрузка: {name}', { name: t('Python для модулей') })}
                />
              )}
              {['downloading', 'installing'].includes(component.status) ? (
                <button
                  className="button"
                  onClick={() => action(window.bardforge?.cancelComponent(component.id))}
                >
                  {t('Приостановить')}
                </button>
              ) : (
                component.status !== 'installed' && (
                  <button
                    className="button"
                    onClick={() => action(window.bardforge?.installComponent(component.id))}
                  >
                    <Download size={16} />{' '}
                    {component.status === 'paused'
                      ? t('Продолжить загрузку')
                      : component.status === 'error'
                        ? t('Повторить')
                        : t('Подготовить компонент')}
                  </button>
                )
              )}
            </section>
          ))}
          <small>
            {t(
              'AI-модели появятся вместе с соответствующими функциями. Сейчас генерация звука и каталог AI-моделей ещё не реализованы.',
            )}
          </small>
        </>
      )}
    </dialog>
  );
}
