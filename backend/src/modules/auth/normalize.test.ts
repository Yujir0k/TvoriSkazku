import { describe, it, expect } from 'vitest';

import { normalizeEmail, normalizeName } from './normalize.js';

describe('normalize', () => {
  describe('normalizeEmail', () => {
    it('приводит к нижнему регистру', () => {
      expect(normalizeEmail('USER@Example.COM')).toBe('user@example.com');
    });

    it('обрезает пробелы', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('обрабатывает пустую строку', () => {
      expect(normalizeEmail('')).toBe('');
    });
  });

  describe('normalizeName', () => {
    it('обрезает пробелы', () => {
      expect(normalizeName('  Иван  ')).toBe('Иван');
    });

    it('обрабатывает пустую строку', () => {
      expect(normalizeName('')).toBe('');
    });
  });
});
