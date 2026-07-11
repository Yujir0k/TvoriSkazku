import { describe, expect, it } from 'vitest';
import { isStoryProbablyComplete, normalizeStoryChapters } from './story-format.js';

describe('normalizeStoryChapters', () => {
  it('adds chapter headings and keeps every paragraph', () => {
    const source = [
      'Маша нашла у окна маленькую звезду.',
      'Вместе с котёнком она отправилась искать для неё дом.',
      'Друзья перешли поющий мост и помогли лесным птицам.',
      'На рассвете звезда вернулась на небо, а друзья пришли домой.',
    ].join('\n\n');

    const result = normalizeStoryChapters(source, 3);
    expect(result.match(/^Глава \d+\./gm)).toHaveLength(3);
    expect(result).toContain('Маша нашла');
    expect(result).toContain('друзья пришли домой');
  });

  it('normalizes markdown headings without duplicating chapters', () => {
    const source = '## Глава 1 — Знакомство\n\nНачало.\n\n## Глава 2. Домой\n\nФинал.';
    const result = normalizeStoryChapters(source, 2);
    expect(result).toContain('Глава 1. Знакомство');
    expect(result).toContain('Глава 2. Домой');
    expect(result).not.toContain('##');
  });

  it('detects a completed story ending', () => {
    expect(isStoryProbablyComplete([
      'Глава 1. Добрый финал',
      '',
      'Алиса вернулась домой и поставила звёздочку на окно. Каждый вечер она светила друзьям, чтобы они помнили: добро всегда находит дорогу.',
    ].join('\n'))).toBe(true);
  });

  it('detects a truncated story ending', () => {
    expect(isStoryProbablyComplete([
      'Глава 1. Замок на холме',
      '',
      'Ветер притих. Море',
    ].join('\n'))).toBe(false);
  });
});
