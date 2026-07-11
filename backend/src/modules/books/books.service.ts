import { prisma } from '../../lib/prisma.js';
import { uploadFile, deleteFile } from '../../lib/file-helper.js';
import { storage } from '../../lib/storage.js';
import { incrementUsage } from '../tariffs/tariffs.service.js';
import type { CreateBookInput, UpdateBookInput } from './books.schema.js';
import { buildStoryBookPdf } from './pdf-book.builder.js';

export async function getBooks(userId: string) {
  return prisma.bookProject.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getBookById(bookId: string, userId: string) {
  const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
  if (!book || book.userId !== userId) return null;
  return book;
}

export async function createBook(userId: string, data: CreateBookInput) {
  const story = await prisma.story.findUnique({ where: { id: data.storyId }, select: { userId: true } });
  if (!story || story.userId !== userId) return null;

  return prisma.bookProject.create({
    data: {
      userId,
      storyId: data.storyId,
      title: data.title,
      authorName: data.authorName,
      format: data.format,
      coverSettings: data.coverSettings,
      status: 'draft',
    },
  });
}

export async function updateBook(bookId: string, userId: string, data: UpdateBookInput) {
  const existing = await getBookById(bookId, userId);
  if (!existing) return null;

  return prisma.bookProject.update({
    where: { id: bookId },
    data,
  });
}

export async function deleteBook(bookId: string, userId: string): Promise<boolean> {
  const existing = await getBookById(bookId, userId);
  if (!existing) return false;

  // Delete old PDF if exists
  if (existing.pdfObjectName) {
    try { await deleteFile(existing.pdfObjectName); } catch {}
  }

  await prisma.bookProject.delete({ where: { id: bookId } });
  return true;
}

export async function generatePdf(bookId: string, userId: string) {
  const book = await getBookById(bookId, userId);
  if (!book) return null;

  const story = await prisma.story.findUnique({ where: { id: book.storyId } });
  if (!story) return null;

  // Get illustrations for this story
  const illustrations = await prisma.storyIllustration.findMany({
    where: { storyId: story.id, objectName: { not: null } },
    orderBy: [{ sceneId: 'asc' }, { createdAt: 'asc' }],
    select: { objectName: true, mimeType: true },
  });
  const pdfBytes = await buildStoryBookPdf({
    title: book.title,
    authorName: book.authorName,
    format: book.format,
    content: story.content,
    illustrations: illustrations || [],
  });

  // Upload to MinIO
  const result = await uploadFile(userId, pdfBytes, 'application/pdf', `${book.title}.pdf`, 'pdf');

  try { await incrementUsage(userId, 'pdfBooks'); } catch {}

  // Delete old PDF if replacing
  if (book.pdfObjectName) {
    try { await deleteFile(book.pdfObjectName); } catch {}
  }

  // Update book
  return prisma.bookProject.update({
    where: { id: bookId },
    data: {
      pdfObjectName: result.objectName,
      status: 'ready',
      error: null,
    },
  });
}

export async function getBookPdfUrl(bookId: string, userId: string): Promise<string | null> {
  const book = await getBookById(bookId, userId);
  if (!book || !book.pdfObjectName) return null;

  return storage.getUrl(book.pdfObjectName);
}
