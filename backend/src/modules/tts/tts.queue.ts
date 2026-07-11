import { env } from '../../config/env.js';
import { redis } from '../../lib/redis.js';
import { randomUUID } from 'node:crypto';

// ─── Redis Keys ───────────────────────────────────────────────────────────────

const PREFIX = 'tvoriskazku:tts:';
export function ttsJobKey(jobId: string): string {
  return PREFIX + 'job:' + jobId;
}
export function ttsQueueKey(): string {
  return PREFIX + 'queue';
}
export function ttsRetryKey(): string {
  return PREFIX + 'retry';
}
export function ttsLockKey(jobId: string): string {
  return PREFIX + 'lock:' + jobId;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TtsJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TtsJob {
  jobId: string;
  audioId: string;
  userId: string;
  storyId: string;
  status: TtsJobStatus;
  progress: number;
  error?: string;
  voiceId: string;
  mode: 'single' | 'dialogue';
  expressive: boolean;
  characterVoices?: Record<string, string>;
  namesToRemove?: string[];
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function createTtsJob(params: {
  audioId: string;
  userId: string;
  storyId: string;
  voiceId: string;
  mode: 'single' | 'dialogue';
  expressive: boolean;
  characterVoices?: Record<string, string>;
  namesToRemove?: string[];
}): Promise<string> {
  const jobId = randomUUID();
  const now = new Date().toISOString();
  const job: TtsJob = {
    jobId,
    audioId: params.audioId,
    userId: params.userId,
    storyId: params.storyId,
    status: 'queued',
    progress: 1,
    voiceId: params.voiceId,
    mode: params.mode,
    expressive: params.expressive,
    characterVoices: params.characterVoices,
    namesToRemove: params.namesToRemove,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(ttsJobKey(jobId), JSON.stringify(job), { EX: 86400 });
  await redis.rPush(ttsQueueKey(), jobId);

  return jobId;
}

export async function getTtsJob(jobId: string): Promise<TtsJob | null> {
  const raw = await redis.get(ttsJobKey(jobId));
  if (!raw) return null;
  return JSON.parse(raw) as TtsJob;
}

export async function updateTtsJob(
  jobId: string,
  updates: Partial<Pick<TtsJob, 'status' | 'progress' | 'error' | 'retryCount'>>,
): Promise<void> {
  const job = await getTtsJob(jobId);
  if (!job) return;
  Object.assign(job, updates, { updatedAt: new Date().toISOString() });
  await redis.set(ttsJobKey(jobId), JSON.stringify(job), { EX: 86400 });
}

export async function popTtsJob(): Promise<string | null> {
  return redis.lPop(ttsQueueKey());
}

export async function clearProcessingLock(jobId: string): Promise<void> {
  await redis.del(ttsLockKey(jobId));
}

/** Cancel in all queue types and mark cancelled */
export async function cancelTtsJobInQueue(jobId: string): Promise<boolean> {
  const job = await getTtsJob(jobId);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'failed') return false;

  // Remove from both queues
  await redis.lRem(ttsQueueKey(), 0, jobId);
  await redis.zRem(ttsRetryKey(), jobId);

  job.status = 'cancelled';
  job.updatedAt = new Date().toISOString();
  await redis.set(ttsJobKey(jobId), JSON.stringify(job), { EX: 86400 });
  return true;
}

export async function isTtsJobActive(jobId: string): Promise<boolean> {
  const job = await getTtsJob(jobId);
  if (!job) return false;
  return job.status === 'queued' || job.status === 'processing';
}

// ─── Token-safe lock with TTL extension ───────────────────────────────────────

const LOCK_TTL_SECONDS = 300;
const LOCK_RENEW_INTERVAL = 120_000; // 2 min

export async function acquireProcessingLock(jobId: string): Promise<{ locked: boolean; token: string }> {
  const token = randomUUID();
  const key = ttsLockKey(jobId);
  const result = await redis.set(key, token, { NX: true, EX: LOCK_TTL_SECONDS });
  return { locked: result !== null, token };
}

export async function releaseProcessingLock(jobId: string, token: string): Promise<void> {
  // Lua script: delete only if token matches (token-safe)
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  try {
    await redis.eval(script, { keys: [ttsLockKey(jobId)], arguments: [token] });
  } catch { /* already expired or wrong token */ }
}

export async function renewProcessingLock(jobId: string, token: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;
  try {
    const result = await redis.eval(script, { keys: [ttsLockKey(jobId)], arguments: [token, String(LOCK_TTL_SECONDS)] });
    return result === 1;
  } catch {
    return false;
  }
}

export { LOCK_RENEW_INTERVAL };

// ─── Retry via ZSET ───────────────────────────────────────────────────────────

export async function scheduleRetry(jobId: string, delayMs: number): Promise<void> {
  const when = Date.now() + delayMs;
  await redis.zAdd(ttsRetryKey(), { score: when, value: jobId });
}

/** Poll the retry ZSET and re-queue due items atomically */
export async function processRetries(): Promise<number> {
  const now = Date.now();
  // Атомарно: получаем и удаляем due задачи
  // Используем ZRANGEBYSCORE + ZREMRANGEBYSCORE (Lua-скрипт не нужен, но комбинация не атомарна)
  // Для атомарности используем Lua-скрипт
  const script = `
    local due = redis.call("zrangebyscore", KEYS[1], 0, ARGV[1])
    if #due > 0 then
      redis.call("zremrangebyscore", KEYS[1], 0, ARGV[1])
      for _, jobId in ipairs(due) do
        redis.call("rpush", KEYS[2], jobId)
      end
    end
    return #due
  `;
  try {
    const count = await redis.eval(script, {
      keys: [ttsRetryKey(), ttsQueueKey()],
      arguments: [String(now)],
    });
    return count as number;
  } catch {
    return 0;
  }
}

// ─── Backoff ──────────────────────────────────────────────────────────────────

export function getBackoffDelay(retryCount: number): number {
  return Math.min(2000 * Math.pow(2, retryCount), 60000);
}

const MAX_RETRIES = 5;
export { MAX_RETRIES };

// ─── Recovery ─────────────────────────────────────────────────────────────────

export async function getProcessingJobIds(): Promise<string[]> {
  const keys = await redis.keys(PREFIX + 'job:*');
  const jobIds: string[] = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw) {
      try {
        const job = JSON.parse(raw) as TtsJob;
        if (job.status === 'processing' || job.status === 'queued') {
          jobIds.push(job.jobId);
        }
      } catch {}
    }
  }
  return jobIds;
}
