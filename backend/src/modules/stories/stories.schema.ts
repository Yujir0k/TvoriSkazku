import { z } from 'zod';

export const generateStorySchema = z.object({
  idea: z.string().max(700).default(''),
  genre: z.string().max(100).default('Фэнтези'),
  ageGroup: z.enum(['3-5', '6-8', '9-12']).default('6-8'),
  chapters: z.number().int().min(1).max(10).default(1),
  character: z.string().max(200).default('Без героя'),
  location: z.string().max(200).default('Лесная тропинка'),
  childName: z.string().max(100).optional(),
  childProfileId: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
});

export type GenerateStoryInput = z.infer<typeof generateStorySchema>;

export const jobIdParamSchema = z.object({
  id: z.string().min(1),
});

// --- CRUD Schemas ---

export const createStorySchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().default(''),
  status: z.enum(['draft', 'published']).default('draft'),
  narratorVoiceId: z.string().min(1).max(100).default('TX3LPaxmHKxFdv7VOQHJ'),
  /**
   * Массив известных имён для очистки перед отправкой на foreign TTS.
   * Заполняется автоматически при генерации сказки.
   * Используется только на российском backend, не логируется, не уходит за границу.
   */
  personalizationNames: z.array(z.string().min(1)).optional(),
  /**
   * ID задачи генерации, чтобы backend мог гарантированно прочитать имена из job params.
   */
  generationJobId: z.string().min(1).optional(),
});

/**
 * Внутренняя схема для PATCH — не принимает personalizationNames от публичного API.
 */
export const updateStoryInternalSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  narratorVoiceId: z.string().min(1).max(100).optional(),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;

export const updateStorySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  narratorVoiceId: z.string().min(1).max(100).optional(),
  /**
   * personalizationNames НЕ принимается из PATCH /api/stories.
   * Это техническое backend-поле, управляемое только при createStory.
   */
  personalizationNames: z.never().optional(),
});

export type UpdateStoryInput = z.infer<typeof updateStorySchema>;

export const storyQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  sort: z.enum(['createdAt', 'updatedAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type StoryQueryInput = z.infer<typeof storyQuerySchema>;

export const storyIdParamSchema = z.object({
  id: z.string().min(1),
});
