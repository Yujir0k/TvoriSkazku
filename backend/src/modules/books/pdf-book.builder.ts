import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import { storage } from '../../lib/storage.js';

const FONTS_DIR = path.resolve(process.cwd(), 'src', 'assets', 'fonts');
const CHAPTER_RE = /^\s*(?:#{1,6}\s*)?Глава\s+\d+(?:\s*[.:—-]\s*.*)?\s*$/i;

export interface PdfIllustrationRef {
  objectName: string | null;
  mimeType: string;
}

export interface StoryBookPdfInput {
  title: string;
  authorName?: string | null;
  format: string;
  content: string;
  illustrations: PdfIllustrationRef[];
}

export interface BookTextBlock {
  kind: 'heading' | 'paragraph';
  text: string;
}

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s*/g, '')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

export function parseBookText(content: string): BookTextBlock[] {
  const normalized = content.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  let chunks = normalized.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (chunks.length === 1 && normalized.includes('\n')) {
    chunks = normalized.split('\n').map((part) => part.trim()).filter(Boolean);
  }

  const blocks: BookTextBlock[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (CHAPTER_RE.test(lines[0])) {
      blocks.push({ kind: 'heading', text: cleanInlineMarkdown(lines[0]) });
      const remainder = cleanInlineMarkdown(lines.slice(1).join(' '));
      if (remainder) blocks.push({ kind: 'paragraph', text: remainder });
      continue;
    }

    const paragraph = cleanInlineMarkdown(lines.join(' '));
    if (paragraph) blocks.push({ kind: 'paragraph', text: paragraph });
  }

  return blocks;
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const parts: string[] = [];
  let part = '';
  for (const char of word) {
    const candidate = part + char;
    if (part && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      parts.push(part);
      part = char;
    } else {
      part = candidate;
    }
  }
  if (part) parts.push(part);
  return parts;
}

export function wrapBookText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = '';
  for (const originalWord of words) {
    const wordParts = font.widthOfTextAtSize(originalWord, size) > maxWidth
      ? splitLongWord(originalWord, font, size, maxWidth)
      : [originalWord];

    for (const word of wordParts) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function loadIllustrationBuffers(refs: PdfIllustrationRef[]): Promise<Array<{ bytes: Buffer; mimeType: string }>> {
  const supported = refs
    .filter((item): item is PdfIllustrationRef & { objectName: string } => Boolean(item.objectName))
    .filter((item) => item.mimeType === 'image/png' || item.mimeType === 'image/jpeg')
    .slice(0, 12);

  const results = await Promise.all(supported.map(async (item) => {
    try {
      const object = await storage.getObject(item.objectName);
      return { bytes: await streamToBuffer(object.stream), mimeType: item.mimeType };
    } catch {
      return null;
    }
  }));
  return results.filter((item): item is { bytes: Buffer; mimeType: string } => Boolean(item));
}

function drawImageContained(page: PDFPage, image: PDFImage, x: number, yTop: number, maxWidth: number, maxHeight: number): number {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const imageX = x + (maxWidth - width) / 2;
  const imageY = yTop - height;
  page.drawRectangle({
    x: imageX - 6,
    y: imageY - 6,
    width: width + 12,
    height: height + 12,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.88, 0.78, 0.65),
    borderWidth: 0.8,
  });
  page.drawImage(image, { x: imageX, y: imageY, width, height });
  return height + 18;
}

