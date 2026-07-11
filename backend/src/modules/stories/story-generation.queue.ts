import { env } from '../../config/env.js';
import { redis } from '../../lib/redis.js';

export function getJobKey(jobId: string): string {
  return `${env.STORIES_JOB_PREFIX}${jobId}`;
}

export function getQueueKey(): string {
  return env.STORIES_QUEUE_KEY;
}

export type StoryJobStatus = 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled';

export interface StoryJob {
  jobId: string;
  userId: string;
  status: StoryJobStatus;
  progress: number;
  message: string;
  result?: string;
  error?: string;
  params: {
    idea: string;
    genre: string;
    ageGroup: string;
    chapters: number;
    character: string;
    location: string;
    childName?: string;
    childProfile?: {
      name: string;
      ageGroup: string;
      interests: string;
      favoriteThemes: string;
    } | null;
    characters?: {
      name: string;
      role: string;
      description: string;
      traits: string;
      interests: string;
    }[];
  };
  createdAt: string;
  updatedAt: string;
}

export async function createJob(jobId: string, userId: string, params: StoryJob['params']): Promise<void> {
  const now = new Date().toISOString();
  const job: StoryJob = {
    jobId,
    userId,
    status: 'queued',
    progress: 0,
    message: 'Задача поставлена в очередь',
    params,
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(getJobKey(jobId), JSON.stringify(job), {
    EX: env.STORIES_JOB_TTL_SECONDS,
  });

  await redis.rPush(getQueueKey(), jobId);
}

export async function getJob(jobId: string): Promise<StoryJob | null> {
  const raw = await redis.get(getJobKey(jobId));
  if (!raw) return null;
  return JSON.parse(raw) as StoryJob;
}

export async function updateJob(
  jobId: string,
  updates: Partial<Pick<StoryJob, 'status' | 'progress' | 'message' | 'result' | 'error'>>,
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  Object.assign(job, updates, { updatedAt: new Date().toISOString() });

  await redis.set(getJobKey(jobId), JSON.stringify(job), {
    EX: env.STORIES_JOB_TTL_SECONDS,
  });
}

export async function popQueuedJob(): Promise<string | null> {
  return redis.lPop(getQueueKey());
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'failed') return false;

  // Remove from queue if still queued
  await redis.lRem(getQueueKey(), 0, jobId);

  job.status = 'cancelled';
  job.progress = 0;
  job.message = 'Генерация отменена';
  job.updatedAt = new Date().toISOString();

  await redis.set(getJobKey(jobId), JSON.stringify(job), {
    EX: env.STORIES_JOB_TTL_SECONDS,
  });

  return true;
}

export async function isJobActive(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  if (!job) return false;
  return job.status === 'queued' || job.status === 'generating';
}

export async function getQueueLength(): Promise<number> {
  return redis.lLen(getQueueKey());
}
