const HEADING_PATTERN = /^\s*(?:#{1,6}\s*)?Глава\s+(\d+)(?:\s*[.:—-]\s*(.*))?\s*$/i;

const CHAPTER_TITLES = [
  'Начало приключения',
  'Неожиданная встреча',
  'Первая тайна',
  'Дорога вперёд',
  'Важная подсказка',
  'Смелое решение',
  'Испытание дружбы',
  'Разгадка близко',
  'Последний шаг',
  'Добрый финал',
];

function chapterTitle(index: number, total: number): string {
  if (index === 0) return CHAPTER_TITLES[0];
  if (index === total - 1) return CHAPTER_TITLES[CHAPTER_TITLES.length - 1];
  return CHAPTER_TITLES[Math.min(index, CHAPTER_TITLES.length - 2)];
}

function splitIntoUnits(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.replace(HEADING_PATTERN, '').trim())
    .filter(Boolean);

  if (paragraphs.length > 1) return paragraphs;

  const sentences = text
    .replace(/^\s*(?:#{1,6}\s*)?Глава[^\n]*$/gim, '')
    .match(/[^.!?…]+(?:[.!?…]+|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences && sentences.length > 0 ? sentences : [text.trim()];
}

export function normalizeStoryChapters(storyText: string, requestedChapters: number): string {
  const text = storyText.replace(/\r\n?/g, '\n').replace(/\*\*/g, '').trim();
  const chapters = Math.max(1, Math.min(10, Math.round(requestedChapters || 1)));
  if (!text) return text;

  const lines = text.split('\n');
  const headingCount = lines.filter((line) => HEADING_PATTERN.test(line)).length;

  if (headingCount === chapters) {
    let seen = 0;
    return lines.map((line) => {
      const match = line.match(HEADING_PATTERN);
      if (!match) return line;
      const title = match[2]?.trim() || chapterTitle(seen, chapters);
      seen += 1;
      return `Глава ${seen}. ${title}`;
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const contentWithoutHeadings = lines
    .filter((line) => !HEADING_PATTERN.test(line))
    .join('\n')
    .trim();
  const units = splitIntoUnits(contentWithoutHeadings);
  const actualChapters = Math.min(chapters, units.length);

  return Array.from({ length: actualChapters }, (_, index) => {
    const start = Math.floor((index * units.length) / actualChapters);
    const end = Math.floor(((index + 1) * units.length) / actualChapters);
    const body = units.slice(start, Math.max(start + 1, end)).join('\n\n').trim();
    return `Глава ${index + 1}. ${chapterTitle(index, actualChapters)}\n\n${body}`;
  }).join('\n\n');
}

export function isStoryProbablyComplete(storyText: string): boolean {
  const text = storyText
    .replace(/\r\n?/g, '\n')
    .replace(/[\s"'»”)\]]+$/g, '')
    .trim();

  if (!text) return false;
  if (!/[.!?…]$/.test(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 20) return false;

  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  const lastParagraphWords = lastParagraph.split(/\s+/).filter(Boolean);

  return lastParagraphWords.length >= 4;
}
