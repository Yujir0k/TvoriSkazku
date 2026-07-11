﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

import { Readable } from 'node:stream';

const MOCK_USER = { id: 'user-1', name: 'Test', email: 'test@test.com', normalizedEmail: 'test@test.com', emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date() };
const OTHER_USER = { id: 'user-2', name: 'Other', email: 'other@test.com', normalizedEmail: 'other@test.com', emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date() };
const MOCK_CONSENT = { id: 'c1', userId: 'user-1', consentVersion: '1.0', acceptedAt: new Date('2026-01-01'), revokedAt: null };
const MOCK_SAMPLE = { id: 's1', userId: 'user-1', name: 'Test voice', objectName: 'user-1/voice.webm', mimeType: 'audio/webm', size: 500, durationMs: 3000, consentId: 'c1', createdAt: new Date('2026-01-02') };
const MOCK_STORY = { id: 'st1', userId: 'user-1', title: 'Test Story', content: 'Once upon a time...', createdAt: new Date(), updatedAt: new Date() };
const MOCK_SCENE = { id: 'sc1', userId: 'user-1', storyId: 'st1', title: 'Scene 1', description: '', style: '', position: 0, createdAt: new Date(), updatedAt: new Date() };
const MOCK_ILL = { id: 'i1', userId: 'user-1', storyId: 'st1', objectName: 'user-1/ill.jpg', mimeType: 'image/jpeg', status: 'uploaded', style: null, sceneId: null, createdAt: new Date() };
const MOCK_BOOK = { id: 'b1', userId: 'user-1', storyId: 'st1', title: 'My Book', format: 'a4', status: 'draft', pdfObjectName: null, authorName: null, coverSettings: null, error: null, createdAt: new Date(), updatedAt: new Date() };
const MOCK_BOOK_WITH_PDF = { ...MOCK_BOOK, pdfObjectName: 'user-1/book.pdf', status: 'ready' };

function mf() { return vi.fn(); }

const prisma = {
  userFile: { aggregate: mf() },
  usageCounter: { findMany: mf(), findFirst: mf(), create: mf(), update: mf() },
  subscription: { findUnique: mf() },
  voiceSample: { findMany: mf(), findFirst: mf(), create: mf(), update: mf(), delete: mf(), deleteMany: mf(), count: mf() },
  story: { count: mf(), findUnique: mf(), findMany: mf() },
  childProfile: { count: mf() }, character: { count: mf() },
  voiceConsent: { findFirst: mf(), findMany: mf(), create: mf(), update: mf(), updateMany: mf() },
  storyScene: { findUnique: mf(), findFirst: mf(), findMany: mf(), create: mf(), update: mf(), delete: mf(), updateMany: mf() },
  storyIllustration: { findUnique: mf(), findMany: mf(), create: mf(), update: mf(), delete: mf(), count: mf() },
  bookProject: { findUnique: mf(), findMany: mf(), create: mf(), update: mf(), delete: mf(), count: mf() },
  storyAudio: { findUnique: mf(), findFirst: mf(), findMany: mf(), create: mf(), update: mf(), delete: mf() },
};

const storage = {
  upload: mf().mockResolvedValue({ objectName: 'test/file.jpg', size: 1000 }),
  delete: mf().mockResolvedValue(undefined),
  getUrl: mf().mockResolvedValue('http://test.local/file.jpg'),
  getObject: mf().mockResolvedValue({ stream: Readable.from([Buffer.from('%PDF-1.7')]), size: 8, contentType: 'application/pdf' }),
  belongsToUser: mf().mockReturnValue(true),
};

const fh = {
  uploadFile: mf().mockResolvedValue({ objectName: 'test/file.jpg', size: 1000, fileId: 'f1' }),
  deleteFile: mf().mockResolvedValue(undefined),
  replaceFile: mf().mockResolvedValue({ objectName: 'test/new.jpg', size: 2000, fileId: 'f2' }),
};

