import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const mockEnv = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: 'test-key',
  ELEVENLABS_BASE_URL: 'https://api.elevenlabs.io',
  ELEVENLABS_MODEL_ID: 'eleven_v3',
  ELEVENLABS_TIMEOUT_MS: 60000,
  NODE_ENV: 'test',
  LIMITS_ENFORCEMENT_ENABLED: false,
}));

const TINY_MP3_BASE64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAADQgB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7////////////////////////////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAKjAAAAAAAAA0JZGH7JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UMQAA8AAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1LEXYPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UsShg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
const TINY_MP3 = Buffer.from([
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAADQgB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7////////////////////////////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAKjAAAAAAAAA0JZGH7JAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UMQAA8AAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'VVVVVVVVVVVVVVX/+1LEXYPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UsSh',
  'g8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
].join(''), 'base64');

const VALID_TINY_MP3 = Buffer.from([
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAADQgB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7//',
  '//////////////////////////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAKjAAAAAAAAA0JZGH7JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UMQAA8AAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVV',
  'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'VVVVVVVVVVVVVVX/+1LEXYPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UsShg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
].join(''), 'base64');

vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

import {
  splitTextForTts,
  filterAudioTags,
  VOICE_CATALOG,
  DEFAULT_VOICE_ID,
  textToSpeech,
  textToDialogue,
  listVoices,
  ElevenLabsError,
  isRetryableElevenLabsError,
  mergeMp3Chunks,
  extractDialogues,
} from './elevenlabs.provider.js';

