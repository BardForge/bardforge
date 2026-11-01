import { useSyncExternalStore } from 'react';
import { en, type MessageKey, type NameKey } from './messages';

export type Language = 'ru' | 'en';
export type Params = Record<string, string | number>;
export const languageKey = 'bardforge.language';
export function readLanguage(storage?: Pick<Storage, 'getItem'>): Language {
  try {
    return storage?.getItem(languageKey) === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}
let language: Language = (() => {
  try {
    return readLanguage(typeof window === 'undefined' ? undefined : window.localStorage);
  } catch {
    return 'ru';
  }
})();
let revision = 0;
let languageSaved = true;
const listeners = new Set<() => void>();
export function formatMessage(locale: Language, key: MessageKey, params: Params = {}): string {
  const text = locale === 'ru' ? key : en[key];
  return text.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match));
}
export function t(key: MessageKey, params?: Params): string {
  return formatMessage(language, key, params);
}
export function setLanguage(value: string) {
  if (value !== 'ru' && value !== 'en') return;
  language = value;
  try {
    localStorage.setItem(languageKey, value);
    languageSaved = true;
  } catch {
    languageSaved = false;
  }
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  revision++;
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => revision,
  );
  return { language, setLanguage, languageSaved };
}
export function nameOf(entity?: { name: string; nameKey?: NameKey } | null): string {
  return entity?.nameKey && entity.name === entity.nameKey ? t(entity.nameKey) : (entity?.name ?? '');
}
export function numberText(value: number, digits = 0) {
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
export class UserError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params?: Params | (() => Params),
  ) {
    super(key);
  }
}
export function errorText(error: unknown): string {
  if (!error) return '';
  if (Array.isArray(error)) return error.map(errorText).join('\n');
  if (error instanceof UserError)
    return t(error.key, typeof error.params === 'function' ? error.params() : error.params);
  if (typeof error === 'object' && 'file' in error && 'error' in error)
    return `${error.file}: ${errorText(error.error)}`;
  const key = error instanceof Error ? error.message : error;
  if (typeof key === 'string' && Object.hasOwn(en, key)) return t(key as MessageKey);
  if (error instanceof Error && error.name === 'QuotaExceededError')
    return t('Недостаточно места для сохранения. Освободите место и повторите.');
  return t('Не удалось выполнить действие. Попробуйте ещё раз.');
}
if (typeof document !== 'undefined') document.documentElement.lang = language;
