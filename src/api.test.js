import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('API client', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generateStoryAudio sends POST to /api/tts/stories/:storyId/audio with body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ id: 'audio-1', status: 'queued' }),
    });

    const { generateStoryAudio } = await import('./api.js');
    const result = await generateStoryAudio('story-123', {
      voiceId: 'voice-1',
      mode: 'single',
      expressive: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/tts/stories/story-123/audio',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          voiceId: 'voice-1',
          mode: 'single',
          expressive: true,
          characterVoices: undefined,
        }),
      }),
    );
    expect(result.id).toBe('audio-1');
  });

  it('getStoryAudioList sends GET to /api/tts/stories/:storyId/audio', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([{ id: 'a1', status: 'completed' }]),
    });

    const { getStoryAudioList } = await import('./api.js');
    const list = await getStoryAudioList('story-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/tts/stories/story-123/audio',
      expect.any(Object),
    );
    expect(list.length).toBe(1);
  });

  it('getStoryAudioStatus sends GET to /api/tts/story-audio/:id/status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'processing', progress: 50 }),
    });

    const { getStoryAudioStatus } = await import('./api.js');
    const status = await getStoryAudioStatus('audio-456');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/tts/story-audio/audio-456/status',
      expect.any(Object),
    );
    expect(status.progress).toBe(50);
  });

  it('downloads MP3 from the authenticated backend route', async () => {
    const audioBlob = new Blob([new Uint8Array([0x49, 0x44, 0x33, 0x04])], { type: 'audio/mpeg' });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'audio/mpeg' : null },
      blob: async () => audioBlob,
    });

    const { downloadStoryAudio } = await import('./api.js');
    const result = await downloadStoryAudio('audio-456');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/tts/story-audio/audio-456/download',
      { credentials: 'include' },
    );
    expect(result.size).toBeGreaterThan(0);
    expect(result.type).toBe('audio/mpeg');
  });

  it('downloads PDF from the authenticated backend route', async () => {
    const pdfBlob = new Blob([new TextEncoder().encode('%PDF-1.7')], { type: 'application/pdf' });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/pdf' : null },
      blob: async () => pdfBlob,
    });

    const { downloadBookPdf } = await import('./api.js');
    const result = await downloadBookPdf('book-42');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/books/book-42/download',
      { credentials: 'include' },
    );
    expect(result.type).toBe('application/pdf');
    expect(result.size).toBeGreaterThan(0);
  });

  it('generateStoryAudio includes characterVoices', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ id: 'a1', status: 'queued' }),
    });

    const { generateStoryAudio } = await import('./api.js');
    await generateStoryAudio('story-1', {
      voiceId: 'v1',
      mode: 'dialogue',
      expressive: true,
      characterVoices: { 'Аня': 'voice-2', 'Кролик': 'voice-3' },
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.characterVoices).toBeDefined();
    expect(Object.keys(callBody.characterVoices).length).toBe(2);
  });

  it('handles HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Лимит исчерпан' }),
    });

    const { getTtsVoices } = await import('./api.js');
    await expect(getTtsVoices()).rejects.toThrow('Лимит исчерпан');
  });

  it('keeps voice preview URLs returned by the backend', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([{
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        name: 'Liam',
        previewUrl: '/assets/voice-previews/TX3LPaxmHKxFdv7VOQHJ.mp3',
        available: true,
      }]),
    });

    const { getTtsVoices } = await import('./api.js');
    const voices = await getTtsVoices();
    expect(voices[0].previewUrl).toBe('/assets/voice-previews/TX3LPaxmHKxFdv7VOQHJ.mp3');
  });
});
