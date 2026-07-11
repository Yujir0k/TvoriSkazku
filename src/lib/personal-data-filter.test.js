import { describe, expect, it } from 'vitest';

import { hasPersonalData, hasUnsafeNameInput } from './personal-data-filter.js';

describe('frontend personal data filter', () => {
  it.each([
    'street yugo vostok 32',
    'passport no 4512 123456',
    'p a s s p o r t no: 4512-123456',
    'series 4512 number 123456 issued by department',
    'name at example dot com',
    'john dot smith at example dot ru',
    '+7 999 123 45 67',
    'адрес: улица Лесная дом 7',
    'home address 45 moon road',
    'Петров Иван Иванович 4618 18219',
    'Иванов Сергей Петрович номер 12345',
    'однажды герой нашёл записку 4618 18219',
  ])('blocks risky input: %s', (text) => {
    expect(hasPersonalData(text)).toBe(true);
  });

  it('allows ordinary story ideas', () => {
    expect(hasPersonalData('сказка про сову, облака и волшебную библиотеку')).toBe(false);
    expect(hasPersonalData('маленький домик на дереве нашёл дорогу к замку')).toBe(false);
    expect(hasPersonalData('road to the cloud castle')).toBe(false);
    expect(hasPersonalData('сказка про девочку Алису и добрую фею')).toBe(false);
    expect(hasPersonalData('Саша, Маша и дедушка нашли светящуюся звезду')).toBe(false);
    expect(hasPersonalData('Петров Иван Иванович стал сказочным садовником')).toBe(false);
    expect(
      hasPersonalData(
        'Глава 1. Петров Иван Иванович нашёл волшебную станцию. Глава 2. Друзья вернулись домой. Глава 10. Финал.',
      ),
    ).toBe(false);
    expect(hasPersonalData('Иван Иванович нашёл вагон номер семь и помог ему доехать до Луны.')).toBe(false);
  });

  it('blocks unsafe child name values', () => {
    expect(hasUnsafeNameInput('Алина 4546 472')).toBe(true);
    expect(hasUnsafeNameInput('street yugo 32')).toBe(true);
    expect(hasUnsafeNameInput('ул Лесная 7')).toBe(true);
  });

  it('allows ordinary child names', () => {
    expect(hasUnsafeNameInput('Алина')).toBe(false);
    expect(hasUnsafeNameInput('Иван Иванович')).toBe(false);
  });
});
