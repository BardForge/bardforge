import { useId } from 'react';
import { useLanguage } from '../i18n';
import { accents, themes, useWorkspacePreferences } from '../workspace';
import { workspaceEn } from '../workspace-messages';

export function WorkspaceSettings() {
  const id = useId();
  const { language } = useLanguage();
  const preferences = useWorkspacePreferences();
  const t = (key: keyof typeof workspaceEn) => (language === 'ru' ? key : workspaceEn[key]);
  const themeLabels = { dark: 'Тёмная', light: 'Светлая', system: 'Как в системе' } as const;
  const accentLabels = { amber: 'Янтарный', violet: 'Фиолетовый', teal: 'Бирюзовый', blue: 'Синий' } as const;
  return (
    <section className="component-card workspace-settings" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('Рабочее пространство')}</h3>
      <fieldset>
        <legend>{t('Тема оформления')}</legend>
        <div className="appearance-options">
          {themes.map((theme) => (
            <label className="appearance-option" key={theme}>
              <input
                type="radio"
                name={`${id}-theme`}
                value={theme}
                checked={preferences.theme === theme}
                onChange={() => preferences.update({ theme })}
              />
              {t(themeLabels[theme])}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('Цвет акцента')}</legend>
        <div className="appearance-options">
          {accents.map((accent) => (
            <label className="appearance-option" key={accent}>
              <input
                type="radio"
                name={`${id}-accent`}
                value={accent}
                checked={preferences.accent === accent}
                onChange={() => preferences.update({ accent })}
              />
              <span className={`accent-swatch swatch-${accent}`} aria-hidden="true" />
              {t(accentLabels[accent])}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="compact-option">
        <input
          type="checkbox"
          checked={preferences.compact}
          aria-describedby={`${id}-compact-description`}
          onChange={(event) => preferences.update({ compact: event.target.checked })}
        />
        {t('Компактный микшер')}
      </label>
      <small id={`${id}-compact-description`}>
        {t('Меньше отступов; все дорожки и элементы управления остаются доступны.')}
      </small>
      {preferences.saved ? (
        <small>{t('Оформление сохраняется на этом компьютере.')}</small>
      ) : (
        <p role="alert">{t('Не удалось сохранить оформление. После перезапуска выберите его снова.')}</p>
      )}
    </section>
  );
}
