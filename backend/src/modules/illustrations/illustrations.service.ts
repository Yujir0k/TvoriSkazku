import { prisma } from '../../lib/prisma.js';
import { uploadFile, deleteFile, replaceFile } from '../../lib/file-helper.js';
import { incrementUsage } from '../tariffs/tariffs.service.js';
import type { CreateIllustrationInput } from './illustrations.schema.js';
import { env } from '../../config/env.js';
import { PolzaImageProvider } from './polza-image.provider.js';
import { assertSafeForExternalAi } from '../../lib/personal-data-filter.js';

const MAX_ILLUSTRATION_SIZE = 15 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Image Provider Interface (future) ─────────────────────────────────────

export const IMAGE_PROVIDER_NOT_CONFIGURED = 'IMAGE_PROVIDER_NOT_CONFIGURED';
export const IMAGE_DISABLED_MESSAGE = 'Генерация иллюстраций будет доступна после подключения сервиса';

export interface ImageProvider {
  createJob(params: { style: string; description: string }): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<{ status: string; imageUrl?: string; error?: string }>;
  cancelJob(jobId: string): Promise<boolean>;
  getResult(jobId: string): Promise<{ url: string } | null>;
}

export function createStubImageProvider(): ImageProvider {
  return {
    async createJob() { throw Object.assign(new Error(IMAGE_DISABLED_MESSAGE), { code: IMAGE_PROVIDER_NOT_CONFIGURED }); },
    async getStatus() { throw Object.assign(new Error(IMAGE_DISABLED_MESSAGE), { code: IMAGE_PROVIDER_NOT_CONFIGURED }); },
    async cancelJob() { throw Object.assign(new Error(IMAGE_DISABLED_MESSAGE), { code: IMAGE_PROVIDER_NOT_CONFIGURED }); },
    async getResult() { throw Object.assign(new Error(IMAGE_DISABLED_MESSAGE), { code: IMAGE_PROVIDER_NOT_CONFIGURED }); },
  };
}

export const isImageProviderConfigured = Boolean(env.POLZA_AI_API_KEY);
export const imageProvider: ImageProvider = isImageProviderConfigured
  ? new PolzaImageProvider()
  : createStubImageProvider();

export function getImageProviderStatus() {
  return {
    configured: isImageProviderConfigured,
    model: isImageProviderConfigured ? env.POLZA_IMAGE_MODEL : null,
    message: isImageProviderConfigured
      ? 'Генератор иллюстраций подключён'
      : 'Добавьте POLZA_AI_API_KEY на backend, чтобы создавать иллюстрации',
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function checkStoryOwner(storyId: string, userId: string): Promise<boolean> {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { userId: true } });
  return story?.userId === userId;
}

