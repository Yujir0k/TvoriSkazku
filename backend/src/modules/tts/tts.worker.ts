import { env } from '../../config/env.js';
import type { TtsJob } from './tts.queue.js';
import { prisma } from '../../lib/prisma.js';
import { uploadFile, deleteFile } from '../../lib/file-helper.js';
import { incrementUsage } from '../tariffs/tariffs.service.js';
import {
  popTtsJob,
  getTtsJob,
  updateTtsJob,
  isTtsJobActive as isTtsJobActiveInQueue,
  acquireProcessingLock,
  releaseProcessingLock,
  renewProcessingLock,
  getProcessingJobIds,
  processRetries,
  scheduleRetry,
  getBackoffDelay,
  MAX_RETRIES,
  LOCK_RENEW_INTERVAL,
  ttsQueueKey,
  clearProcessingLock,
} from './tts.queue.js';
import {
  textToSpeech,
  textToDialogue,
  splitTextForTts,
  extractDialogues,
  mergeMp3Chunks,
  ElevenLabsError,
  isRetryableElevenLabsError,
  TtsCancelledError,
} from './elevenlabs.provider.js';

/**
 * Парсит personalizationNames из Story (JSON-строка) в массив строк.
 */
function parsePersonalizationNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((n): n is string => typeof n === 'string' && n.trim().length >= 2);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Собирает известные имена для очистки перед отправкой на зарубежный TTS relay.
 * Источники:
 * - story.personalizationNames (самые точные — привязаны к этой истории)
 * - job.namesToRemove (сохранённые при создании задачи, источник: characterVoices, childProfiles)
 * - прямое чтение childProfiles из БД как fallback
 */
async function collectNamesForTts(job: TtsJob, story: { title: string; content?: string | null; personalizationNames?: string | null }): Promise<string[]> {
  const names = new Set<string>();
  
  // 1. Имена из personalizationNames story (самые точные)
  const storyNames = parsePersonalizationNames(story.personalizationNames);
  for (const name of storyNames) {
    if (name && name.trim().length >= 2) names.add(name.trim());
  }
  
  // 2. Имена из job.namesToRemove (если сохранены при создании задачи)
  if (job.namesToRemove && job.namesToRemove.length > 0) {
    for (const name of job.namesToRemove) {
      if (name && name.trim().length >= 2) names.add(name.trim());
    }
  }
  
  // 3. Fallback: читаем childProfiles из БД (если есть userId)
  try {
    const profiles = await prisma.childProfile.findMany({
      where: { userId: job.userId },
      select: { name: true },
    });
    for (const profile of profiles) {
      if (profile.name && profile.name.trim().length >= 2 && !names.has(profile.name.trim())) {
        names.add(profile.name.trim());
      }
    }
  } catch {
    // DB unavailable, use what we have
  }
  
  return Array.from(names);
}

const POLL_INTERVAL_MS = 2000;
let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let lockRenewTimer: ReturnType<typeof setInterval> | null = null;
let currentJobId: string | null = null;
let currentLockToken: string = '';

const LOG_PREFIX = '[tts-worker]';
function log(...args: unknown[]) {
  if (env.NODE_ENV !== 'test') {
    console.log(LOG_PREFIX, ...args);
  }
}

export function startTtsWorker(): void {
  if (isRunning) return;
  isRunning = true;

  // Start lock renew timer
  lockRenewTimer = setInterval(async () => {
    if (currentJobId && currentLockToken) {
      await renewProcessingLock(currentJobId, currentLockToken).catch(() => {});
    }
  }, LOCK_RENEW_INTERVAL);

  // First recovery, then poll
  recoverOrphanedJobs().finally(() => {
    void pollQueue();
  });
}

export async function stopTtsWorker(): Promise<void> {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (lockRenewTimer) {
    clearInterval(lockRenewTimer);
    lockRenewTimer = null;
  }
  // Release current lock
  if (currentJobId && currentLockToken) {
    await releaseProcessingLock(currentJobId, currentLockToken).catch(() => {});
  }
  currentJobId = null;
  currentLockToken = '';
}

export function isTtsWorkerRunning(): boolean {
  return isRunning;
}

export function getCurrentJobId(): string | null {
  return currentJobId;
}

