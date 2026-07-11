import { z } from 'zod';

export const createBookSchema = z.object({
  storyId: z.string().min(1),
  title: z.string().min(1).max(300),
  authorName: z.string().max(200).default(''),
  format: z.enum(['a4', 'a5']).default('a4'),
  coverSettings: z.string().default('{}'),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  authorName: z.string().max(200).optional(),
  format: z.enum(['a4', 'a5']).optional(),
  coverSettings: z.string().optional(),
});

export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const bookIdParamSchema = z.object({
  id: z.string().min(1),
});
