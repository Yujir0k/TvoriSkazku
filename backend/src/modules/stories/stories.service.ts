import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { createJob, getJob, cancelJob as cancelJobInQueue } from './story-generation.queue.js';
import { incrementUsage, checkLimit } from '../tariffs/tariffs.service.js';
import { assertSafeForExternalAi, assertNoPersonalData, assertSafeNameInput } from '../../lib/personal-data-filter.js';
import { hasAcceptedLatestConsent, PrivacyConsentRequiredError } from '../../lib/privacy-consent.service.js';
import { LimitExceededError } from '../../lib/limit-exceeded-error.js';
import type { GenerateStoryInput } from './stories.schema.js';
import type { CreateStoryInput, UpdateStoryInput, StoryQueryInput } from './stories.schema.js';
import type { StoryJob } from './story-generation.queue.js';

/**
 * Извлекает известные имена из params задачи генерации.
 * Источники: childName, childProfile.name, characters[].name
 */
function extractNamesFromJobParams(params: StoryJob['params']): string[] {
  const names = new Set<string>();
  
  if (params.childName && params.childName.trim().length >= 2) {
    names.add(params.childName.trim());
  }
  
  if (params.childProfile?.name && params.childProfile.name.trim().length >= 2) {
    names.add(params.childProfile.name.trim());
  }
  
  if (params.characters && params.characters.length > 0) {
    for (const char of params.characters) {
      if (char.name && char.name.trim().length >= 2) {
        names.add(char.name.trim());
      }
    }
  }
  
  return Array.from(names);
}

export async function generateStory(userId: string, params: GenerateStoryInput): Promise<{ jobId: string; status: string }> {
  if (!(await hasAcceptedLatestConsent(userId))) {
    throw new PrivacyConsentRequiredError();
  }

  // Проверяем лимит перед созданием job — не создаём job, не отправляем в Yandex
  const { allowed } = await checkLimit(userId, 'textGenerations');
  if (!allowed) {
    throw new LimitExceededError('textGenerations');
  }

  const jobId = randomUUID();

  assertSafeForExternalAi(params.idea, params.genre, params.character, params.location);
  assertSafeNameInput(params.childName);

  // Enrich with personalization data
  let childProfile: { name: string; ageGroup: string; interests: string; favoriteThemes: string } | null = null;
  let characters: { name: string; role: string; description: string; traits: string; interests: string }[] = [];

  if (params.childProfileId) {
    const profile = await prisma.childProfile.findFirst({
      where: { id: params.childProfileId, userId },
    });
    if (profile) {
      childProfile = {
        name: profile.name,
        ageGroup: profile.ageGroup,
        interests: profile.interests,
        favoriteThemes: profile.favoriteThemes,
      };
    }
  }

  if (params.characterIds && params.characterIds.length > 0) {
    const chars = await prisma.character.findMany({
      where: { id: { in: params.characterIds }, userId },
      select: { name: true, role: true, description: true, traits: true, interests: true },
    });
    characters = chars;
  }

  await createJob(jobId, userId, {
    idea: params.idea || '',
    genre: params.genre || 'Фэнтези',
    ageGroup: params.ageGroup || '6-8',
    chapters: params.chapters || 1,
    character: params.character || 'Без героя',
    location: params.location || 'Лесная тропинка',
    childName: params.childName,
    childProfile,
    characters,
  });

  // Usage tracking
  try { await incrementUsage(userId, 'textGenerations'); } catch {}

  return { jobId, status: 'queued' };
}

export async function getJobStatus(jobId: string, userId: string): Promise<StoryJob | null> {
  const job = await getJob(jobId);

  if (!job) return null;

  // Check ownership
  if (job.userId !== userId) return null;

  return job;
}

export async function cancelStoryJob(jobId: string, userId: string): Promise<{ cancelled: boolean }> {
  const job = await getJob(jobId);

  if (!job) return { cancelled: false };
  if (job.userId !== userId) return { cancelled: false };

  const success = await cancelJobInQueue(jobId);
  return { cancelled: success };
}

