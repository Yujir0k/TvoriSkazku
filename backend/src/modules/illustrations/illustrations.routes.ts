import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import { getIllustrations, getIllustrationById, uploadIllustration, replaceIllustration, deleteIllustration, getIllustrationUrl, getImageProviderStatus, startGeneratedIllustration, syncGeneratedIllustration } from './illustrations.service.js';
import { illustrationIdParamSchema, createIllustrationSchema, generateIllustrationSchema } from './illustrations.schema.js';
import { PERSONAL_DATA_BLOCK_MESSAGE } from '../../lib/personal-data-filter.js';

const illustrationsRoutes: FastifyPluginCallback = (app, _options, done) => {
  // GET /api/illustrations/provider-status
  app.get('/provider-status', async (_request, reply) => {
    return reply.send(getImageProviderStatus());
  });

  // POST /api/illustrations/generate — start an asynchronous book illustration.
  app.post('/generate', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = generateIllustrationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
    try {
      const illustration = await startGeneratedIllustration(
        request.auth!.user.id,
        parsed.data.storyId,
        parsed.data.description,
        parsed.data.style,
        parsed.data.sceneId,
      );
      if (!illustration) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сказка не найдена' });
      return reply.code(202).send(illustration);
    } catch (error) {
      if (error instanceof Error && error.name === 'PersonalDataError') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: PERSONAL_DATA_BLOCK_MESSAGE,
        });
      }
      const providerError = error as Error & { statusCode?: number; code?: string };
      return reply.code(providerError.statusCode || 503).send({
        statusCode: providerError.statusCode || 503,
        error: 'Service Unavailable',
        message: providerError.code === 'IMAGE_PROVIDER_NOT_CONFIGURED'
          ? 'Генератор иллюстраций ещё не настроен'
          : 'Не удалось запустить генерацию иллюстрации',
      });
    }
  });

  // GET /api/illustrations/:id/status — sync provider result and persist it in MinIO.
  app.get('/:id/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = illustrationIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    try {
      const illustration = await syncGeneratedIllustration(parsed.data.id, request.auth!.user.id);
      if (!illustration) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Иллюстрация не найдена' });
      return reply.send(illustration);
    } catch (error) {
      const providerError = error as Error & { statusCode?: number };
      return reply.code(providerError.statusCode || 502).send({
        statusCode: providerError.statusCode || 502,
        error: 'Bad Gateway',
        message: 'Не удалось получить готовую иллюстрацию. Попробуйте позже.',
      });
    }
  });

  // GET /api/illustrations?storyId=xxx
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const storyId = (request.query as Record<string, string>).storyId;
    if (!storyId) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'storyId обязателен' });
    const illustrations = await getIllustrations(storyId, request.auth!.user.id);
    return reply.send(illustrations);
  });

  // GET /api/illustrations/:id
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = illustrationIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const ill = await getIllustrationById(parsed.data.id, request.auth!.user.id);
    if (!ill) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Иллюстрация не найдена' });
    return reply.send(ill);
  });

  // POST /api/illustrations/upload — upload manually
  app.post('/upload', { preHandler: [requireAuth] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Файл не загружен' });

    const rawFields = (file.fields as Record<string, { value: string }>) || {};
    const storyId = rawFields.storyId?.value || '';
    const sceneId = rawFields.sceneId?.value || undefined;
    const style = rawFields.style?.value || '';

    if (!storyId) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'storyId обязателен' });

    const parsedBody = createIllustrationSchema.safeParse({ storyId, sceneId, style });
    if (!parsedBody.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsedBody.error.issues[0]?.message });

    const buffer = await file.toBuffer();
    try {
      const ill = await uploadIllustration(
        request.auth!.user.id,
        storyId,
        buffer,
        file.mimetype,
        file.filename || 'illustration.jpg',
        parsedBody.data,
      );
      if (!ill) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сказка не найдена' });
      return reply.code(201).send(ill);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode || 400).send({ statusCode: e.statusCode || 400, error: 'Bad Request', message: e.message });
    }
  });

  // POST /api/illustrations/:id/replace — replace image
  app.post('/:id/replace', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = illustrationIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });

    const file = await request.file();
    if (!file) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Файл не загружен' });

    const buffer = await file.toBuffer();
    try {
      const ill = await replaceIllustration(
        parsed.data.id,
        request.auth!.user.id,
        buffer,
        file.mimetype,
        file.filename || 'illustration.jpg',
      );
      if (!ill) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Иллюстрация не найдена' });
      return reply.send(ill);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode || 400).send({ statusCode: e.statusCode || 400, error: 'Bad Request', message: e.message });
    }
  });

  // DELETE /api/illustrations/:id
  app.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = illustrationIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const deleted = await deleteIllustration(parsed.data.id, request.auth!.user.id);
    if (!deleted) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Иллюстрация не найдена' });
    return reply.code(204).send();
  });

  // GET /api/illustrations/:id/url
  app.get('/:id/url', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = illustrationIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const url = await getIllustrationUrl(parsed.data.id, request.auth!.user.id);
    if (!url) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Иллюстрация не найдена' });
    return reply.send({ url });
  });

  done();
};

export function registerIllustrationsRoutes(app: FastifyInstance): void {
  app.register(illustrationsRoutes, { prefix: '/api/illustrations' });
}
