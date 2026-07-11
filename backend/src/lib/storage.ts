import { randomUUID } from 'node:crypto';
import * as Minio from 'minio';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';

// ─── MIME ↔ extension mapping ────────────────────────────────────────────────

const MIME_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'application/pdf': 'pdf',
};

const ALLOWED_MIME_TYPES = Object.keys(MIME_EXT_MAP);

// ─── Category-specific limits ────────────────────────────────────────────────

export type FileCategory = 'photo' | 'illustration' | 'audio' | 'pdf' | 'other';

interface CategoryLimits {
  maxSize: number;
  allowedMime: string[];
}

const CATEGORY_LIMITS: Record<FileCategory, CategoryLimits> = {
  photo: {
    maxSize: 10 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
  },
  illustration: {
    maxSize: 15 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
  },
  audio: {
    maxSize: 20 * 1024 * 1024,
    allowedMime: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  },
  pdf: {
    maxSize: 30 * 1024 * 1024,
    allowedMime: ['application/pdf'],
  },
  other: {
    maxSize: 10 * 1024 * 1024,
    allowedMime: ALLOWED_MIME_TYPES,
  },
};

// ─── Magic-byte signatures for content validation ────────────────────────────

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const sigMap: Record<string, Uint8Array[]> = {
    'image/jpeg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
    'image/png': [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
    'audio/mpeg': [new Uint8Array([0xFF, 0xFB]), new Uint8Array([0xFF, 0xF3]), new Uint8Array([0xFF, 0xF2]), new Uint8Array([0x49, 0x44, 0x33])],
    'audio/wav': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
    'audio/ogg': [new Uint8Array([0x4F, 0x67, 0x67, 0x53])],
    'audio/webm': [new Uint8Array([0x1A, 0x45, 0xDF, 0xA3])],
    'application/pdf': [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  };

  const signatures = sigMap[mimeType];
  if (!signatures) return true;

  return signatures.some((sig) => {
    if (buffer.length < sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) return false;
    }
    return true;
  });
}

// ─── Error ───────────────────────────────────────────────────────────────────

class StorageError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// ─── Logger helper ───────────────────────────────────────────────────────────

