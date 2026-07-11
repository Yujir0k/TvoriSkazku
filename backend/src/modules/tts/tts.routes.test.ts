import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  ELEVENLABS_API_KEY: 'test-key',
  ELEVENLABS_BASE_URL: 'https://api.elevenlabs.io',
  ELEVENLABS_MODEL_ID: 'eleven_v3',
  ELEVENLABS_TIMEOUT_MS: 60000,
  NODE_ENV: 'test',
  LIMITS_ENFORCEMENT_ENABLED: false,
  STORIES_JOB_PREFIX: 'test:story:',
  STORIES_QUEUE_KEY: 'test:stories:queue',
  STORIES_JOB_TTL_SECONDS: 3600,
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: 9000,
  MINIO_USE_SSL: false,
  MINIO_ACCESS_KEY: 'test',
  MINIO_SECRET_KEY: 'test',
  MINIO_BUCKET: 'test',
  MINIO_PRESIGNED_EXPIRY_SECONDS: 3600,
  HOST: '127.0.0.1',
  PORT: 3001,
  REDIS_URL: 'redis://localhost:6379',
  SESSION_TTL_SECONDS: 86400,
  SESSION_COOKIE_NAME: 'test_session',
  SESSION_REDIS_PREFIX: 'test:session:',
  SESSION_USER_INDEX_PREFIX: 'test:user:',
  SESSION_ROLLING_TTL: 3600,
}));

vi.mock('../../config/env.js', () => ({ env: mockEnv }));

vi.mock('../auth/auth.middleware.js', () => ({
  requireAuth: async (request: { auth?: unknown }) => {
    request.auth = { user: { id: 'user-1' }, sessionId: 'test-session' };
  },
}));

const { mockListVoices, mockTextToSpeech } = vi.hoisted(() => ({
  mockListVoices: vi.fn(),
  mockTextToSpeech: vi.fn(),
}));
const { mockStorageGetObject, mockStorageExists, mockStoragePutObject } = vi.hoisted(() => ({
  mockStorageGetObject: vi.fn(),
  mockStorageExists: vi.fn(),
  mockStoragePutObject: vi.fn(),
}));

vi.mock('./elevenlabs.provider.js', () => ({
  DEFAULT_VOICE_ID: 'TX3LPaxmHKxFdv7VOQHJ',
  VOICE_CATALOG: [{
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    description: 'Основной рассказчик',
    gender: 'male',
    previewUrl: 'https://preview.test/liam.mp3',
  }],
  listVoices: mockListVoices,
  textToSpeech: mockTextToSpeech,
}));

const {
  mockStoryFindUnique,
  mockStoryAudioFindFirst,
  mockStoryAudioCreate,
  mockStoryAudioUpdate,
  mockStoryAudioDelete,
  mockStoryAudioFindUnique,
  mockCreateTtsJob,
  mockCancelTtsJobInQueue,
} = vi.hoisted(() => ({
  mockStoryFindUnique: vi.fn(),
  mockStoryAudioFindFirst: vi.fn(),
  mockStoryAudioCreate: vi.fn(),
  mockStoryAudioUpdate: vi.fn(),
  mockStoryAudioDelete: vi.fn(),
  mockStoryAudioFindUnique: vi.fn(),
  mockCreateTtsJob: vi.fn().mockResolvedValue('job-uuid'),
  mockCancelTtsJobInQueue: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    story: { findUnique: mockStoryFindUnique },
    storyAudio: {
      findFirst: mockStoryAudioFindFirst,
      create: mockStoryAudioCreate,
      findUnique: mockStoryAudioFindUnique,
      update: mockStoryAudioUpdate,
      findMany: vi.fn(),
      delete: mockStoryAudioDelete,
    },
  },
}));

vi.mock('../../lib/file-helper.js', () => ({
  uploadFile: vi.fn().mockResolvedValue({ objectName: 'audio/test.mp3', size: 1000 }),
  deleteFile: vi.fn(),
}));

vi.mock('./tts.queue.js', () => ({
  createTtsJob: mockCreateTtsJob,
  cancelTtsJobInQueue: mockCancelTtsJobInQueue,
}));

