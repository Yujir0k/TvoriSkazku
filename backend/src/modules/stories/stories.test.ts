import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateStorySchema, jobIdParamSchema } from './stories.schema.js';
import { buildPrompt } from './prompt-builder.js';
import { generateWithOpenModel, OpenModelError } from './openmodel.client.js';

describe('stories.schema', () => {
  describe('generateStorySchema', () => {
    it('accepts valid input', () => {
      const result = generateStorySchema.safeParse({
        idea: 'Про принцессу и дракона',
        genre: 'Фэнтези',
        ageGroup: '6-8',
        chapters: 3,
        character: 'Принцесса',
        location: 'Замок',
        childName: 'Аня',
      });
      expect(result.success).toBe(true);
    });

    it('accepts minimal input (defaults)', () => {
      const result = generateStorySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.genre).toBe('Фэнтези');
        expect(result.data.chapters).toBe(1);
        expect(result.data.ageGroup).toBe('6-8');
      }
    });

    it('rejects chapters out of range', () => {
      const result = generateStorySchema.safeParse({ chapters: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects chapters > 10', () => {
      const result = generateStorySchema.safeParse({ chapters: 11 });
      expect(result.success).toBe(false);
    });

    it('rejects idea over 700 chars', () => {
      const result = generateStorySchema.safeParse({ idea: 'x'.repeat(701) });
      expect(result.success).toBe(false);
    });
  });

  describe('jobIdParamSchema', () => {
    it('accepts valid job id', () => {
      const result = jobIdParamSchema.safeParse({ id: 'abc-123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty id', () => {
      const result = jobIdParamSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('childName field', () => {
    it('accepts childName as optional string', () => {
      const result = generateStorySchema.safeParse({ childName: 'Аня' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.childName).toBe('Аня');
      }
    });

    it('accepts payload without childName', () => {
      const result = generateStorySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.childName).toBeUndefined();
      }
    });

    it('rejects childName over 100 chars', () => {
      const result = generateStorySchema.safeParse({ childName: 'x'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('childName appears in story service payload', () => {
      const result = generateStorySchema.safeParse({
        idea: 'Сказка про медведя',
        childName: 'Миша',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idea).toBe('Сказка про медведя');
        expect(result.data.childName).toBe('Миша');
      }
    });
  });

  describe('cancel job id param', () => {
    it('reuses the same jobIdParamSchema for cancel', () => {
      expect(jobIdParamSchema.safeParse({ id: '' }).success).toBe(false);
      expect(jobIdParamSchema.safeParse({ id: 'valid-id' }).success).toBe(true);
    });

    it('accepts valid cancel route params', () => {
      expect(jobIdParamSchema.safeParse({ id: 'abc-123-def' }).success).toBe(true);
    });

    it('rejects cancel route with missing id', () => {
      expect(jobIdParamSchema.safeParse({}).success).toBe(false);
    });
  });
});

describe('prompt-builder', () => {
  it('builds a safe prompt with all params', () => {
    const prompt = buildPrompt({
      idea: 'Про дружбу',
      genre: 'Приключение',
      ageGroup: '3-5',
      chapters: 2,
      character: 'Зайчик',
      location: 'Лес',
      childName: 'Петя',
    });

    expect(prompt).toContain('Петя');
    expect(prompt).toContain('Приключение');
    expect(prompt).toContain('Добрая');
    expect(prompt).toContain('безопас');
    expect(prompt).toContain('ТОЛЬКО текст');
  });

  it('explicitly bans meta phrases like "Вот и вся история" in model instructions', () => {
    const prompt = buildPrompt({
      idea: 'test',
      genre: 'Сказка',
      ageGroup: '6-8',
      chapters: 1,
      character: 'Без героя',
      location: '',
    });
    // The prompt lists these as examples of banned phrases — verify the instruction
    expect(prompt).toMatch(/ЗАПРЕЩЕНЫ мета-фразы/);
    expect(prompt).toContain('Вот и вся история'); // listed as an example of what NOT to output
    expect(prompt).toContain('Вот сказка');        // same
    expect(prompt).toContain('ТОЛЬКО текст сказки');
  });

  it('allows natural fairy-tale openings "Жили-были" and "Однажды"', () => {
    const prompt = buildPrompt({
      idea: '',
      genre: 'Сказка',
      ageGroup: '6-8',
      chapters: 1,
      character: 'Без героя',
      location: '',
    });
    // These are now explicitly allowed in the prompt
    expect(prompt).not.toContain('ЗАПРЕЩЕНЫ любые мета-фразы');
    // Check that Жили-были is explicitly allowed (not prohibited)
    expect(prompt).toContain('Можно');
    expect(prompt).toContain('Жили-были');
    expect(prompt).toContain('Однажды');
  });

  it('builds a safe prompt minimal params', () => {
    const prompt = buildPrompt({
      idea: '',
      genre: 'Сказка',
      ageGroup: '6-8',
      chapters: 1,
      character: 'Без героя',
      location: '',
    });

    expect(prompt).toContain('детскую сказку');
    expect(prompt).toContain('6-8');
    expect(prompt).not.toContain('Без героя'); // should not be added
  });

  it('instructs the model to grow story length with chapter count', () => {
    const prompt = buildPrompt({
      idea: 'Про светлячка и поезд',
      genre: 'Сказка',
      ageGroup: '6-8',
      chapters: 10,
      character: 'Без героя',
      location: '',
    });

    expect(prompt).toContain('Общий объём сказки должен умеренно расти');
    expect(prompt).toContain('10 глав');
    expect(prompt).toContain('не делай их из 1–2 предложений');
    expect(prompt).not.toContain('делай главы короче');
  });
});

describe('openmodel.client (Yandex Chat Completions API / DeepSeek)', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a successful response correctly', async () => {
    const mockResponse = {
      choices: [
        { message: { role: 'assistant', content: 'Жила-была принцесса...' }, finish_reason: 'stop' },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await generateWithOpenModel('test prompt');
    expect(result).toBe('Жила-была принцесса...');
  });

  it('handles 429 rate limit error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    await expect(generateWithOpenModel('test')).rejects.toThrow(OpenModelError);
    await expect(generateWithOpenModel('test')).rejects.toThrow('лимит');
  });

  it('handles 500 server error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(generateWithOpenModel('test')).rejects.toThrow('недоступен');
  });

  it('handles empty response (no choices)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    });

    await expect(generateWithOpenModel('test')).rejects.toThrow('пустой');
  });

  it('handles content being null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: null }, finish_reason: 'stop' }],
      }),
    });

    await expect(generateWithOpenModel('test')).rejects.toThrow('пустой');
  });

  it('sends correct request to Yandex Chat Completions API', async () => {
    let requestUrl: string | null = null;
    let requestHeaders: any = null;
    let requestBody: any = null;
    global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
      requestUrl = url;
      requestHeaders = opts.headers;
      requestBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Сказка.' }, finish_reason: 'stop' }],
        }),
      };
    });

    await generateWithOpenModel('test');
    expect(requestUrl).toBe('https://ai.api.cloud.yandex.net/v1/chat/completions');
    expect(requestHeaders['Authorization']).toMatch(/^Api-Key /);
    expect(requestHeaders['x-folder-id']).toBeTruthy();
    expect(requestHeaders['x-data-logging-enabled']).toBe('false');
    expect(requestBody.model).toContain('deepseek-v4-flash');
    expect(requestBody.reasoning_effort).toBe('none');
  });

  it('uses actual max_tokens value in request body', async () => {
    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Сказка.' }, finish_reason: 'stop' }],
        }),
      };
    });

    await generateWithOpenModel('test', 999);
    expect(capturedBody.max_tokens).toBe(999);
  });

  it('handles empty response (no choices field)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await expect(generateWithOpenModel('test')).rejects.toThrow('пустой');
  });
});
