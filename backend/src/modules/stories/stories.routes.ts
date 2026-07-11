import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import { generateStory, getJobStatus, cancelStoryJob, createStory, getStories, getStoryById, updateStory, deleteStory } from './stories.service.js';
import { generateStorySchema, jobIdParamSchema, createStorySchema, updateStorySchema, updateStoryInternalSchema, storyQuerySchema, storyIdParamSchema } from './stories.schema.js';
import { PERSONAL_DATA_BLOCK_MESSAGE } from '../../lib/personal-data-filter.js';
import { PrivacyConsentRequiredError } from '../../lib/privacy-consent.service.js';
import { LimitExceededError } from '../../lib/limit-exceeded-error.js';

function personalDataReply(reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }, error: unknown): boolean {
  if (error instanceof Error && error.name === 'PersonalDataError') {
    reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: PERSONAL_DATA_BLOCK_MESSAGE,
    });
    return true;
  }
  return false;
}

const storiesRoutes: FastifyPluginCallback = (app, _options, done) => {
  // POST /api/stories/generate
  app.post('/generate', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = generateStorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные параметры сказки',
      });
    }

    const context = request.auth!;
    let result;
    try {
      result = await generateStory(context.user.id, parsed.data);
    } catch (error) {
      if (personalDataReply(reply, error)) return;
      if (error instanceof PrivacyConsentRequiredError) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: error.message,
        });
      }
      if (error instanceof LimitExceededError) {
        return reply.code(429).send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: error.message,
        });
      }
      throw error;
    }

    return reply.code(201).send(result);
  });

  // POST /api/stories/jobs/:id/cancel
  app.post('/jobs/:id/cancel', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = jobIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор задачи',
      });
    }

    const context = request.auth!;
    const result = await cancelStoryJob(parsed.data.id, context.user.id);

    if (!result.cancelled) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Задача не найдена или уже завершена',
      });
    }

    return reply.send({ cancelled: true, message: 'Генерация отменена' });
  });

  // GET /api/stories/jobs/:id
  app.get('/jobs/:id', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = jobIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор задачи',
      });
    }

    const context = request.auth!;
    const job = await getJobStatus(parsed.data.id, context.user.id);

    if (!job) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Задача не найдена',
      });
    }

    return reply.send({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error,
    });
  });

  // --- CRUD Routes ---

  // POST /api/stories — create story
  app.post('/', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = createStorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    const context = request.auth!;
    let story;
    try {
      story = await createStory(context.user.id, parsed.data);
    } catch (error) {
      if (personalDataReply(reply, error)) return;
      throw error;
    }
    return reply.code(201).send(story);
  });

  // GET /api/stories — list stories
  app.get('/', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = storyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные параметры запроса',
      });
    }

    const context = request.auth!;
    const result = await getStories(context.user.id, parsed.data);
    return reply.send(result);
  });

  // GET /api/stories/:id — get one story
  app.get('/:id', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = storyIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор',
      });
    }

    const context = request.auth!;
    const story = await getStoryById(parsed.data.id, context.user.id);

    if (!story) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Сказка не найдена',
      });
    }

    return reply.send(story);
  });

  // PATCH /api/stories/:id — update story (только публичные поля, без personalizationNames)
  app.patch('/:id', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsedParams = storyIdParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор',
      });
    }

    // Используем updateStoryInternalSchema — она не принимает personalizationNames
    const parsedBody = updateStoryInternalSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsedBody.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    const context = request.auth!;
    let story;
    try {
      story = await updateStory(parsedParams.data.id, context.user.id, parsedBody.data);
    } catch (error) {
      if (personalDataReply(reply, error)) return;
      throw error;
    }

    if (!story) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Сказка не найдена',
      });
    }

    return reply.send(story);
  });

  // DELETE /api/stories/:id — delete story
  app.delete('/:id', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = storyIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор',
      });
    }

    const context = request.auth!;
    const deleted = await deleteStory(parsed.data.id, context.user.id);

    if (!deleted) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Сказка не найдена',
      });
    }

    return reply.code(204).send();
  });

  done();
};

export function registerStoriesRoutes(app: FastifyInstance): void {
  app.register(storiesRoutes, { prefix: '/api/stories' });
}