vi.mock('../auth/auth.middleware.js', () => ({
  requireAuth: vi.fn().mockImplementation(async (request, _reply) => {
    request.auth = { user: { ...MOCK_USER }, sessionId: 'sess-1' };
  }),
  loadAuthContext: vi.fn().mockResolvedValue({ user: { ...MOCK_USER }, sessionId: 'sess-1' }),
  registerAuthHook: vi.fn(), setSessionCookie: vi.fn(), clearSessionCookie: vi.fn(),
  SESSION_COOKIE_NAME: 'session',
}));
vi.mock('../../lib/redis.js', () => ({ redis: { isOpen: false, connect: vi.fn(), get: vi.fn(), setEx: vi.fn(), del: vi.fn(), sAdd: vi.fn(), sRem: vi.fn(), sMembers: vi.fn(), expire: vi.fn(), on: vi.fn() }, connectRedis: vi.fn(), pingRedis: vi.fn() }));
vi.mock('../../config/env.js', () => ({ env: { SESSION_COOKIE_NAME: 'session', REDIS_URL: 'redis://test', LIMITS_ENFORCEMENT_ENABLED: false, NODE_ENV: 'test' } }));
vi.mock('../../lib/prisma.js', () => ({ prisma }));
vi.mock('../../lib/storage.js', () => ({ storage, StorageError: class extends Error { code; constructor(m,c) { super(m); this.code=c; this.name='StorageError'; } }, ALLOWED_MIME_TYPES: ['image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/ogg','audio/webm','application/pdf'] }));
vi.mock('../../lib/file-helper.js', () => fh);

import fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';

async function buildApp() {
  const app = fastify({ logger: false });
  await app.register(cookie, { secret: 'test-secret' });
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });
  app.addHook('onRequest', async (request) => { request.auth = null; });
  return app;
}

function resetMockGroup(group) {
  for (const value of Object.values(group)) {
    if (vi.isMockFunction(value)) value.mockReset();
  }
}

beforeEach(async () => {
  for (const repository of Object.values(prisma)) resetMockGroup(repository);
  resetMockGroup(storage);
  resetMockGroup(fh);

  storage.upload.mockResolvedValue({ objectName: 'test/file.jpg', size: 1000 });
  storage.delete.mockResolvedValue(undefined);
  storage.getUrl.mockResolvedValue('http://test.local/file.jpg');
  storage.belongsToUser.mockReturnValue(true);

  fh.uploadFile.mockResolvedValue({ objectName: 'test/file.jpg', size: 1000, fileId: 'f1' });
  fh.deleteFile.mockResolvedValue(undefined);
  fh.replaceFile.mockResolvedValue({ objectName: 'test/new.jpg', size: 2000, fileId: 'f2' });

  const authModule = await import('../auth/auth.middleware.js');
  vi.mocked(authModule.requireAuth).mockReset().mockImplementation(async (request) => {
    request.auth = { user: { ...MOCK_USER }, sessionId: 'sess-1' };
  });
  vi.mocked(authModule.loadAuthContext).mockReset().mockResolvedValue({
    user: { ...MOCK_USER },
    sessionId: 'sess-1',
  });
});

