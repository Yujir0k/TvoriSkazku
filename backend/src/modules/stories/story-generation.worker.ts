import { env } from '../../config/env.js';
import { generateWithOpenModel, OpenModelError } from './openmodel.client.js';
import { buildPrompt } from './prompt-builder.js';
import { isStoryProbablyComplete, normalizeStoryChapters } from './story-format.js';
import {
  popQueuedJob,
  getJob,
  updateJob,
  getQueueLength,
  isJobActive,
} from './story-generation.queue.js';

const POLL_INTERVAL_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

export function startWorker(): void {
  if (isRunning) return;
  isRunning = true;
  void pollQueue();
}

export function stopWorker(): void {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function pollQueue(): Promise<void> {
  if (!isRunning) return;

  try {
    const jobId = await popQueuedJob();
    if (jobId) {
      await processJob(jobId);
    }
  } catch (_error) {
    // Logging is handled inside processJob
  }

  if (isRunning) {
    pollTimer = setTimeout(() => void pollQueue(), POLL_INTERVAL_MS);
  }
}

async function processJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  // Check if already cancelled before doing anything
  if (!(await isJobActive(jobId))) {
    return;
  }

  try {
    await updateJob(jobId, {
      status: 'generating',
      progress: 10,
      message: 'Готовим сказку...',
    });

    // Calculate adaptive max_tokens
    const { chapters, ageGroup } = job.params;
    const baseTokens = 1800;
    const tokensPerChapter = 650;
    const ageFactor = getAgeFactor(ageGroup);
    const calculatedTokens = Math.round(baseTokens + tokensPerChapter * chapters * ageFactor);
    const maxTokens = Math.min(calculatedTokens, env.YANDEX_MAX_TOKENS);

    // Check cancelled before building prompt
    if (!(await isJobActive(jobId))) return;

    await updateJob(jobId, {
      progress: 20,
      message: 'Готовим сказку...',
    });

    const prompt = buildPrompt(job.params);

    // Check cancelled before calling OpenModel
    if (!(await isJobActive(jobId))) return;

    await updateJob(jobId, {
      progress: 30,
      message: 'Составляю план сказки...',
    });

    await delay(200);

    if (!(await isJobActive(jobId))) return;

    await updateJob(jobId, {
      progress: 40,
      message: 'Пишу начало сказки...',
    });

    let lastError: Error | null = null;
    let currentMaxTokens = maxTokens;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await delay(RETRY_DELAY_MS * attempt);

        // Check cancelled before retry
        if (!(await isJobActive(jobId))) return;

        // Increase max_tokens on retry (may help with max_tokens truncation)
        if (currentMaxTokens < env.YANDEX_MAX_TOKENS) {
          currentMaxTokens = Math.min(Math.round(currentMaxTokens * 1.3), env.YANDEX_MAX_TOKENS);
        }

        await updateJob(jobId, {
          progress: Math.min(50 + attempt * 15, 80),
          message: `Повторная попытка (${attempt + 1}/${MAX_RETRIES})...`,
        });
      }

      try {
        const storyText = await generateWithOpenModel(prompt, currentMaxTokens);
        const formattedStory = normalizeStoryChapters(storyText, chapters);

        if (!isStoryProbablyComplete(formattedStory)) {
          throw new OpenModelError('Ответ был обрезан до завершения сказки.', undefined, true);
        }

        // Check cancelled after result before saving
        if (!(await isJobActive(jobId))) return;

        await updateJob(jobId, {
          progress: 65,
          message: 'Дописываю сказку...',
        });

        if (!(await isJobActive(jobId))) return;

        await updateJob(jobId, {
          progress: 75,
          message: 'Причёсываю текст...',
        });

        await delay(200);

        if (!(await isJobActive(jobId))) return;

        await updateJob(jobId, {
          progress: 82,
          message: 'Проверяю безопасность...',
        });

        await delay(200);

        if (!(await isJobActive(jobId))) return;

        await updateJob(jobId, {
          progress: 90,
          message: 'Проверяю качество текста...',
        });

        await delay(200);

        if (!(await isJobActive(jobId))) return;

        await updateJob(jobId, {
          status: 'completed',
          progress: 100,
          message: 'Сказка готова!',
          result: formattedStory,
        });

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Show error message in progress so user sees what happened
        const errorPreview = lastError.message.length > 60
          ? lastError.message.slice(0, 57) + '…'
          : lastError.message;
        await updateJob(jobId, {
          progress: Math.max(10, 30 + attempt * 12),
          message: `Повторная попытка (${attempt + 2}/${MAX_RETRIES})...`,
        });

        if (error instanceof OpenModelError) {
          if (!error.isRetryable) {
            break; // Non-retryable, fail immediately
          }
          // Retryable, continue loop
        } else {
          break; // Unknown error, fail
        }
      }
    }

    // All retries exhausted or non-retryable error
    if (!(await isJobActive(jobId))) return;

    const technicalDetails = lastError?.message || '';
    const userMessage = technicalDetails.includes('лимит') || technicalDetails.includes('временно')
      ? 'Сервис генерации временно перегружен. Попробуйте ещё раз через пару минут.'
      : technicalDetails.includes('длины ответа') || technicalDetails.includes('max_tokens')
        ? 'Сказка получилась слишком длинной. Попробуйте уменьшить количество глав или сделать короче идею.'
        : 'Не удалось создать сказку. Попробуйте ещё раз.';
    await updateJob(jobId, {
      status: 'failed',
      progress: 0,
      message: userMessage,
      error: technicalDetails,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Внутренняя ошибка сервера';
    await updateJob(jobId, {
      status: 'failed',
      progress: 0,
      message: msg,
      error: msg,
    });
  }
}

function getAgeFactor(ageGroup: string): number {
  if (ageGroup === '3-5') return 0.8;
  if (ageGroup === '6-8') return 0.95;
  return 1.05;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
