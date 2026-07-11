import { describe, it, expect } from 'vitest';

import {
  sanitizeForForeignTts,
  buildForeignTtsPayload,
  isSafeForForeignTts,
  FOREIGN_TTS_CLEAN_MESSAGE,
} from './foreign-tts-sanitizer.js';

describe('foreign-tts-sanitizer: имя ребёнка разрешено в relay', () => {
  it('1. Аня нашла звезду → payload содержит Аня (разрешено)', () => {
    const payload = buildForeignTtsPayload('Аня нашла волшебную звезду.', 'test-voice', ['Аня']);
    expect(payload).not.toBeNull();
    expect(payload!.text).toContain('Аня');
  });

  it('2. Маша нашла звезду → имя остаётся', () => {
    const payload = buildForeignTtsPayload('Маша нашла волшебную звезду.', 'test-voice', ['Маша']);
    expect(payload).not.toBeNull();
    expect(payload!.text).toContain('Маша');
  });

  it('3. Маша родилась 12 мая 2019 → blocked (дата рождения)', () => {
    const payload = buildForeignTtsPayload('Маша родилась 12 мая 2019 и пошла в лес.', 'test-voice', ['Маша']);
    expect(payload).toBeNull();
  });

  it('4. Дата рождения 12.05.2019 волшебная → blocked', () => {
    const payload = buildForeignTtsPayload('Дата рождения 12.05.2019 волшебная.', 'test-voice', []);
    expect(payload).toBeNull();
  });

  it('5. Маша из школы 57 нашла звезду → blocked (школа с номером)', () => {
    const payload = buildForeignTtsPayload('Маша из школы 57 нашла звезду.', 'test-voice', ['Маша']);
    expect(payload).toBeNull();
  });

  it('6. школа волшебства и 3 желания → safe pass (не школа с номером)', () => {
    const payload = buildForeignTtsPayload('школа волшебства и 3 желания', 'test-voice', []);
    expect(payload).not.toBeNull();
  });

  it('7. Петя нашёл мяч → имя остаётся', () => {
    const payload = buildForeignTtsPayload('Петя нашёл мяч.', 'test-voice', ['Петя']);
    expect(payload).not.toBeNull();
    expect(payload!.text).toContain('Петя');
  });

  it('8. родился 5 июня 2018 в лесу → blocked (DOB словами)', () => {
    expect(isSafeForForeignTts('родился 5 июня 2018 в лесу')).toBe(false);
  });

  it('9. born 12 May 2019 in the forest → blocked', () => {
    expect(isSafeForForeignTts('born 12 May 2019 in the forest')).toBe(false);
  });

  it('10. Аня Петрова нашла звезду → blocked (фамилия)', () => {
    const payload = buildForeignTtsPayload('Аня Петрова нашла звезду.', 'test-voice', ['Аня']);
    expect(payload).toBeNull();
  });

  it('11. Аня, телефон +79991234567 → blocked (телефон)', () => {
    const payload = buildForeignTtsPayload('Аня, телефон +7 999 123 45 67', 'test-voice', ['Аня']);
    expect(payload).toBeNull();
  });

  it('12. Миша пошёл в школу 57 → blocked (школа с номером)', () => {
    const payload = buildForeignTtsPayload('Миша пошёл в школу 57', 'test-voice', ['Миша']);
    expect(payload).toBeNull();
  });

  it('13. Аня, дата рождения 12.05.2019 → blocked', () => {
    const payload = buildForeignTtsPayload('Аня, дата рождения 12.05.2019', 'test-voice', ['Аня']);
    expect(payload).toBeNull();
  });
});

describe('foreign-tts-sanitizer: payload structure & leak prevention', () => {
  it('payload содержит только requestId, text, voiceId, format — никаких PII', () => {
    const payload = buildForeignTtsPayload('герой нашёл волшебную звезду.', 'test-voice', []);
    expect(payload).not.toBeNull();
    const keys = Object.keys(payload!);
    expect(keys).toEqual(['requestId', 'text', 'voiceId', 'format']);
    expect(payload!.requestId).toBeTruthy();
    expect(payload!.voiceId).toBe('test-voice');
    expect(payload!.format).toBe('mp3');
    // Никаких userId, storyId, email, auth, namesToKeep
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('storyId');
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('namesToKeep');
    expect(payload).not.toHaveProperty('namesToRemove');
    expect(payload).not.toHaveProperty('auth');
  });

  it('namesToKeep не попадает в foreign payload', () => {
    const payload = buildForeignTtsPayload('Аня нашла звезду.', 'test-voice', ['Аня']);
    expect(payload).not.toBeNull();
    expect(payload!.text).toContain('Аня'); // имя разрешено — остаётся
    expect(payload).not.toHaveProperty('namesToKeep');
  });

  it('Аня/Ане/Аню — имя разрешено в любых падежах', () => {
    const payload = buildForeignTtsPayload('Аня нашла звезду. Ане стало радостно. Аню позвали.', 'test-voice', ['Аня']);
    expect(payload).not.toBeNull();
    expect(payload!.text).toContain('Аня');
    expect(payload!.text).toContain('Ане');
    expect(payload!.text).toContain('Аню');
  });
});

describe('foreign-tts-sanitizer: fail-safe', () => {
  it('текст без имён и без ПДн — проходит', () => {
    const payload = buildForeignTtsPayload('герой нашёл волшебную звезду.', 'test-voice', []);
    expect(payload).not.toBeNull();
  });

  it('пустой текст — null', () => {
    expect(buildForeignTtsPayload('', 'test-voice', [])).toBeNull();
    expect(buildForeignTtsPayload(null as any, 'test-voice', [])).toBeNull();
    expect(buildForeignTtsPayload('   ', 'test-voice', [])).toBeNull();
  });
});

describe('personal-data-filter: word-form DOB', () => {
  let hasPersonalData: (text: string) => boolean;
  beforeAll(async () => {
    const mod = await import('./personal-data-filter.js');
    hasPersonalData = mod.hasPersonalData;
  });

  it('родилась 12 мая 2019', () => {
    expect(hasPersonalData('родилась 12 мая 2019')).toBe(true);
  });

  it('родился 5 июня 2018', () => {
    expect(hasPersonalData('родился 5 июня 2018')).toBe(true);
  });

  it('дата рождения 12 мая 2019', () => {
    expect(hasPersonalData('дата рождения 12 мая 2019')).toBe(true);
  });

  it('рождение 12 июня 2018', () => {
    expect(hasPersonalData('рождение 12 июня 2018')).toBe(true);
  });

  it('born 12 May 2019', () => {
    expect(hasPersonalData('born 12 May 2019')).toBe(true);
  });
});
