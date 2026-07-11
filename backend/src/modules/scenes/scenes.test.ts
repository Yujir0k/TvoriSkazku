import { describe, it, expect } from 'vitest';
import { createSceneSchema, updateSceneSchema, reorderScenesSchema } from './scenes.schema.js';

describe('Scenes', () => {
  it('createSceneSchema validates correctly', () => {
    const valid = createSceneSchema.safeParse({ storyId: 'story-1', title: 'Scene 1' });
    expect(valid.success).toBe(true);

    const noStory = createSceneSchema.safeParse({ title: 'Scene' });
    expect(noStory.success).toBe(false);
  });

  it('updateSceneSchema allows partial updates', () => {
    expect(updateSceneSchema.safeParse({ title: 'New' }).success).toBe(true);
    expect(updateSceneSchema.safeParse({}).success).toBe(true);
  });

  it('reorderScenesSchema validates sceneIds array', () => {
    expect(reorderScenesSchema.safeParse({ sceneIds: ['a', 'b'] }).success).toBe(true);
    expect(reorderScenesSchema.safeParse({ sceneIds: [] }).success).toBe(true);
    expect(reorderScenesSchema.safeParse({}).success).toBe(false);
  });

});
