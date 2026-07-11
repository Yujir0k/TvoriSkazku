import { prisma } from './prisma.js';
import { storage } from './storage.js';
import { incrementUsage } from '../modules/tariffs/tariffs.service.js';
import type { FileCategory } from './storage.js';

const LOG_PREFIX = '[file-helper]';
const isTest = () => { try { return process.env.NODE_ENV === 'test'; } catch { return false; } };

/**
 * Безопасно уменьшить storageBytes, не опускаясь ниже нуля.
 * Пробрасывает ошибку наверх для возможности отката.
 */
async function decrementStorageSafe(userId: string, size: number): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const counter = await prisma.usageCounter.findFirst({
    where: { userId, resource: 'storageBytes', periodStart: { gte: startOfMonth } },
  });
  if (counter) {
    const newVal = Math.max(0, counter.used - size);
    await prisma.usageCounter.update({
      where: { id: counter.id },
      data: { used: newVal },
    });
  }
}

/**
 * Загрузить файл в MinIO и создать запись UserFile.
 * При ошибке MinIO файл не сохраняется, UserFile не создаётся.
 * При ошибке создания UserFile — удаляет orphan из MinIO.
 */
export async function uploadFile(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  category: FileCategory = 'other',
): Promise<{ objectName: string; size: number; fileId: string }> {
  const { objectName, size } = await storage.upload(userId, buffer, mimeType, originalName, category);

  let file;
  try {
    file = await prisma.userFile.create({
      data: {
        userId,
        objectName,
        originalName: originalName || 'untitled',
        mimeType,
        category,
        size,
      },
    });
  } catch (error) {
    try { await storage.delete(objectName); } catch (e2) {
      if (!isTest()) console.error(LOG_PREFIX, 'orphan cleanup failed:', e2);
    }
    throw error;
  }

  // storage usage — не блокируем возврат при ошибке учёта
  try { await incrementUsage(userId, 'storageBytes', size); } catch (e) {
    if (!isTest()) console.warn(LOG_PREFIX, 'incrementUsage failed:', e);
  }

  return { objectName, size, fileId: file.id };
}

/**
 * Удалить файл из MinIO и удалить запись UserFile.
 * Учитывает уменьшение storageBytes (но не блокирует, т.к. лимит — это счётчик использования).
 */
export async function deleteFile(objectName: string): Promise<void> {
  // Сначала узнаём, кому принадлежит файл и сколько весит
  let fileInfo: { userId: string; size: number } | null = null;
  try {
    const file = await prisma.userFile.findFirst({ where: { objectName } });
    if (file) fileInfo = { userId: file.userId, size: file.size };
  } catch {}

  // Удаляем из MinIO
  await storage.delete(objectName);

  // Удаляем запись UserFile
  const result = await prisma.userFile.deleteMany({ where: { objectName } });

  // Уменьшаем storageBytes
  if (fileInfo && result.count > 0) {
    await decrementStorageSafe(fileInfo.userId, fileInfo.size);
  }
}

/**
 * Безопасная замена файла: загрузить новый, удалить старый.
 * При ошибке удаления старого — откатывает новый (файл + UserFile + storageBytes).
 */
export async function replaceFile(
  userId: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  category: FileCategory,
  oldObjectName: string | null,
): Promise<{ objectName: string; size: number; fileId: string }> {
  const result = await uploadFile(userId, buffer, mimeType, originalName, category);

  if (!oldObjectName) return result;

  try {
    await deleteFile(oldObjectName);
    return result;
  } catch (error) {
    // Откат: удалить новый файл из MinIO, UserFile, и отменить storageBytes
    const rollbackErrors: string[] = [];

    try { await storage.delete(result.objectName); } catch (e) {
      rollbackErrors.push('MinIO delete: ' + e);
    }
    try { await prisma.userFile.deleteMany({ where: { objectName: result.objectName } }); } catch (e) {
      rollbackErrors.push('UserFile delete: ' + e);
    }
    try { await decrementStorageSafe(userId, result.size); } catch (e) {
      rollbackErrors.push('decrement: ' + e);
    }

    if (rollbackErrors.length > 0 && !isTest()) {
      console.error(LOG_PREFIX, 'replaceFile rollback errors:', rollbackErrors);
    }

    throw error;
  }
}
