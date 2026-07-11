import { describe, expect, it } from 'vitest';

import { createCharacterSchema, updateCharacterSchema } from './characters.schema.js';

describe('character voice validation', () => {
  it('requires a voice when ElevenLabs narration is enabled', () => {
    const result = createCharacterSchema.safeParse({
      name: 'Лиса',
      voiceEnabled: true,
      voiceId: '',
    });

    expect(result.success).toBe(false);
  });

  it('accepts an enabled character with a selected voice', () => {
    const result = createCharacterSchema.safeParse({
      name: 'Лиса',
      voiceEnabled: true,
      voiceId: 'GN4wbsbejSnGSa1AzjH5',
    });

    expect(result.success).toBe(true);
  });

  it('allows partial updates; the service validates the combined state', () => {
    expect(updateCharacterSchema.safeParse({ voiceEnabled: false }).success).toBe(true);
  });
});