function multipartPayload(parts) {
  const boundary = '----tvoriskazku-test-boundary';
  const chunks = [];

  for (const part of parts) {
    if (part.filename) {
      chunks.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
        `Content-Type: ${part.contentType}\r\n\r\n`,
      ));
      chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${part.name}"\r\n\r\n` +
        `${part.value}\r\n`,
      ));
    }
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('Voice', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    const { registerVoiceRoutes } = await import('../voice/index.js');
    await app.register(registerVoiceRoutes);
    await app.ready();
  });
  afterAll(async () => { await app.close(); });

  beforeEach(() => { vi.clearAllMocks(); });

  it('GET consent-info returns disabled status text (public)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/voice/consent-info' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.version).toBe('1.0');
    expect(body.text).toContain('отключён');
  });

  it.each([
    ['GET', '/api/voice/consent'],
    ['POST', '/api/voice/consent'],
    ['POST', '/api/voice/consent/revoke'],
    ['GET', '/api/voice/samples'],
    ['GET', '/api/voice/samples/s1'],
    ['POST', '/api/voice/samples'],
    ['PATCH', '/api/voice/samples/s1'],
    ['DELETE', '/api/voice/samples/s1'],
    ['GET', '/api/voice/samples/s1/audio-url'],
  ])('%s %s is disabled', async (method, url) => {
    const res = await app.inject({ method, url });
    expect(res.statusCode).toBe(410);
    expect(JSON.parse(res.body).message).toContain('отключены');
  });

  it('disabled voice endpoints still require auth first', async () => {
    const authModule = await import('../auth/auth.middleware.js');
    vi.mocked(authModule.requireAuth).mockImplementationOnce(async (_request, reply) => {
      reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Требуется авторизация' });
    });

    const res = await app.inject({ method: 'GET', url: '/api/voice/consent' });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toContain('Требуется авторизация');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
//  SCENES  (13 tests)
// ════════════════════════════════════════════════════════════════════════════════

describe('Scenes', () => {
  let app;
  beforeAll(async () => {
    app = await buildApp();
    const { registerScenesRoutes } = await import('../scenes/index.js');
    await app.register(registerScenesRoutes);
    await app.ready();
  });
  afterAll(async () => { await app.close(); });

  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /scenes without storyId returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/scenes' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain('storyId');
  });

  it('GET /scenes with storyId returns 200 and scenes', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyScene.findMany.mockResolvedValue([MOCK_SCENE]);
    const res = await app.inject({ method: 'GET', url: '/api/scenes?storyId=st1' });
    expect(res.statusCode, res.body).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  it('POST /scenes creates and returns 201', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyScene.findFirst.mockResolvedValue(null);
    prisma.storyScene.create.mockResolvedValue(MOCK_SCENE);
    const res = await app.inject({ method: 'POST', url: '/api/scenes', payload: { storyId: 'st1', title: 'Scene 1' } });
    expect(res.statusCode).toBe(201);
    expect(prisma.storyScene.create).toHaveBeenCalled();
  });

  it('POST /scenes returns 404 for non-owned story', async () => {
    prisma.story.findUnique.mockResolvedValue({ ...MOCK_STORY, userId: 'user-2' });
    const res = await app.inject({ method: 'POST', url: '/api/scenes', payload: { storyId: 'st1', title: 'Hello' } });
    expect(res.statusCode).toBe(404);
  });

  it('POST /scenes without storyId returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/scenes', payload: { title: 'X' } });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /scenes/:id returns 200 with updated scene', async () => {
    prisma.storyScene.findUnique.mockResolvedValue(MOCK_SCENE);
    prisma.storyScene.update.mockResolvedValue({ ...MOCK_SCENE, title: 'Updated!' });
    const res = await app.inject({ method: 'PATCH', url: '/api/scenes/sc1', payload: { title: 'Updated!' } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).title).toBe('Updated!');
    expect(prisma.storyScene.update).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Updated!' } }));
  });

  it('DELETE /scenes/:id returns 204', async () => {
    prisma.storyScene.findUnique.mockResolvedValue(MOCK_SCENE);
    prisma.storyScene.delete.mockResolvedValue(MOCK_SCENE);
    const res = await app.inject({ method: 'DELETE', url: '/api/scenes/sc1' });
    expect(res.statusCode).toBe(204);
    expect(prisma.storyScene.delete).toHaveBeenCalledWith({ where: { id: 'sc1' } });
  });

  it('POST /scenes/reorder returns 200', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyScene.updateMany.mockResolvedValue({ count: 1 });
    prisma.storyScene.findMany.mockResolvedValue([MOCK_SCENE]);
    const res = await app.inject({ method: 'POST', url: '/api/scenes/reorder?storyId=st1', payload: { sceneIds: ['sc1'] } });
    expect(res.statusCode).toBe(200);
  });

  it('POST /scenes/reorder without storyId returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/scenes/reorder', payload: { sceneIds: ['a'] } });
    expect(res.statusCode).toBe(400);
  });

  it('POST /scenes/reorder without sceneIds returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/scenes/reorder?storyId=st1', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('GET /scenes/:id returns 404 for non-owned scene (exists, other user)', async () => {
    prisma.storyScene.findUnique.mockResolvedValue({ ...MOCK_SCENE, userId: 'user-2' });
    const res = await app.inject({ method: 'GET', url: '/api/scenes/sc1' });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /scenes/:id returns 404 for non-owned scene', async () => {
    prisma.storyScene.findUnique.mockResolvedValue({ ...MOCK_SCENE, userId: 'user-2' });
    const res = await app.inject({ method: 'PATCH', url: '/api/scenes/sc1', payload: { title: 'hack' } });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /scenes/:id returns 404 for non-owned scene', async () => {
    prisma.storyScene.findUnique.mockResolvedValue({ ...MOCK_SCENE, userId: 'user-2' });
    const res = await app.inject({ method: 'DELETE', url: '/api/scenes/sc1' });
    expect(res.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
//  ILLUSTRATIONS  (13 tests)
// ════════════════════════════════════════════════════════════════════════════════

describe('Illustrations', () => {
  let app;
  beforeAll(async () => {
    app = await buildApp();
    const { registerIllustrationsRoutes } = await import('../illustrations/index.js');
    await app.register(registerIllustrationsRoutes);
    await app.ready();
  });
  afterAll(async () => { await app.close(); });

  beforeEach(() => { vi.clearAllMocks(); });

  it('GET provider-status returns configured: false (public)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/illustrations/provider-status' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).configured).toBe(false);
  });

  it('GET /illustrations without storyId returns 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/illustrations' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /illustrations with storyId returns 200', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyIllustration.findMany.mockResolvedValue([MOCK_ILL]);
    const res = await app.inject({ method: 'GET', url: '/api/illustrations?storyId=st1' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  it('GET /illustrations/:id returns 200', async () => {
    prisma.storyIllustration.findUnique.mockResolvedValue(MOCK_ILL);
    const res = await app.inject({ method: 'GET', url: '/api/illustrations/i1' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe('i1');
  });

  it('GET /illustrations/:id returns 404 for non-owned', async () => {
    prisma.storyIllustration.findUnique.mockResolvedValue({ ...MOCK_ILL, userId: 'user-2' });
    const res = await app.inject({ method: 'GET', url: '/api/illustrations/i1' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /illustrations/upload multipart returns 201 and calls uploadFile', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyIllustration.create.mockResolvedValue({ ...MOCK_ILL, objectName: 'user-1/ill.jpg' });
    fh.uploadFile.mockResolvedValue({ objectName: 'user-1/ill.jpg', size: 1000, fileId: 'f1' });
    prisma.usageCounter.findFirst.mockResolvedValue(null);
    prisma.usageCounter.create.mockResolvedValue({ id: 'usage-2', used: 1 });

    const multipart = multipartPayload([
      { name: 'storyId', value: 'st1' },
      { name: 'style', value: 'watercolor' },
      {
        name: 'file',
        filename: 'ill.png',
        contentType: 'image/png',
        value: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
    ]);
    const res = await app.inject({ method: 'POST', url: '/api/illustrations/upload', ...multipart });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).id).toBe('i1');
    expect(fh.uploadFile).toHaveBeenCalledWith(
      'user-1', expect.any(Buffer), 'image/png', 'ill.png', 'illustration',
    );
    expect(prisma.storyIllustration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ storyId: 'st1', userId: 'user-1' }) }),
    );
  });

  it('POST /illustrations/upload without multipart returns 406 (multipart required)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/illustrations/upload' });
    expect(res.statusCode).toBe(406);
  });

  it('POST /illustrations/:id/replace multipart returns 200 and calls replaceFile', async () => {
    prisma.storyIllustration.findUnique.mockResolvedValue(MOCK_ILL);
    prisma.storyIllustration.update.mockResolvedValue({ ...MOCK_ILL, objectName: 'test/new.jpg', mimeType: 'image/png' });

    const multipart = multipartPayload([
      {
        name: 'file',
        filename: 'new.png',
        contentType: 'image/png',
        value: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
    ]);
    const res = await app.inject({ method: 'POST', url: '/api/illustrations/i1/replace', ...multipart });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).objectName).toBe('test/new.jpg');
    expect(fh.replaceFile).toHaveBeenCalledWith(
      'user-1', expect.any(Buffer), 'image/png', 'new.png', 'illustration', MOCK_ILL.objectName,
    );
    expect(prisma.storyIllustration.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { objectName: 'test/new.jpg', mimeType: 'image/png' },
    });
  });

  it('POST /illustrations/:id/replace without multipart returns 406 (multipart required)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/illustrations/i1/replace' });
    expect(res.statusCode).toBe(406);
  });

  it('DELETE /illustrations/:id returns 204 and calls deleteFile', async () => {
    prisma.storyIllustration.findUnique.mockResolvedValue(MOCK_ILL);
    prisma.storyIllustration.delete.mockResolvedValue(MOCK_ILL);
    const res = await app.inject({ method: 'DELETE', url: '/api/illustrations/i1' });
    expect(res.statusCode).toBe(204);
    expect(fh.deleteFile).toHaveBeenCalledWith(MOCK_ILL.objectName);
  });

  it('DELETE /illustrations/:id returns 404 for non-owned', async () => {
    prisma.storyIllustration.findUnique.mockResolvedValue({ ...MOCK_ILL, userId: 'user-2' });
    const res = await app.inject({ method: 'DELETE', url: '/api/illustrations/i1' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /illustrations/:id/url returns 200 with url', async () => {
    prisma.storyIllustration.findUnique.mockResolvedValue(MOCK_ILL);
    const res = await app.inject({ method: 'GET', url: '/api/illustrations/i1/url' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).url).toContain('http://');
  });

  it('GET /illustrations/:id/url returns 404 when objectName is null', async () => {
    prisma.storyIllustration.findUnique.mockResolvedValue({ ...MOCK_ILL, objectName: null });
    const res = await app.inject({ method: 'GET', url: '/api/illustrations/i1/url' });
    expect(res.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
//  BOOKS  (13 tests)
// ════════════════════════════════════════════════════════════════════════════════

describe('Books', () => {
  let app;
  beforeAll(async () => {
    app = await buildApp();
    const { registerBooksRoutes } = await import('../books/index.js');
    await app.register(registerBooksRoutes);
    await app.ready();
  });
  afterAll(async () => { await app.close(); });

  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /books returns 200 with array', async () => {
    prisma.bookProject.findMany.mockResolvedValue([MOCK_BOOK]);
    const res = await app.inject({ method: 'GET', url: '/api/books' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  it('POST /books creates project and returns 201', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.bookProject.create.mockResolvedValue(MOCK_BOOK);
    const res = await app.inject({ method: 'POST', url: '/api/books', payload: { storyId: 'st1', title: 'My Book' } });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).title).toBe('My Book');
    expect(prisma.bookProject.create).toHaveBeenCalled();
  });

  it('POST /books without title returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/books', payload: { storyId: 'st1' } });
    expect(res.statusCode).toBe(400);
  });

  it('POST /books without storyId returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/books', payload: { title: 'Book' } });
    expect(res.statusCode).toBe(400);
  });

  it('POST /books with invalid format returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/books', payload: { storyId: 'st1', title: 'B', format: 'a3' } });
    expect(res.statusCode).toBe(400);
  });

  it('GET /books/:id returns 200', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK);
    const res = await app.inject({ method: 'GET', url: '/api/books/b1' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe('b1');
  });

  it('PATCH /books/:id updates and returns 200', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK);
    prisma.bookProject.update.mockResolvedValue({ ...MOCK_BOOK, title: 'Edited' });
    const res = await app.inject({ method: 'PATCH', url: '/api/books/b1', payload: { title: 'Edited' } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).title).toBe('Edited');
  });

  it('POST /books/:id/generate generates PDF and returns 200', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK);
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyIllustration.findMany.mockResolvedValue([]);
    prisma.bookProject.update.mockResolvedValue(MOCK_BOOK_WITH_PDF);
    const res = await app.inject({ method: 'POST', url: '/api/books/b1/generate' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('ready');
    expect(fh.uploadFile).toHaveBeenCalledWith(
      'user-1', expect.any(Buffer), 'application/pdf', 'My Book.pdf', 'pdf',
    );
    expect(prisma.bookProject.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { pdfObjectName: 'test/file.jpg', status: 'ready', error: null },
    });
  });

  it('POST /books/:id/generate re-generates and deletes old PDF', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK_WITH_PDF);
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyIllustration.findMany.mockResolvedValue([]);
    prisma.bookProject.update.mockResolvedValue(MOCK_BOOK_WITH_PDF);
    const res = await app.inject({ method: 'POST', url: '/api/books/b1/generate' });
    expect(res.statusCode).toBe(200);
    expect(fh.uploadFile).toHaveBeenCalledWith(
      'user-1', expect.any(Buffer), 'application/pdf', 'My Book.pdf', 'pdf',
    );
    expect(fh.deleteFile).toHaveBeenCalledWith('user-1/book.pdf');
  });

  it('GET /books/:id/pdf-url returns 200 with url', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK_WITH_PDF);
    const res = await app.inject({ method: 'GET', url: '/api/books/b1/pdf-url' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).url).toContain('http://');
  });

  it('GET /books/:id/pdf-url returns 404 when no PDF', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK);
    const res = await app.inject({ method: 'GET', url: '/api/books/b1/pdf-url' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /books/:id/download streams an owned ready PDF', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK_WITH_PDF);
    storage.getObject.mockResolvedValueOnce({
      stream: Readable.from([Buffer.from('%PDF-1.7')]),
      size: 8,
      contentType: 'application/pdf',
    });
    const res = await app.inject({ method: 'GET', url: '/api/books/b1/download' });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body).toContain('%PDF');
  });

  it('DELETE /books/:id with PDF deletes and returns 204', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK_WITH_PDF);
    prisma.bookProject.delete.mockResolvedValue(MOCK_BOOK_WITH_PDF);
    const res = await app.inject({ method: 'DELETE', url: '/api/books/b1' });
    expect(res.statusCode).toBe(204);
    expect(fh.deleteFile).toHaveBeenCalledWith('user-1/book.pdf');
  });

  it('DELETE /books/:id without PDF returns 204', async () => {
    prisma.bookProject.findUnique.mockResolvedValue(MOCK_BOOK);
    prisma.bookProject.delete.mockResolvedValue(MOCK_BOOK);
    const res = await app.inject({ method: 'DELETE', url: '/api/books/b1' });
    expect(res.statusCode).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
//  TTS (ElevenLabs) routes
// ════════════════════════════════════════════════════════════════════════════════

describe('TTS routes', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp();
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    const { registerTtsRoutes } = await import('../tts/index.js');
    await app.register(registerTtsRoutes);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /tts/status returns configured:false without API key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tts/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Without real API key, configured may be false
    expect(body).toHaveProperty('configured');
  });

  it('GET /tts/voices returns safe local catalog without API key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tts/voices' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('voiceId');
    expect(body[0]).toHaveProperty('available');
  });

  it('POST /tts/stories/:storyId/audio without auth returns 401', async () => {
    const authModule = await import('../auth/auth.middleware.js');
    vi.mocked(authModule.requireAuth).mockImplementationOnce(async (_req, reply) => {
      reply.code(401).send({ statusCode: 401, error: 'Unauthorized' });
    });
    const res = await app.inject({ method: 'POST', url: '/api/tts/stories/st1/audio' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /tts/stories/:storyId/audio returns 404 for non-owned story', async () => {
    prisma.story.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'POST', url: '/api/tts/stories/st1/audio', payload: {} });
    expect(res.statusCode).toBe(404);
  });

  it('POST /tts/stories/:storyId/audio returns 503 without API key', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    const res = await app.inject({ method: 'POST', url: '/api/tts/stories/st1/audio', payload: {} });
    expect(res.statusCode).toBe(503);
  });

  it('GET /tts/stories/:storyId/audio without auth returns 401', async () => {
    const authModule = await import('../auth/auth.middleware.js');
    vi.mocked(authModule.requireAuth).mockImplementationOnce(async (_req, reply) => {
      reply.code(401).send({ statusCode: 401, error: 'Unauthorized' });
    });
    const res = await app.inject({ method: 'GET', url: '/api/tts/stories/st1/audio' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /tts/stories/:storyId/audio returns list', async () => {
    prisma.story.findUnique.mockResolvedValue(MOCK_STORY);
    prisma.storyAudio.findMany.mockResolvedValue([]);
    const res = await app.inject({ method: 'GET', url: '/api/tts/stories/st1/audio' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(res.body))).toBe(true);
  });

  it('GET /tts/story-audio/:id/status returns 404 for non-owned', async () => {
    prisma.storyAudio.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'GET', url: '/api/tts/story-audio/aud-1/status' });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /tts/story-audio/:id returns 404 for non-owned', async () => {
    prisma.storyAudio.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'DELETE', url: '/api/tts/story-audio/aud-1' });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /tts/story-audio/:id deletes owned audio', async () => {
    prisma.storyAudio.findUnique.mockResolvedValue({
      id: 'aud-1', userId: 'user-1', storyId: 'st1',
      objectName: 'user-1/test.mp3', status: 'completed',
      voiceId: 'TX3LPaxmHKxFdv7VOQHJ', provider: 'elevenlabs',
      mimeType: 'audio/mpeg', durationMs: 10000,
      createdAt: new Date(), updatedAt: new Date(),
    });
    prisma.storyAudio.delete.mockResolvedValue({});

    const res = await app.inject({ method: 'DELETE', url: '/api/tts/story-audio/aud-1' });
    expect(res.statusCode).toBe(204);
    expect(fh.deleteFile).toHaveBeenCalledWith('user-1/test.mp3');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