vi.mock('../tariffs/tariffs.service.js', () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 5 }),
  incrementUsage: vi.fn(),
}));

vi.mock('../../lib/storage.js', () => ({
  storage: {
    getUrl: vi.fn().mockResolvedValue('http://minio/audio.mp3'),
    getObject: mockStorageGetObject,
    exists: mockStorageExists,
    putObject: mockStoragePutObject,
    ensureBucket: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    rPush: vi.fn(),
    lPop: vi.fn(),
    lRem: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    zAdd: vi.fn(),
    zRem: vi.fn(),
    zRangeByScore: vi.fn(),
    zRemRangeByScore: vi.fn(),
    eval: vi.fn(),
  },
  connectRedis: vi.fn(),
}));

import fastify from 'fastify';
import { Readable } from 'node:stream';
import { registerTtsRoutes } from './tts.routes.js';

describe('TTS Routes integration', () => {
  let app: ReturnType<typeof fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorageExists.mockResolvedValue(false);
    mockStoragePutObject.mockResolvedValue(undefined);
    app = fastify();
    // Mock auth
    app.decorateRequest('auth', null);
    app.addHook('preHandler', (request, _reply, done) => {
      (request as any).auth = { user: { id: 'user-1' } };
      done();
    });
    await app.register(registerTtsRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it('GET /api/tts/status returns configured status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tts/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.configured).toBe(true);
  });

  it('does not expose provider HTML in voice-list errors', async () => {
    mockListVoices.mockRejectedValueOnce(Object.assign(
      new Error('ElevenLabs API error 403: <!DOCTYPE html><title>Just a moment...</title>'),
      { statusCode: 403, code: 'ELEVENLABS_403' },
    ));

    const res = await app.inject({ method: 'GET', url: '/api/tts/voices' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(403);
    expect(body.message).toContain('Проверьте настройки подключения');
    expect(body.message).not.toContain('<!DOCTYPE');
  });

  it('generates curated voice previews in Russian and caches them', async () => {
    const preview = Buffer.from([0x49, 0x44, 0x33, 0x04]);
    mockTextToSpeech.mockResolvedValue({ audioBuffer: preview, durationMs: 1200 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tts/voices/TX3LPaxmHKxFdv7VOQHJ/preview',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(mockTextToSpeech).toHaveBeenCalledWith(
      expect.stringContaining('Привет, мечтатель'),
      'TX3LPaxmHKxFdv7VOQHJ',
      false,
      { modelId: 'eleven_multilingual_v2' },
    );
    expect(mockStoragePutObject).toHaveBeenCalledWith(
      'system/voice-previews/ru-v4-short-TX3LPaxmHKxFdv7VOQHJ.mp3',
      preview,
      'audio/mpeg',
    );
  });

  it('POST /api/tts/stories/:id/audio returns 404 for unknown story', async () => {
    mockStoryFindUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/stories/story-1/audio',
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/tts/stories/:id/audio creates job for valid story', async () => {
    mockStoryFindUnique.mockResolvedValue({ id: 'story-1', userId: 'user-1', content: 'Test story' });
    mockStoryAudioFindFirst.mockResolvedValue(null);
    mockStoryAudioCreate.mockResolvedValue({ id: 'audio-1', userId: 'user-1' });
    mockStoryAudioUpdate.mockResolvedValue({});

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/stories/story-1/audio',
      payload: { voiceId: 'TX3LPaxmHKxFdv7VOQHJ', mode: 'single' },
    });
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('queued');
    expect(body.jobId).toBe('job-uuid');
  });

  it('rolls back the queue job when jobId persistence fails', async () => {
    mockStoryFindUnique.mockResolvedValue({ id: 'story-1', userId: 'user-1', content: 'Test story' });
    mockStoryAudioFindFirst.mockResolvedValue(null);
    mockStoryAudioCreate.mockResolvedValue({ id: 'audio-1', userId: 'user-1' });
    mockStoryAudioUpdate.mockRejectedValueOnce(new Error('database unavailable'));
    mockStoryAudioDelete.mockResolvedValue({});
    mockCancelTtsJobInQueue.mockResolvedValue(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/stories/story-1/audio',
      payload: { voiceId: 'TX3LPaxmHKxFdv7VOQHJ', mode: 'single' },
    });

    expect(res.statusCode).toBe(500);
    expect(mockCancelTtsJobInQueue).toHaveBeenCalledWith('job-uuid');
    expect(mockStoryAudioDelete).toHaveBeenCalledWith({ where: { id: 'audio-1' } });
  });

  it('blocks duplicate processing', async () => {
    mockStoryFindUnique.mockResolvedValue({ id: 'story-1', userId: 'user-1', content: 'Test' });
    mockStoryAudioFindFirst.mockResolvedValue({ id: 'existing', status: 'processing' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/stories/story-1/audio',
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 429 when limit exceeded and enforcement is on', async () => {
    mockEnv.LIMITS_ENFORCEMENT_ENABLED = true;
    const { checkLimit } = await import('../tariffs/tariffs.service.js');
    vi.mocked(checkLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 });

    mockStoryFindUnique.mockResolvedValue({ id: 'story-1', userId: 'user-1', content: 'Test' });
    mockStoryAudioFindFirst.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/stories/story-1/audio',
      payload: {},
    });
    expect(res.statusCode).toBe(429);

    mockEnv.LIMITS_ENFORCEMENT_ENABLED = false;
  });

  it('GET /api/tts/story-audio/:id/status returns progress', async () => {
    mockStoryAudioFindUnique.mockResolvedValue({
      id: 'audio-1',
      userId: 'user-1',
      status: 'processing',
      progress: 42,
      mode: 'single',
      expressive: true,
      error: null,
      durationMs: 0,
      voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tts/story-audio/audio-1/status',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.progress).toBe(42);
    expect(body.status).toBe('processing');
  });

  it('streams a completed MP3 through the authenticated download route', async () => {
    const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00]);
    mockStoryAudioFindUnique.mockResolvedValue({
      id: 'audio-1',
      storyId: 'story-1',
      userId: 'user-1',
      status: 'completed',
      objectName: 'user-1/audio.mp3',
      mimeType: 'audio/mpeg',
    });
    mockStorageGetObject.mockResolvedValue({
      stream: Readable.from(mp3),
      size: mp3.length,
      contentType: 'audio/mpeg',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tts/story-audio/audio-1/download',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(res.headers['content-disposition']).toContain('attachment;');
    expect(res.rawPayload).toEqual(mp3);
  });

  it('does not expose a download until the MP3 is completed', async () => {
    mockStoryAudioFindUnique.mockResolvedValue({
      id: 'audio-1',
      storyId: 'story-1',
      userId: 'user-1',
      status: 'processing',
      objectName: null,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tts/story-audio/audio-1/download',
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).message).toContain('ещё не готов');
  });

  it('POST /api/tts/story-audio/:id/cancel cancels queued job', async () => {
    mockStoryAudioFindUnique.mockResolvedValue({
      id: 'audio-1',
      userId: 'user-1',
      status: 'queued',
      jobId: 'job-1',
    });
    mockStoryAudioUpdate.mockResolvedValue({});
    mockCancelTtsJobInQueue.mockResolvedValue(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/story-audio/audio-1/cancel',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cancelled).toBe(true);
    expect(mockCancelTtsJobInQueue).toHaveBeenCalledWith('job-1');
  });

  it('cancels processing job', async () => {
    mockStoryAudioFindUnique.mockResolvedValue({
      id: 'audio-1', userId: 'user-1', status: 'processing',
      jobId: 'job-1',
    });
    mockStoryAudioUpdate.mockResolvedValue({});
    mockCancelTtsJobInQueue.mockResolvedValue(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/story-audio/audio-1/cancel',
    });
    expect(res.statusCode).toBe(200);
  });

  it('refuses to cancel completed job', async () => {
    mockStoryAudioFindUnique.mockResolvedValue({
      id: 'audio-1', userId: 'user-1', status: 'completed',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts/story-audio/audio-1/cancel',
    });
    expect(res.statusCode).toBe(409);
  });
});