async function recoverOrphanedJobs(): Promise<void> {
  try {
    const jobIds = await getProcessingJobIds();
    for (const jobId of jobIds) {
      const job = await getTtsJob(jobId);
      if (!job) continue;
      await updateTtsJob(jobId, { status: 'queued', progress: 0 });
      await clearProcessingLock(jobId).catch(() => {});
      // Re-push to queue (recovery: use rPush directly)
      const { redis } = await import('../../lib/redis.js');
      await redis.lRem(ttsQueueKey(), 0, jobId).catch(() => 0);
      await redis.rPush(ttsQueueKey(), jobId);
      log('recovered orphan job:', jobId);
    }
  } catch (err) {
    log('recovery error:', err);
  }
}

async function pollQueue(): Promise<void> {
  if (!isRunning) return;

  try {
    // Process retries first
    await processRetries();

    const jobId = await popTtsJob();
    if (jobId) {
      await processTtsJob(jobId);
    }
  } catch (err) {
    log('poll error:', err);
  }

  if (isRunning) {
    pollTimer = setTimeout(() => void pollQueue(), POLL_INTERVAL_MS);
  }
}

async function processTtsJob(jobId: string): Promise<void> {
  let lockToken = '';
  let finalObjectName: string | null = null;
  let cancellationTimer: ReturnType<typeof setInterval> | null = null;
  const abortController = new AbortController();
  currentJobId = null;
  currentLockToken = '';

  try {
    const job = await getTtsJob(jobId);
    if (!job) return;

    // Check cancelled before acquiring lock
    if (!(await isTtsJobActiveInQueue(jobId))) return;

    // Acquire token-safe lock
    const { locked, token } = await acquireProcessingLock(jobId);
    if (!locked) {
      await scheduleRetry(jobId, 2000).catch(() => {});
      return;
    }
    lockToken = token;
    currentJobId = jobId;
    currentLockToken = token;

    // Double-check not cancelled
    if (!(await isTtsJobActiveInQueue(jobId))) return;

    await updateTtsJob(jobId, { status: 'processing', progress: 5 });

    // Sync status to PostgreSQL
    await prisma.storyAudio.update({
      where: { id: job.audioId },
      data: { status: 'processing', progress: 5 },
    }).catch(() => {});

    cancellationTimer = setInterval(() => {
      void isTtsJobActiveInQueue(jobId).then((active) => {
        if (!active && !abortController.signal.aborted) {
          abortController.abort();
        }
      }).catch(() => {});
    }, 1000);

    const story = await prisma.story.findUnique({ where: { id: job.storyId } });
    if (!story || !story.content) {
      throw new Error('Story content not found');
    }

    let totalDuration = 0;
    let audioBuffer: Buffer;

    const updateProgress = async (progress: number) => {
      await updateTtsJob(jobId, { progress }).catch(() => {});
      await prisma.storyAudio.update({
        where: { id: job.audioId },
        data: { progress },
      }).catch(() => {});
    };

    // Проверка отмены перед началом генерации
    if (!(await isTtsJobActiveInQueue(jobId))) {
      // Cleanup: отменена до начала — выходим
      await prisma.storyAudio.update({
        where: { id: job.audioId },
        data: { status: 'cancelled' },
      }).catch(() => {});
      return;
    }

    // Собираем известные имена для очистки перед foreign TTS
    const namesToRemove = await collectNamesForTts(job, story);

    if (job.mode === 'dialogue') {
      await updateProgress(10);
      const dialogues = extractDialogues(story.content);
      const result = await textToDialogue(
        dialogues,
        job.characterVoices || {},
        () => isTtsJobActiveInQueue(jobId),
        { signal: abortController.signal },
      );
      audioBuffer = result.audioBuffer;
      totalDuration = result.durationMs;
      await updateProgress(80);
    } else {
      const chunks = splitTextForTts(story.content);
      const parts: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        // Проверка отмены между чанками
        if (!(await isTtsJobActiveInQueue(jobId))) {
          log('cancelled between chunks:', jobId);
          await prisma.storyAudio.update({
            where: { id: job.audioId },
            data: { status: 'cancelled', error: 'Отменено пользователем' },
          }).catch(() => {});
          return;
        }
        const r = await textToSpeech(chunks[i], job.voiceId, job.expressive, {
          signal: abortController.signal,
          namesToRemove,
        });
        parts.push(r.audioBuffer);
        totalDuration += r.durationMs;
        await updateProgress(Math.round(((i + 1) / chunks.length) * 80));
      }
      audioBuffer = parts.length === 1 ? parts[0] : await mergeMp3Chunks(parts);
    }

    // Проверка отмены перед загрузкой
    if (!(await isTtsJobActiveInQueue(jobId))) {
      log('cancelled before upload:', jobId);
      await prisma.storyAudio.update({
        where: { id: job.audioId },
        data: { status: 'cancelled', error: 'Отменено пользователем' },
      }).catch(() => {});
      return;
    }

    await updateProgress(90);

    // Upload to storage
    const uploadResult = await uploadFile(
      job.userId, audioBuffer, 'audio/mpeg',
      'story-' + job.storyId + '.mp3', 'audio',
    );
    finalObjectName = uploadResult.objectName;

    // Cancellation can race with a slow storage upload. Remove the uploaded
    // object (and its UserFile accounting) before it becomes visible.
    if (!(await isTtsJobActiveInQueue(jobId))) {
      await deleteFile(finalObjectName).catch(() => {});
      finalObjectName = null;
      await prisma.storyAudio.update({
        where: { id: job.audioId },
        data: { status: 'cancelled', error: 'Отменено пользователем' },
      }).catch(() => {});
      return;
    }

    // Do not overwrite a cancellation that arrived after the final queue check.
    const completed = await prisma.storyAudio.updateMany({
      where: { id: job.audioId, status: { not: 'cancelled' } },
      data: {
        status: 'completed',
        objectName: uploadResult.objectName,
        durationMs: totalDuration,
        progress: 100,
        error: null,
      },
    });

    if (completed.count === 0) {
      await deleteFile(finalObjectName).catch(() => {});
      finalObjectName = null;
      await updateTtsJob(jobId, { status: 'cancelled', progress: 0 }).catch(() => {});
      return;
    }

    try { await incrementUsage(job.userId, 'audioGenerations'); } catch {}

    await updateTtsJob(jobId, { status: 'completed', progress: 100 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown TTS error';
    log('TTS job failed:', jobId, message);

    const cancelled = err instanceof TtsCancelledError || !(await isTtsJobActiveInQueue(jobId));
    if (cancelled) {
      if (finalObjectName) {
        await deleteFile(finalObjectName).catch(() => {});
        finalObjectName = null;
      }
      const cancelledJob = await getTtsJob(jobId);
      await updateTtsJob(jobId, { status: 'cancelled', progress: 0 }).catch(() => {});
      if (cancelledJob?.audioId) {
        await prisma.storyAudio.update({
          where: { id: cancelledJob.audioId },
          data: { status: 'cancelled', error: 'Отменено пользователем', progress: 0 },
        }).catch(() => {});
      }
      return;
    }

    // Cleanup orphan file if upload succeeded but DB failed
    if (finalObjectName) {
      try { await deleteFile(finalObjectName); } catch {}
    }

    const jobCurrent = await getTtsJob(jobId);
    const retryCount = (jobCurrent?.retryCount || 0) + 1;

    const canRetry = !(err instanceof ElevenLabsError) || isRetryableElevenLabsError(err);

    if (canRetry && retryCount <= MAX_RETRIES) {
      const delay = getBackoffDelay(retryCount - 1);
      log('retrying job', jobId, 'attempt', retryCount, 'after', delay, 'ms');
      await updateTtsJob(jobId, { status: 'queued', retryCount });
      await prisma.storyAudio.update({
        where: { id: jobCurrent?.audioId || '' },
        data: { status: 'queued', error: 'Повторная попытка (' + retryCount + '/' + MAX_RETRIES + ')' },
      }).catch(() => {});
      // Use ZSET-based delayed queue
      await scheduleRetry(jobId, delay);
    } else {
      // All retries exhausted or the provider rejected a non-retryable request.
      await updateTtsJob(jobId, { status: 'failed', error: message.slice(0, 500), progress: 0 });
      await prisma.storyAudio.update({
        where: { id: jobCurrent?.audioId || '' },
        data: { status: 'failed', error: message.slice(0, 500) },
      }).catch(() => {});
    }
  } finally {
    // Release token-safe lock
    if (lockToken) {
      await releaseProcessingLock(jobId, lockToken).catch(() => {});
    }
    if (cancellationTimer) {
      clearInterval(cancellationTimer);
    }
    currentJobId = null;
    currentLockToken = '';
  }
}
