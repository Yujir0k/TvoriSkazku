import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import {
  createCharacter,
  getCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter,
} from './characters.service.js';
import {
  createCharacterSchema,
  updateCharacterSchema,
  characterIdParamSchema,
  characterQuerySchema,
} from './characters.schema.js';

const PHOTO_UPLOAD_DISABLED_MESSAGE = 'Загрузка пользовательских фото отключена. Выберите готовый аватар.';

const charactersRoutes: FastifyPluginCallback = (app, _options, done) => {
  // POST /api/characters
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = createCharacterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Некорректные данные' });
    }
    try {
      const character = await createCharacter(request.auth!.user.id, parsed.data);
      return reply.code(201).send(character);
    } catch (err) {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: (err as Error).message });
    }
  });

  // GET /api/characters
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = characterQuerySchema.safeParse(request.query);
    const query = parsed.success ? parsed.data : {};
    const characters = await getCharacters(request.auth!.user.id, query);
    return reply.send(characters);
  });

  // GET /api/characters/:id
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = characterIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const character = await getCharacterById(parsed.data.id, request.auth!.user.id);
    if (!character) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Персонаж не найден' });
    return reply.send(character);
  });

  // PATCH /api/characters/:id
  app.patch('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsedParams = characterIdParamSchema.safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const parsedBody = updateCharacterSchema.safeParse(request.body);
    if (!parsedBody.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsedBody.error.issues[0]?.message ?? 'Некорректные данные' });
    try {
      const character = await updateCharacter(parsedParams.data.id, request.auth!.user.id, parsedBody.data);
      if (!character) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Персонаж не найден' });
      return reply.send(character);
    } catch (err) {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: (err as Error).message });
    }
  });

  // DELETE /api/characters/:id
  app.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = characterIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const deleted = await deleteCharacter(parsed.data.id, request.auth!.user.id);
    if (!deleted) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Персонаж не найден' });
    return reply.code(204).send();
  });

  app.post('/:id/photo', { preHandler: [requireAuth] }, async (_request, reply) => {
    return reply.code(410).send({ statusCode: 410, error: 'Gone', message: PHOTO_UPLOAD_DISABLED_MESSAGE });
  });

  app.delete('/:id/photo', { preHandler: [requireAuth] }, async (_request, reply) => {
    return reply.code(410).send({ statusCode: 410, error: 'Gone', message: PHOTO_UPLOAD_DISABLED_MESSAGE });
  });

  app.get('/:id/photo-url', { preHandler: [requireAuth] }, async (_request, reply) => {
    return reply.code(410).send({ statusCode: 410, error: 'Gone', message: PHOTO_UPLOAD_DISABLED_MESSAGE });
  });

  done();
};

export function registerCharactersRoutes(app: FastifyInstance): void {
  app.register(charactersRoutes, { prefix: '/api/characters' });
}