// --- CRUD Operations ---

export async function createStory(userId: string, data: CreateStoryInput) {
  assertNoPersonalData(data.title, data.content);
  
  // Собираем known names из всех источников: generationJobId (гарантированный) + frontend (дополнительный)
  const namesFromJob: string[] = [];
  let jobFound = false;
  if (data.generationJobId) {
    try {
      const job = await getJob(data.generationJobId);
      if (job && job.userId === userId) {
        jobFound = true;
        const extracted = extractNamesFromJobParams(job.params);
        for (const name of extracted) {
          if (!namesFromJob.includes(name)) namesFromJob.push(name);
        }
      }
    } catch {
      // Job may have expired from Redis
    }
  }
  
  // Мержим с frontend-именами (если есть). Приоритет: job params (backend гарантия) > frontend
  const mergedNames = new Set<string>([...namesFromJob, ...(data.personalizationNames || [])]);
  const finalNames = Array.from(mergedNames).filter(n => n.trim().length >= 2);
  
  // Если generationJobId указан, но job не найден и frontend не передал имена —
  // не можем гарантировать безопасность для foreign TTS.
  // Устанавливаем ttsPrivacyStatus = 'unknown' для блокировки foreign TTS.
  const ttsPrivacyBlocked = data.generationJobId && !jobFound && (!data.personalizationNames || data.personalizationNames.length === 0);
  
  const story = await prisma.story.create({
    data: {
      userId,
      title: data.title,
      content: data.content,
      status: data.status,
      narratorVoiceId: data.narratorVoiceId,
      personalizationNames: finalNames.length > 0 ? JSON.stringify(finalNames) : null,
      ttsPrivacyStatus: ttsPrivacyBlocked ? 'unknown' : null,
    },
  });
  
  // Не отдаём personalizationNames и ttsPrivacyStatus во frontend
  const { personalizationNames: _, ttsPrivacyStatus: _2, ...publicStory } = story;
  return publicStory;
}

export async function getStories(userId: string, query: StoryQueryInput) {
  const where: Record<string, unknown> = { userId };

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.title = { contains: query.search, mode: 'insensitive' };
  }

  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip: query.offset,
      take: query.limit,
    }),
    prisma.story.count({ where }),
  ]);

  // Не отдаём personalizationNames и ttsPrivacyStatus во frontend
  const publicStories = stories.map(({ personalizationNames: _, ttsPrivacyStatus: _2, ...rest }) => rest);

  return { stories: publicStories, total };
}

export async function getStoryById(storyId: string, userId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });

  if (!story) return null;
  if (story.userId !== userId) return null;

  // Не отдаём personalizationNames и ttsPrivacyStatus во frontend
  const { personalizationNames: _, ttsPrivacyStatus: _2, ...publicStory } = story;
  return publicStory;
}

export async function updateStory(storyId: string, userId: string, data: UpdateStoryInput) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });

  if (!story) return null;
  if (story.userId !== userId) return null;

  assertNoPersonalData(data.title || '', data.content || '');

  // updateStory не изменяет personalizationNames.
  // Это техническое backend-поле, управляемое только при createStory через generationJobId.
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.narratorVoiceId !== undefined) updateData.narratorVoiceId = data.narratorVoiceId;

  const updated = await prisma.story.update({
    where: { id: storyId },
    data: updateData as any,
  });

  // Не отдаём personalizationNames и ttsPrivacyStatus во frontend
  const { personalizationNames: _, ttsPrivacyStatus: _2, ...publicStory } = updated;
  return publicStory;
}

export async function deleteStory(storyId: string, userId: string): Promise<boolean> {
  const story = await prisma.story.findUnique({ where: { id: storyId } });

  if (!story) return false;
  if (story.userId !== userId) return false;

  await prisma.story.delete({ where: { id: storyId } });
  return true;
}