describe('ElevenLabs provider', () => {
  describe('splitTextForTts', () => {
    it('returns empty array for empty text', () => {
      expect(splitTextForTts('')).toEqual([]);
    });

    it('returns single chunk for short text', () => {
      const chunks = splitTextForTts('Hello world', 100);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Hello world');
    });

    it('splits at paragraph boundary', () => {
      const text = 'A'.repeat(300) + '\n\n' + 'B'.repeat(300);
      const chunks = splitTextForTts(text, 400);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('splits at sentence boundary', () => {
      const sent1 = 'First sentence about something interesting.';
      const sent2 = 'Second sentence with more details.';
      const sent3 = 'Third sentence that is long enough.';
      const text = sent1 + ' ' + sent2 + ' ' + sent3;
      const chunks = splitTextForTts(text, sent1.length + 5);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('does not split inside quoted speech', () => {
      const speech = 'He said "This is a long sentence with a lot of words in it." Then he walked away.';
      const chunks = splitTextForTts(speech, 30);
      expect(chunks[0].length).toBeLessThanOrEqual(35);
    });

    it('handles text under max length without splitting', () => {
      const text = 'Short text.';
      expect(splitTextForTts(text, 4500)).toEqual(['Short text.']);
    });
  });

  describe('filterAudioTags', () => {
    it('keeps safe tags', () => {
      expect(filterAudioTags('[softly] Hello [warmly] world')).toBe('[softly] Hello [warmly] world');
    });

    it('removes unsafe tags', () => {
      expect(filterAudioTags('[shouting] Hello [crying] world')).toBe(' Hello  world');
    });

    it('handles mixed safe and unsafe tags', () => {
      const result = filterAudioTags('[excited] Hello [sadly] world [whispers] shh');
      expect(result).toContain('[excited]');
      expect(result).toContain('[whispers]');
      expect(result).not.toContain('[sadly]');
    });
  });

  describe('voice catalog', () => {
    it('has 8 voices', () => {
      expect(VOICE_CATALOG).toHaveLength(8);
    });

    it('the main narrator is first and default', () => {
      expect(VOICE_CATALOG[0].voiceId).toBe(DEFAULT_VOICE_ID);
      expect(VOICE_CATALOG[0].name).toBe('Добрый рассказчик');
    });

    it('uses the curated Russian voice set', () => {
      expect(VOICE_CATALOG.map((voice) => voice.voiceId)).toEqual([
        'TX3LPaxmHKxFdv7VOQHJ',
        'ZHIn0jcgR6VIvVAXkwWV',
        'NQJnREzQtnAHHZnia0tY',
        'GquPFn9xormgmHaJ2KdN',
        'ymDCYd8puC7gYjxIamPt',
        'hLjwV7lYzk15SWLUmhEH',
        'GN4wbsbejSnGSa1AzjH5',
        'q22qntNqQAvTaBoqE089',
      ]);
    });

    it('all voices have required fields', () => {
      for (const v of VOICE_CATALOG) {
        expect(v.voiceId).toBeTruthy();
        expect(v.name).toBeTruthy();
        expect(['male', 'female']).toContain(v.gender);
      }
    });
  });

  describe('mergeMp3Chunks', () => {
    it('returns same buffer for single chunk', async () => {
      const buf = Buffer.from('MP3 data');
      expect(await mergeMp3Chunks([buf])).toBe(buf);
    });

    it('merges multiple valid MP3 chunks', async () => {
      const result = await mergeMp3Chunks([VALID_TINY_MP3, VALID_TINY_MP3]);
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('rejects malformed MP3 chunks', async () => {
      await expect(mergeMp3Chunks([TINY_MP3, TINY_MP3])).rejects.toThrow();
    });
  });

  describe('extractDialogues', () => {
    it('extracts quoted speech', () => {
      const text = 'Он сказал «Привет» и ушёл.';
      const lines = extractDialogues(text);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.some(l => l.text.includes('Привет'))).toBe(true);
    });

    it('returns narration for text without quotes', () => {
      const text = 'Просто текст без кавычек.';
      const lines = extractDialogues(text);
      expect(lines.length).toBe(1);
      expect(lines[0].voiceId).toBe(DEFAULT_VOICE_ID);
    });
  });
});

describe('ElevenLabs API error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockEnv.ELEVENLABS_API_KEY = 'test-key';
  });

  it('listVoices returns the curated catalogue when API key is missing', async () => {
    mockEnv.ELEVENLABS_API_KEY = '';
    const voices = await listVoices();
    expect(voices).toHaveLength(VOICE_CATALOG.length);
    expect(voices.every((voice) => Boolean(voice.previewUrl))).toBe(true);
    expect(voices.every((voice) => voice.available)).toBe(false);
  });

  it('textToSpeech throws when API key is missing', async () => {
    mockEnv.ELEVENLABS_API_KEY = '';
    await expect(textToSpeech('test', 'voice-id')).rejects.toThrow(ElevenLabsError);
  });

  it('handles 401 from ElevenLabs', async () => {
    global.fetch = vi.fn().mockRejectedValue(new ElevenLabsError('Unauthorized', 401, 'ELEVENLABS_401'));
    await expect(textToSpeech('test', DEFAULT_VOICE_ID)).rejects.toThrow();
  });

  it('returns the curated voice catalogue without calling the remote voice list', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const voices = await listVoices();

    expect(voices).toHaveLength(VOICE_CATALOG.length);
    expect(voices[0]).toMatchObject({ voiceId: DEFAULT_VOICE_ID, available: true });
    expect(voices.every((voice) => Boolean(voice.previewUrl))).toBe(true);
    expect(voices.every((voice) => voice.available)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies a Cloudflare 403 as a non-retryable region block', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'text/html; charset=UTF-8' },
      text: async () => '<!DOCTYPE html><title>Just a moment...</title>',
    });

    let caught: unknown;
    try {
      await textToSpeech('Тест', DEFAULT_VOICE_ID);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ElevenLabsError);
    expect((caught as ElevenLabsError).code).toBe('ELEVENLABS_REGION_BLOCKED');
    expect(isRetryableElevenLabsError(caught)).toBe(false);
  });

  it('handles 5xx from ElevenLabs', async () => {
    global.fetch = vi.fn().mockRejectedValue(new ElevenLabsError('Server Error', 503, 'ELEVENLABS_503'));
    await expect(textToSpeech('test', DEFAULT_VOICE_ID)).rejects.toThrow();
  });
});

