import { describe, expect, it } from 'vitest';
import { parseStoryChapters } from './StoryText.jsx';

describe('parseStoryChapters', () => {
  it('separates chapter headings and paragraphs', () => {
    const result = parseStoryChapters('Глава 1. Начало\n\nПервый абзац.\n\nГлава 2. Домой\n\nФинал.');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Глава 1. Начало');
    expect(result[1].paragraphs).toEqual(['Финал.']);
  });

  it('keeps a legacy story without headings readable', () => {
    const result = parseStoryChapters('Первый абзац.\n\nВторой абзац.');
    expect(result).toHaveLength(1);
    expect(result[0].paragraphs).toHaveLength(2);
  });
});
