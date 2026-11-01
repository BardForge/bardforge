import { Languages } from 'lucide-react';
import { t, useLanguage } from '../i18n';

export function LanguagePicker() {
  const { language, setLanguage } = useLanguage();
  return (
    <label className="language-picker" title={t('Язык интерфейса')}>
      <Languages size={18} aria-hidden="true" />
      <select
        aria-label="Язык / Language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        <option value="ru" lang="ru">
          Русский
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </label>
  );
}
