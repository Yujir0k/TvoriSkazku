import { describe, expect, it } from 'vitest';

import { findPersonalData, hasPersonalData, hasUnsafeNameInput } from './personal-data-filter.js';

describe('personal-data-filter', () => {
  it.each([
    'street yugo vostok 32',
    'passport no 4512 123456',
    'passport number AB 1234567',
    'p a s s p o r t no: 4512-123456',
    'driver license 123456789',
    'series 4512 number 123456 issued by department',
    'pasport seria 4512 nomer 123456',
    'email name at example dot com',
    'john dot smith at example dot ru',
    'phone +7 999 123 45 67',
    'СНИЛС 123-456-789 00',
    'ИНН 770708389312',
    'social security number 123-45-6789',
    'код подразделения 770-001',
    'адрес: Москва улица Лесная дом 7 квартира 12',
    'дом 32 квартира 7',
    'Петров Иван Иванович 4618 18219',
    'Иванов Сергей Петрович номер 12345',
    'однажды герой нашёл записку 4618 18219',
    'школа 57',
    'школа №57',
    'школа N57',
    'школа номер 57',
    'детский сад №12',
    'детский сад 12',
    'детсад 12',
    'школа 57 класс 3а',
    'учится в школе 57 в 3 классе',
    'детский сад группа ромашка',
    'Дата рождения 12.05.2019 волшебная',
    'родился 05.12.2018 в волшебной стране',
    'дата рождения: 15.03.2020',
    'рождение 12.06.2018',
  ])('blocks personal data: %s', (text) => {
    expect(hasPersonalData(text)).toBe(true);
    expect(findPersonalData(text).length).toBeGreaterThan(0);
  });

  it.each([
    'сказка про дракончика и цветы',
    'сказка про маленький домик на дереве',
    'little fox finds a magic lantern',
    'road to the cloud castle',
    'волшебный поезд едет к станции цветных снов',
    'сказка про девочку Алису и добрую фею',
    'Саша, Маша и дедушка нашли светящуюся звезду',
    'Петров Иван Иванович стал сказочным садовником',
    'Глава 1. Петров Иван Иванович нашёл волшебную станцию. Глава 2. Друзья вернулись домой. Глава 10. Финал.',
    'Иван Иванович нашёл вагон номер семь и помог ему доехать до Луны.',
    'сказка про школу волшебства и 3 желания',
    'заключение сказки было счастливым',
    'школа волшебства и магии',
    'лесная школа для зверят',
    'заключение было добрым и светлым',
    'школа волшебства',
    'сказка про школу волшебства',
    'лесная школа',
  ])('allows safe story idea: %s', (text) => {
    expect(hasPersonalData(text)).toBe(false);
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
