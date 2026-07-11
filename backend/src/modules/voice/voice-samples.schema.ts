import { z } from 'zod';

export const createSampleSchema = z.object({
  name: z.string().min(1).max(100),
  durationMs: z.number().int().min(0).default(0),
});

export type CreateSampleInput = z.infer<typeof createSampleSchema>;

export const updateSampleNameSchema = z.object({
  name: z.string().min(1).max(100),
});

export type UpdateSampleNameInput = z.infer<typeof updateSampleNameSchema>;

export const sampleIdParamSchema = z.object({
  id: z.string().min(1),
});