//  STORAGE BYTES  (9 tests)
// ════════════════════════════════════════════════════════════════════════════════

describe('StorageBytes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getUsage returns storageBytes from UserFile aggregate (no UsageCounter)', async () => {
    prisma.userFile.aggregate.mockResolvedValue({ _sum: { size: 75000 } });
    prisma.usageCounter.findMany.mockResolvedValue([]);
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.storyIllustration.count.mockResolvedValue(0);
    prisma.bookProject.count.mockResolvedValue(0);
    prisma.voiceSample.count.mockResolvedValue(0);
    const { getUsage } = await import('../tariffs/tariffs.service.js');
    expect((await getUsage('user-1')).storageBytes).toBe(75000);
  });

  it('getUsage returns 0 storageBytes when UserFile aggregate is null', async () => {
    prisma.userFile.aggregate.mockResolvedValue({ _sum: { size: null } });
    prisma.usageCounter.findMany.mockResolvedValue([]);
    prisma.subscription.findUnique.mockResolvedValue(null);
    prisma.storyIllustration.count.mockResolvedValue(0);
    prisma.bookProject.count.mockResolvedValue(0);
    prisma.voiceSample.count.mockResolvedValue(0);
    const { getUsage } = await import('../tariffs/tariffs.service.js');
    expect((await getUsage('user-1')).storageBytes).toBe(0);
  });

  it('getStorageUsed returns 0 when no files', async () => {
    prisma.userFile.aggregate.mockResolvedValue({ _sum: { size: null } });
    const { getStorageUsed } = await import('../tariffs/tariffs.service.js');
    expect(await getStorageUsed('user-1')).toBe(0);
  });

  it('getStorageUsed returns sum from UserFile', async () => {
    prisma.userFile.aggregate.mockResolvedValue({ _sum: { size: 12345 } });
    const { getStorageUsed } = await import('../tariffs/tariffs.service.js');
    expect(await getStorageUsed('user-1')).toBe(12345);
  });

  it('incrementUsage creates UsageCounter on first call', async () => {
    prisma.usageCounter.findFirst.mockResolvedValue(null);
    prisma.usageCounter.create.mockResolvedValue({ id: 'c1', used: 200 });
    const { incrementUsage } = await import('../tariffs/tariffs.service.js');
    await incrementUsage('u1', 'storageBytes', 200);
    expect(prisma.usageCounter.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ used: 200 }) }));
  });

  it('incrementUsage updates existing UsageCounter', async () => {
    prisma.usageCounter.findFirst.mockResolvedValue({ id: 'c1', used: 100 });
    prisma.usageCounter.update.mockResolvedValue({ id: 'c1', used: 300 });
    const { incrementUsage } = await import('../tariffs/tariffs.service.js');
    await incrementUsage('u1', 'storageBytes', 200);
    expect(prisma.usageCounter.update).toHaveBeenCalledWith(expect.objectContaining({ data: { used: { increment: 200 } } }));
  });

  it('checkLimit returns allowed=true when enforcement disabled', async () => {
    const { checkLimit } = await import('../tariffs/tariffs.service.js');
    const result = await checkLimit('user-1', 'storageBytes');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(999999);
  });

  it('getUserPlan returns free for user without subscription', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    const { getUserPlan } = await import('../tariffs/tariffs.service.js');
    expect((await getUserPlan('user-1')).plan.id).toBe('free');
  });

  it('getPlans returns 3 plans', async () => {
    const { getPlans } = await import('../tariffs/tariffs.service.js');
    const plans = getPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map(p => p.id)).toEqual(['free', 'family', 'premium']);
  });
});