export async function buildStoryBookPdf(input: StoryBookPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fontkitModule = await import('fontkit');
  doc.registerFontkit(((fontkitModule as { default?: unknown }).default || fontkitModule) as any);

  const fontPath = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
  if (!fs.existsSync(fontPath) || fs.statSync(fontPath).size < 1000) {
    throw new Error('Кириллический шрифт для PDF не найден');
  }
  const font = await doc.embedFont(fs.readFileSync(fontPath));

  const isA5 = input.format === 'a5';
  const pageWidth = isA5 ? 420 : 595;
  const pageHeight = isA5 ? 595 : 842;
  const margin = isA5 ? 38 : 54;
  const contentWidth = pageWidth - margin * 2;
  const bodySize = isA5 ? 10.8 : 12.2;
  const lineHeight = isA5 ? 15.8 : 18.2;
  const headingSize = isA5 ? 17 : 20;
  const top = pageHeight - margin - 28;
  const bottom = margin + 24;
  const accent = rgb(0.82, 0.32, 0.13);
  const ink = rgb(0.19, 0.15, 0.15);
  const muted = rgb(0.43, 0.39, 0.36);
  const paper = rgb(0.995, 0.982, 0.955);
  const warm = rgb(0.97, 0.91, 0.82);

  doc.setTitle(input.title);
  doc.setAuthor(input.authorName || 'ТвориСказку');
  doc.setSubject('Персональная сказочная книга');
  doc.setCreator('ТвориСказку');
  doc.setProducer('ТвориСказку PDF');

  const rawImages = await loadIllustrationBuffers(input.illustrations);
  const embeddedImages: PDFImage[] = [];
  for (const item of rawImages) {
    try {
      embeddedImages.push(item.mimeType === 'image/png'
        ? await doc.embedPng(item.bytes)
        : await doc.embedJpg(item.bytes));
    } catch {
      // A damaged optional illustration must not break the whole book.
    }
  }

  // Cover is always isolated from body text, preventing the original overlap.
  const cover = doc.addPage([pageWidth, pageHeight]);
  cover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
  cover.drawRectangle({
    x: margin / 2,
    y: margin / 2,
    width: pageWidth - margin,
    height: pageHeight - margin,
    borderColor: rgb(0.84, 0.66, 0.47),
    borderWidth: 1.2,
  });
  cover.drawRectangle({ x: 0, y: pageHeight - (isA5 ? 18 : 24), width: pageWidth, height: isA5 ? 18 : 24, color: warm });

  let coverTitleTop = pageHeight - margin - 76;
  let usedImageCount = 0;
  if (embeddedImages[0]) {
    const imageHeight = drawImageContained(
      cover,
      embeddedImages[0],
      margin,
      pageHeight - margin - 24,
      contentWidth,
      pageHeight * 0.39,
    );
    coverTitleTop = pageHeight - margin - 24 - imageHeight - 24;
    usedImageCount = 1;
  }

  let coverTitleSize = isA5 ? 25 : 31;
  let titleLines = wrapBookText(input.title, font, coverTitleSize, contentWidth);
  while ((titleLines.length > 4 || titleLines.length * coverTitleSize * 1.25 > pageHeight * 0.27) && coverTitleSize > 18) {
    coverTitleSize -= 1;
    titleLines = wrapBookText(input.title, font, coverTitleSize, contentWidth);
  }
  const titleBlockHeight = titleLines.length * coverTitleSize * 1.25;
  let titleY = Math.max(margin + 110 + titleBlockHeight, coverTitleTop);
  for (const line of titleLines) {
    const width = font.widthOfTextAtSize(line, coverTitleSize);
    cover.drawText(line, {
      x: Math.max(margin, (pageWidth - width) / 2),
      y: titleY - coverTitleSize,
      size: coverTitleSize,
      font,
      color: ink,
    });
    titleY -= coverTitleSize * 1.25;
  }

  cover.drawRectangle({ x: pageWidth / 2 - 28, y: titleY - 8, width: 56, height: 2, color: accent });
  if (input.authorName) {
    const author = `Автор: ${input.authorName}`;
    const authorSize = isA5 ? 10.5 : 12;
    const authorWidth = font.widthOfTextAtSize(author, authorSize);
    cover.drawText(author, { x: (pageWidth - authorWidth) / 2, y: titleY - 38, size: authorSize, font, color: muted });
  }
  const brand = 'ТвориСказку';
  const brandSize = isA5 ? 9 : 10;
  cover.drawText(brand, {
    x: (pageWidth - font.widthOfTextAtSize(brand, brandSize)) / 2,
    y: margin,
    size: brandSize,
    font,
    color: accent,
  });

  const contentPages: PDFPage[] = [];
  const addContentPage = () => {
    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
    page.drawRectangle({ x: margin, y: pageHeight - margin + 4, width: contentWidth, height: 1.2, color: warm });
    const runningTitle = input.title.length > 64 ? `${input.title.slice(0, 61)}...` : input.title;
    page.drawText(runningTitle, { x: margin, y: pageHeight - margin + 12, size: isA5 ? 7.5 : 8.5, font, color: muted });
    contentPages.push(page);
    return page;
  };

  let page = addContentPage();
  let y = top;
  let imageIndex = usedImageCount;
  const blocks = parseBookText(input.content);

  const nextPage = () => {
    page = addContentPage();
    y = top;
  };

  for (const block of blocks) {
    if (block.kind === 'heading') {
      const headingLines = wrapBookText(block.text, font, headingSize, contentWidth);
      const required = headingLines.length * headingSize * 1.2 + lineHeight * 3 + 18;
      if (y - required < bottom) nextPage();

      page.drawRectangle({ x: margin, y: y - 3, width: 34, height: 2.4, color: accent });
      y -= 19;
      for (const line of headingLines) {
        page.drawText(line, { x: margin, y: y - headingSize, size: headingSize, font, color: ink });
        y -= headingSize * 1.2;
      }
      y -= 8;

      if (embeddedImages[imageIndex]) {
        const maxImageHeight = isA5 ? 130 : 190;
        if (y - maxImageHeight - 24 < bottom) nextPage();
        y -= drawImageContained(page, embeddedImages[imageIndex], margin, y, contentWidth, maxImageHeight);
        imageIndex += 1;
        y -= 6;
      }
      continue;
    }

    const lines = wrapBookText(block.text, font, bodySize, contentWidth);
    let cursor = 0;
    while (cursor < lines.length) {
      let available = Math.floor((y - bottom) / lineHeight);
      if (available < 2) {
        nextPage();
        available = Math.floor((y - bottom) / lineHeight);
      }

      let take = Math.min(available, lines.length - cursor);
      if (lines.length - cursor - take === 1 && take > 2) take -= 1;

      for (let index = 0; index < take; index += 1) {
        page.drawText(lines[cursor + index], { x: margin, y: y - bodySize, size: bodySize, font, color: ink });
        y -= lineHeight;
      }
      cursor += take;
      if (cursor < lines.length) nextPage();
    }
    y -= isA5 ? 7 : 9;
  }

  // Empty stories still produce a deliberate, readable page rather than a blank artifact.
  if (blocks.length === 0) {
    page.drawText('Текст сказки пока не добавлен.', { x: margin, y: top - bodySize, size: bodySize, font, color: muted });
  }

  for (let index = 0; index < contentPages.length; index += 1) {
    const contentPage = contentPages[index];
    const label = String(index + 1);
    contentPage.drawRectangle({ x: margin, y: margin - 5, width: contentWidth, height: 0.8, color: warm });
    contentPage.drawText(label, {
      x: (pageWidth - font.widthOfTextAtSize(label, 9)) / 2,
      y: margin - 22,
      size: 9,
      font,
      color: muted,
    });
  }

  return Buffer.from(await doc.save());
}