function log(level: 'error' | 'warn' | 'info', message: string, meta?: Record<string, unknown>): void {
  try {
    if (env.NODE_ENV !== 'test') {
      const ts = new Date().toISOString();
      console[level](`[${ts}] [storage] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  } catch {
    console[level](`[storage] ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

class StorageService {
  private client: Minio.Client;
  private bucket: string;
  private ready = false;

  constructor() {
    this.client = new Minio.Client({
      endPoint: env.MINIO_ENDPOINT,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    });
    this.bucket = env.MINIO_BUCKET;
  }

  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        log('info', 'Bucket created', { bucket: this.bucket });
      }
      this.ready = true;
    } catch (error) {
      log('error', 'Failed to ensure bucket', { error: String(error) });
      throw error;
    }
  }

  /** Upload with MIME check, size-limit per category, and content validation */
  async upload(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    _originalName: string,
    category: FileCategory = 'other',
  ): Promise<{ objectName: string; size: number }> {
    if (!this.ready) {
      throw new StorageError('Storage not initialized', 'STORAGE_NOT_READY');
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new StorageError(
        `Недопустимый тип файла: ${mimeType}`,
        'INVALID_MIME_TYPE',
      );
    }

    const catLimit = CATEGORY_LIMITS[category];
    if (catLimit && !catLimit.allowedMime.includes(mimeType)) {
      throw new StorageError(
        `Тип файла ${mimeType} не разрешён для категории ${category}`,
        'CATEGORY_MIME_MISMATCH',
      );
    }

    const maxSize = catLimit?.maxSize ?? 10 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new StorageError(
        `Файл слишком большой. Максимум для ${category}: ${(maxSize / 1024 / 1024).toFixed(1)} MB`,
        'FILE_TOO_LARGE',
      );
    }

    if (!validateMagicBytes(buffer, mimeType)) {
      log('warn', 'Content mismatch', { mimeType, size: buffer.length, userId });
      throw new StorageError(
        `Содержимое файла не соответствует типу ${mimeType}`,
        'CONTENT_MISMATCH',
      );
    }

    const ext = MIME_EXT_MAP[mimeType] || 'bin';
    const objectName = `${userId}/${randomUUID()}.${ext}`;

    try {
      await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
        'Content-Type': mimeType,
      });
    } catch (error) {
      log('error', 'MinIO putObject failed', { objectName, error: String(error) });
      throw new StorageError(
        `Ошибка загрузки файла: ${error instanceof Error ? error.message : String(error)}`,
        'UPLOAD_FAILED',
      );
    }

    return { objectName, size: buffer.length };
  }

  /** Get a presigned URL */
  async getUrl(objectName: string): Promise<string> {
    if (!this.ready) {
      throw new StorageError('Storage not initialized', 'STORAGE_NOT_READY');
    }

    try {
      return await this.client.presignedGetObject(
        this.bucket,
        objectName,
        env.MINIO_PRESIGNED_EXPIRY_SECONDS,
      );
    } catch (error) {
      log('error', 'MinIO presignedGetObject failed', { objectName, error: String(error) });
      throw new StorageError(
        `Ошибка получения ссылки: ${error instanceof Error ? error.message : String(error)}`,
        'GET_URL_FAILED',
      );
    }
  }

  /** Stream a private object through the authenticated backend. */
  async getObject(objectName: string): Promise<{ stream: Readable; size: number; contentType: string }> {
    if (!this.ready) {
      throw new StorageError('Storage not initialized', 'STORAGE_NOT_READY');
    }

    try {
      const stat = await this.client.statObject(this.bucket, objectName);
      const stream = await this.client.getObject(this.bucket, objectName);
      const metadata = stat.metaData || {};
      const contentType = String(metadata['content-type'] || metadata['Content-Type'] || 'application/octet-stream');
      return { stream, size: stat.size, contentType };
    } catch (error) {
      log('error', 'MinIO getObject failed', { objectName, error: String(error) });
      throw new StorageError(
        `Ошибка скачивания файла: ${error instanceof Error ? error.message : String(error)}`,
        'DOWNLOAD_FAILED',
      );
    }
  }

  /** Check whether an internal cached object exists without exposing MinIO. */
  async exists(objectName: string): Promise<boolean> {
    if (!this.ready) return false;
    try {
      await this.client.statObject(this.bucket, objectName);
      return true;
    } catch {
      return false;
    }
  }

  /** Store an application-owned object under a deterministic cache key. */
  async putObject(objectName: string, buffer: Buffer, contentType: string): Promise<void> {
    if (!this.ready) {
      throw new StorageError('Storage not initialized', 'STORAGE_NOT_READY');
    }
    try {
      await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
        'Content-Type': contentType,
      });
    } catch (error) {
      log('error', 'MinIO cached putObject failed', { objectName, error: String(error) });
      throw new StorageError(
        `Ошибка кэширования файла: ${error instanceof Error ? error.message : String(error)}`,
        'UPLOAD_FAILED',
      );
    }
  }

  /** Delete an object, logging errors */
  async delete(objectName: string): Promise<void> {
    if (!this.ready) {
      throw new StorageError('Storage not initialized', 'STORAGE_NOT_READY');
    }

    try {
      await this.client.removeObject(this.bucket, objectName);
    } catch (error) {
      log('error', 'MinIO removeObject failed', { objectName, error: String(error) });
      throw new StorageError(
        `Ошибка удаления файла: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_FAILED',
      );
    }
  }

  /** Delete all objects belonging to a user */
  async deleteAllUserObjects(userId: string): Promise<void> {
    if (!this.ready) {
      throw new StorageError('Storage not initialized', 'STORAGE_NOT_READY');
    }

    const prefix = `${userId}/`;
    try {
      const stream = this.client.listObjects(this.bucket, prefix, true);
      const names: string[] = [];

      for await (const obj of stream) {
        if (obj.name) names.push(obj.name);
      }

      if (names.length > 0) {
        await this.client.removeObjects(this.bucket, names);
        log('info', 'Deleted all user objects', { userId, count: names.length });
      }
    } catch (error) {
      log('error', 'Failed to delete user objects', { userId, error: String(error) });
      throw error;
    }
  }

  /** Check if an object belongs to a user */
  belongsToUser(objectName: string, userId: string): boolean {
    return objectName.startsWith(`${userId}/`);
  }
}

export const storage = new StorageService();
export { StorageError };
export { ALLOWED_MIME_TYPES };