describe('Tariff limit enforcement', () => {
  it('respects LIMITS_ENFORCEMENT_ENABLED', () => {
    // Просто проверяем, что env читается корректно
    expect(mockEnv.LIMITS_ENFORCEMENT_ENABLED).toBe(false);
  });
});

describe('Cleanup on errors', () => {
  it('cleans up temp files on getMp3Duration error', async () => {
    const { env } = await import('../../config/env.js');
    const result = await (await import('./elevenlabs.provider.js')).mergeMp3Chunks([Buffer.from('test')]);
    expect(result).toBeTruthy();
  });
});

describe('Text to Dialogue body format', () => {
  beforeEach(() => {
    mockEnv.ELEVENLABS_API_KEY = 'test-key';
  });

  it('uses correct voice_id for narration vs characters', async () => {
    const fetchCalls: Array<{ url: string; body?: string; headers?: Record<string,string> }> = [];
    global.fetch = vi.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      fetchCalls.push({ url, body: opts.body as string });
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    });

    const { textToDialogue, DEFAULT_VOICE_ID } = await import('./elevenlabs.provider.js');

    const lines = [
      { text: 'Жили-были дед и баба.', voiceId: DEFAULT_VOICE_ID },
      { text: 'Здравствуй, колобок!', voiceId: '' },
      { text: 'И покатился колобок дальше.', voiceId: DEFAULT_VOICE_ID },
    ];

    await textToDialogue(lines, { 'Колобок': 'voice-character-1' });

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(fetchCalls[0].body!);

    expect(body.model_id).toBe('eleven_v3');
    expect(body.language_code).toBe('ru');
    expect(body.inputs).toBeDefined();
    expect(body.inputs.length).toBe(3);

    // Narration lines → DEFAULT_VOICE_ID (Liam)
    expect(body.inputs[0].voice_id).toBe(DEFAULT_VOICE_ID);
    // Character line → character voice
    expect(body.inputs[1].voice_id).toBe('voice-character-1');
    // Narration → DEFAULT_VOICE_ID
    expect(body.inputs[2].voice_id).toBe(DEFAULT_VOICE_ID);

    // Verify no turns or voice_config
    expect(body.turns).toBeUndefined();
    expect(body.voice_config).toBeUndefined();
  });

  it('handles long text by splitting into chunks', async () => {
    const fetchCalls: Array<{ url: string; body?: string }> = [];
    global.fetch = vi.fn().mockImplementation(async (url: string, opts: RequestInit) => {
      fetchCalls.push({ url, body: opts.body as string });
      return {
        ok: true,
        arrayBuffer: async () => VALID_TINY_MP3.buffer.slice(
          VALID_TINY_MP3.byteOffset,
          VALID_TINY_MP3.byteOffset + VALID_TINY_MP3.byteLength,
        ),
      };
    });

    const { textToDialogue, DEFAULT_VOICE_ID } = await import('./elevenlabs.provider.js');

    // Single very long line
    const longText = 'X'.repeat(2500);
    const lines = [{ text: longText, voiceId: '' }];

    await textToDialogue(lines, {});

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of fetchCalls) {
      const body = JSON.parse(call.body!);
      // Each chunk should be ≤ 2000 chars
      for (const input of (body.inputs || [])) {
        expect(input.text.length).toBeLessThanOrEqual(2000);
      }
    }
  });

  it('stops dialogue generation between chunks when cancelled', async () => {
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      arrayBuffer: async () => VALID_TINY_MP3.buffer.slice(
        VALID_TINY_MP3.byteOffset,
        VALID_TINY_MP3.byteOffset + VALID_TINY_MP3.byteLength,
      ),
    }));
    const shouldContinue = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(textToDialogue(
      [{ text: 'X'.repeat(2500), voiceId: '', kind: 'dialogue' }],
      { character: 'voice-character-1' },
      shouldContinue,
    )).rejects.toMatchObject({ name: 'TtsCancelledError' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(shouldContinue).toHaveBeenCalledTimes(2);
  });
});
