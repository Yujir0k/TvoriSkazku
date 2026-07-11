import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';

import { buildStoryBookPdf, parseBookText } from './pdf-book.builder.js';

describe('PDF book builder', () => {
  it('separates chapter headings from paragraphs', () => {
    expect(parseBookText('Глава 1. Начало\n\nЖила-была девочка.\n\nГлава 2. Финал\n\nВсе вернулись домой.')).toEqual([
      { kind: 'heading', text: 'Глава 1. Начало' },
      { kind: 'paragraph', text: 'Жила-была девочка.' },
      { kind: 'heading', text: 'Глава 2. Финал' },
      { kind: 'paragraph', text: 'Все вернулись домой.' },
    ]);
  });

  it('creates a separate cover and paginated Cyrillic content', async () => {
    const paragraph = 'Однажды маленькая звезда отправилась через волшебный лес и встретила добрых друзей. '.repeat(35);
    const bytes = await buildStoryBookPdf({
      title: 'Очень длинное название доброй сказки о путешествии к звёздам',
      authorName: 'Алиса',
      format: 'a4',
      content: `Глава 1. Начало приключения\n\n${paragraph}\n\nГлава 2. Добрый финал\n\n${paragraph}`,
      illustrations: [],
    });

    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
