import { z } from 'zod';

export const illustrationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createIllustrationSchema = z.object({
  storyId: z.string().min(1),
  sceneId: z.string().optional(),
  style: z.string().max(100).default(''),
});

export type CreateIllustrationInput = z.infer<typeof createIllustrationSchema>;

export const generateIllustrationSchema = z.object({
  storyId: z.string().min(1),
  sceneId: z.string().optional(),
  description: z.string().min(10).max(1800),
  style: z.string().max(200).default('мягкая акварельная иллюстрация для детской книги'),
});
