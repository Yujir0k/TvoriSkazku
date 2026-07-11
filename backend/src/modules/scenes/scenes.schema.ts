import { z } from 'zod';

export const createSceneSchema = z.object({
  storyId: z.string().min(1),
  title: z.string().max(300).default(''),
  description: z.string().max(2000).default(''),
  style: z.string().max(100).default(''),
  position: z.number().int().min(0).optional(),
});

export type CreateSceneInput = z.infer<typeof createSceneSchema>;

export const updateSceneSchema = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  style: z.string().max(100).optional(),
  position: z.number().int().min(0).optional(),
});

export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;

export const sceneIdParamSchema = z.object({
  id: z.string().min(1),
});

export const reorderScenesSchema = z.object({
  sceneIds: z.array(z.string().min(1)),
});
