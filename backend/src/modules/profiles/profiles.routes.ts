import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  deleteProfile,
} from './profiles.service.js';
import {
  createProfileSchema,
  updateProfileSchema,
  profileIdParamSchema,
} from './profiles.schema.js';
import { PERSONAL_DATA_BLOCK_MESSAGE } from '../../lib/personal-data-filter.js';

const PHOTO_UPLOAD_DISABLED_MESSAGE = 'Загрузка пользовательских фото отключена. Выберите готовый аватар.';

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

const profilesRoutes: FastifyPluginCallback = (app, _options, done) => {
  // POST /api/profiles
  app.post('/', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = createProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    const context = request.auth!;
    let profile;
    try {
      profile = await createProfile(context.user.id, parsed.data);
    } catch (error) {
      if (personalDataReply(reply, error)) return;
      throw error;
    }
    return reply.code(201).send(profile);
  });

  // GET /api/profiles
  app.get('/', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const context = request.auth!;
    const profiles = await getProfiles(context.user.id);
    return reply.send(profiles);
  });

  // GET /api/profiles/:id
  app.get('/:id', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = profileIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор',
      });
    }

    const context = request.auth!;
    const profile = await getProfileById(parsed.data.id, context.user.id);

    if (!profile) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Профиль не найден',
      });
    }

    return reply.send(profile);
  });

  // PATCH /api/profiles/:id
  app.patch('/:id', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsedParams = profileIdParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор',
      });
    }

    const parsedBody = updateProfileSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsedBody.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    const context = request.auth!;
    let profile;
    try {
      profile = await updateProfile(parsedParams.data.id, context.user.id, parsedBody.data);
    } catch (error) {
      if (personalDataReply(reply, error)) return;
      throw error;
    }

    if (!profile) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Профиль не найден',
      });
    }

    return reply.send(profile);
  });

  // DELETE /api/profiles/:id
  app.delete('/:id', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const parsed = profileIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный идентификатор',
      });
    }

    const context = request.auth!;
    const deleted = await deleteProfile(parsed.data.id, context.user.id);

    if (!deleted) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Профиль не найден',
      });
    }

    return reply.code(204).send();
  });

  app.post('/:id/photo', {
    preHandler: [requireAuth],
  }, async (_request, reply) => reply.code(410).send({ statusCode: 410, error: 'Gone', message: PHOTO_UPLOAD_DISABLED_MESSAGE }));

  app.delete('/:id/photo', {
    preHandler: [requireAuth],
  }, async (_request, reply) => reply.code(410).send({ statusCode: 410, error: 'Gone', message: PHOTO_UPLOAD_DISABLED_MESSAGE }));

  app.get('/:id/photo-url', {
    preHandler: [requireAuth],
  }, async (_request, reply) => reply.code(410).send({ statusCode: 410, error: 'Gone', message: PHOTO_UPLOAD_DISABLED_MESSAGE }));

  done();
};

export function registerProfilesRoutes(app: FastifyInstance): void {
  app.register(profilesRoutes, { prefix: '/api/profiles' });
}
