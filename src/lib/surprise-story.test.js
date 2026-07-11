import { describe, expect, it } from 'vitest';
import { createSurpriseStory } from './surprise-story.js';

function seededRandom(seed = 1) {
  let value = seed;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

describe('createSurpriseStory', () => {
  it('creates varied, editable story ideas instead of a fixed template list', () => {
    const random = seededRandom(42);
    const ideas = new Set(Array.from({ length: 80 }, () => createSurpriseStory(random).idea));
    expect(ideas.size).toBeGreaterThan(60);
  });

  it('returns settings that can be applied to the generator', () => {
    const result = createSurpriseStory(seededRandom(7));
    expect(result.idea.length).toBeGreaterThan(80);
    expect(result.genre).toBeTruthy();
    expect(result.location).toBeTruthy();
  });
});
