import { z } from 'zod';

export const ageGroupSchema = z.enum(['3-5', '6-8', '9-12']);

export const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  ageGroup: ageGroupSchema.default('6-8'),
  interests: z.string().max(1000).default(''),
  favoriteThemes: z.string().max(1000).default(''),
  description: z.string().max(2000).default(''),
  presetAvatarId: z.string().min(1).max(100).default('none'),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ageGroup: ageGroupSchema.optional(),
  interests: z.string().max(1000).optional(),
  favoriteThemes: z.string().max(1000).optional(),
  description: z.string().max(2000).optional(),
  presetAvatarId: z.string().min(1).max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileIdParamSchema = z.object({
  id: z.string().min(1),
});
