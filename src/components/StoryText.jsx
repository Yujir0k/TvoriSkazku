import React from 'react';

const CHAPTER_HEADING = /^Глава\s+\d+[.:—-]?\s*(.*)$/i;

export function parseStoryChapters(text = '') {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const chapters = [];
  let current = { title: '', paragraphs: [] };
  let paragraph = [];

  const flushParagraph = () => {
    const value = paragraph.join(' ').trim();
    if (value) current.paragraphs.push(value);
    paragraph = [];
  };
  const flushChapter = () => {
    flushParagraph();
    if (current.title || current.paragraphs.length > 0) chapters.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(CHAPTER_HEADING);
    if (heading) {
      flushChapter();
      current = { title: line, paragraphs: [] };
    } else if (!line) {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  flushChapter();
  return chapters;
}

export default function StoryText({ text }) {
  const chapters = parseStoryChapters(text);
  return (
    <article className="mx-auto max-w-[820px] text-text">
      {chapters.map((chapter, chapterIndex) => (
        <section
          key={`${chapter.title}-${chapterIndex}`}
          className={chapterIndex > 0 ? 'mt-10 pt-9 border-t border-border-soft' : ''}
        >
          {chapter.title ? (
            <h3 className="font-title text-2xl md:text-3xl font-bold text-title leading-tight mb-5">
              {chapter.title}
            </h3>
          ) : null}
          <div className="space-y-4">
            {chapter.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="text-[15px] md:text-[17px] leading-[1.85] text-text/90">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
