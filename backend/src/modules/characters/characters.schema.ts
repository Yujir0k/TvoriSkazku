import { z } from 'zod';

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  childProfileId: z.string().optional(),
  role: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  traits: z.string().max(1000).default(''),
  interests: z.string().max(1000).default(''),
  presetAvatarId: z.string().min(1).max(100).default('none'),
  voiceId: z.string().max(100).optional().default(''),
  voiceEnabled: z.boolean().optional().default(false),
}).superRefine((data, context) => {
  if (data.voiceEnabled && !data.voiceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['voiceId'],
      message: 'Выберите готовый голос',
    });
  }
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

export const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  childProfileId: z.string().nullable().optional(),
  role: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  traits: z.string().max(1000).optional(),
  interests: z.string().max(1000).optional(),
  presetAvatarId: z.string().min(1).max(100).optional(),
  voiceId: z.string().max(100).optional(),
  voiceEnabled: z.boolean().optional(),
});

export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;

export const characterIdParamSchema = z.object({
  id: z.string().min(1),
});

export const characterQuerySchema = z.object({
  childProfileId: z.string().optional(),
});

export type CharacterQueryInput = z.infer<typeof characterQuerySchema>;