export async function getIllustrations(storyId: string, userId: string) {
  const owned = await checkStoryOwner(storyId, userId);
  if (!owned) return [];

  return prisma.storyIllustration.findMany({
    where: { storyId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getIllustrationById(illustrationId: string, userId: string) {
  const ill = await prisma.storyIllustration.findUnique({ where: { id: illustrationId } });
  if (!ill || ill.userId !== userId) return null;
  return ill;
}

export async function uploadIllustration(
  userId: string,
  storyId: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  data: CreateIllustrationInput,
) {
  const owned = await checkStoryOwner(storyId, userId);
  if (!owned) return null;

  if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
    throw Object.assign(new Error('Недопустимый формат. Разрешены: JPEG, PNG, WebP'), { statusCode: 400 });
  }
  if (buffer.length > MAX_ILLUSTRATION_SIZE) {
    throw Object.assign(new Error('Файл слишком большой. Максимум 15 MB'), { statusCode: 400 });
  }

  const { objectName, size } = await uploadFile(userId, buffer, mimeType, originalName, 'illustration');

  try { await incrementUsage(userId, 'illustrations'); } catch {}

  return prisma.storyIllustration.create({
    data: {
      storyId,
      sceneId: data.sceneId || null,
      userId,
      style: data.style,
      status: 'uploaded',
      objectName,
      mimeType,
    },
  });
}

export async function startGeneratedIllustration(
  userId: string,
  storyId: string,
  description: string,
  style: string,
  sceneId?: string,
) {
  const owned = await checkStoryOwner(storyId, userId);
  if (!owned) return null;

  assertSafeForExternalAi(description, style);

  const { jobId } = await imageProvider.createJob({ description, style });
  return prisma.storyIllustration.create({
    data: {
      storyId,
      sceneId: sceneId || null,
      userId,
      style,
      status: 'processing',
      provider: 'polza',
      providerJobId: jobId,
    },
  });
}

export async function syncGeneratedIllustration(illustrationId: string, userId: string) {
  const illustration = await getIllustrationById(illustrationId, userId);
  if (!illustration) return null;
  if (illustration.objectName || illustration.status === 'generated' || illustration.status === 'uploaded') return illustration;
  if (!illustration.providerJobId) return illustration;

  const remote = await imageProvider.getStatus(illustration.providerJobId);
  if (remote.status === 'pending' || remote.status === 'processing') {
    if (illustration.status !== remote.status) {
      return prisma.storyIllustration.update({ where: { id: illustration.id }, data: { status: remote.status } });
    }
    return illustration;
  }
  if (remote.status === 'failed' || remote.status === 'cancelled') {
    return prisma.storyIllustration.update({
      where: { id: illustration.id },
      data: { status: 'failed', error: remote.error || 'Не удалось создать иллюстрацию' },
    });
  }
  if (!remote.imageUrl) {
    return prisma.storyIllustration.update({
      where: { id: illustration.id },
      data: { status: 'failed', error: 'Сервис не вернул изображение' },
    });
  }

  const response = await fetch(remote.imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw Object.assign(new Error('Не удалось загрузить готовую иллюстрацию'), { statusCode: 502 });
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_ILLUSTRATION_SIZE) throw Object.assign(new Error('Готовая иллюстрация слишком большая'), { statusCode: 502 });

  const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME.includes(contentType)) {
    throw Object.assign(new Error('Сервис вернул неподдерживаемый формат изображения'), { statusCode: 502 });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_ILLUSTRATION_SIZE) throw Object.assign(new Error('Готовая иллюстрация слишком большая'), { statusCode: 502 });

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const uploaded = await uploadFile(userId, buffer, contentType, `illustration-${illustration.id}.${extension}`, 'illustration');
  try {
    const updated = await prisma.storyIllustration.update({
      where: { id: illustration.id },
      data: {
        objectName: uploaded.objectName,
        mimeType: contentType,
        status: 'generated',
        error: null,
      },
    });
    try { await incrementUsage(userId, 'illustrations'); } catch {}
    return updated;
  } catch (error) {
    try { await deleteFile(uploaded.objectName); } catch {}
    throw error;
  }
}

export async function replaceIllustration(
  illustrationId: string,
  userId: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
) {
  const existing = await getIllustrationById(illustrationId, userId);
  if (!existing) return null;

  if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
    throw Object.assign(new Error('Недопустимый формат. Разрешены: JPEG, PNG, WebP'), { statusCode: 400 });
  }
  if (buffer.length > MAX_ILLUSTRATION_SIZE) {
    throw Object.assign(new Error('Файл слишком большой. Максимум 15 MB'), { statusCode: 400 });
  }

  // Use the shared replacement flow so MinIO, UserFile and storage accounting
  // stay consistent with profile and character photo replacement.
  const result = await replaceFile(
    userId,
    buffer,
    mimeType,
    originalName,
    'illustration',
    existing.objectName,
  );
  try {
    return prisma.storyIllustration.update({
      where: { id: illustrationId },
      data: { objectName: result.objectName, mimeType },
    });
  } catch (error) {
    try {
      await deleteFile(result.objectName);
    } catch {}
    throw error;
  }
}

export async function deleteIllustration(illustrationId: string, userId: string): Promise<boolean> {
  const existing = await getIllustrationById(illustrationId, userId);
  if (!existing) return false;

  if (existing.objectName) {
    await deleteFile(existing.objectName);
  }

  await prisma.storyIllustration.delete({ where: { id: illustrationId } });
  return true;
}

export async function getIllustrationUrl(illustrationId: string, userId: string): Promise<string | null> {
  const ill = await getIllustrationById(illustrationId, userId);
  if (!ill || !ill.objectName) return null;

  const { storage } = await import('../../lib/storage.js');
  return storage.getUrl(ill.objectName);
}
