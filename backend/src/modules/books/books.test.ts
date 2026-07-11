import { describe, it, expect } from 'vitest';
import { createBookSchema, updateBookSchema, bookIdParamSchema } from './books.schema.js';

describe('Books / PDF', () => {
  it('createBookSchema validates', () => {
    const valid = createBookSchema.safeParse({ storyId: 's1', title: 'My Book' });
    expect(valid.success).toBe(true);

    const noTitle = createBookSchema.safeParse({ storyId: 's1' });
    expect(noTitle.success).toBe(false);

    const a5format = createBookSchema.safeParse({ storyId: 's1', title: 'Book', format: 'a5' });
    expect(a5format.success).toBe(true);

    const badFormat = createBookSchema.safeParse({ storyId: 's1', title: 'Book', format: 'a3' });
    expect(badFormat.success).toBe(false);
  });

  it('updateBookSchema allows partial updates', () => {
    expect(updateBookSchema.safeParse({ title: 'New Title' }).success).toBe(true);
    expect(updateBookSchema.safeParse({ format: 'a5' }).success).toBe(true);
    expect(updateBookSchema.safeParse({}).success).toBe(true);
  });

  it('bookIdParamSchema validates', () => {
    expect(bookIdParamSchema.safeParse({ id: 'book-1' }).success).toBe(true);
    expect(bookIdParamSchema.safeParse({}).success).toBe(false);
  });
});
