import { describe, expect, it } from 'vitest';
import { en, nameKeys, type MessageKey } from './messages';
import { errorText, formatMessage, nameOf, readLanguage } from './i18n';

describe('complete RU/EN catalogs', () => {
  it('provides non-empty English messages with exactly the same interpolation variables', () => {
    for (const [source, english] of Object.entries(en)) {
      expect(english.trim(), source).not.toBe('');
      expect(english, source).not.toMatch(/[А-Яа-яЁё]/);
      const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(parameters(english), source).toEqual(parameters(source));
      expect(
        formatMessage('en', source as MessageKey, {
          name: 'My campaign',
          p0: 'test',
          p1: 'test',
          files: 'test.wav',
          percent: 50,
          version: '1',
          count: 3,
          number: 1,
          duration: '00:12',
        }),
      ).not.toMatch(/\{\w+\}/);
    }
  });
  it('keeps custom and legacy names intact, including names equal to translated defaults', () => {
    expect(nameOf({ name: 'Music' })).toBe('Music');
    expect(nameOf({ name: 'Музыка' })).toBe('Музыка');
    expect(nameOf({ name: 'My forest', nameKey: 'Ночной лес' })).toBe('My forest');
    for (const key of nameKeys) expect(en[key]).toBeTruthy();
  });
  it('uses a safe fallback for missing, corrupt or unavailable preferences', () => {
    expect(readLanguage({ getItem: () => 'en' })).toBe('en');
    expect(readLanguage({ getItem: () => 'de' })).toBe('ru');
    expect(
      readLanguage({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe('ru');
    expect(readLanguage()).toBe('ru');
  });
  it('does not expose untranslated platform exception text to users', () => {
    expect(errorText(new Error('Untranslated system error'))).toBe(
      'Не удалось выполнить действие. Попробуйте ещё раз.',
    );
    expect(errorText(new DOMException('OS message', 'QuotaExceededError'))).toContain('Недостаточно места');
  });
});
