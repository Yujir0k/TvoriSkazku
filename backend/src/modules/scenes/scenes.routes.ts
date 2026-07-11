import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import { getScenes, getSceneById, createScene, updateScene, deleteScene, reorderScenes } from './scenes.service.js';
import { createSceneSchema, updateSceneSchema, sceneIdParamSchema, reorderScenesSchema } from './scenes.schema.js';

const scenesRoutes: FastifyPluginCallback = (app, _options, done) => {
  // GET /api/scenes?storyId=xxx
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const storyId = (request.query as Record<string, string>).storyId;
    if (!storyId) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'storyId обязателен' });
    const scenes = await getScenes(storyId, request.auth!.user.id);
    return reply.send(scenes);
  });

  // GET /api/scenes/:id
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = sceneIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const scene = await getSceneById(parsed.data.id, request.auth!.user.id);
    if (!scene) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сцена не найдена' });
    return reply.send(scene);
  });

  // POST /api/scenes
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = createSceneSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
    const scene = await createScene(request.auth!.user.id, parsed.data);
    if (!scene) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сказка не найдена' });
    return reply.code(201).send(scene);
  });

  // PATCH /api/scenes/:id
  app.patch('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsedParams = sceneIdParamSchema.safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const parsedBody = updateSceneSchema.safeParse(request.body);
    if (!parsedBody.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsedBody.error.issues[0]?.message });
    const scene = await updateScene(parsedParams.data.id, request.auth!.user.id, parsedBody.data);
    if (!scene) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сцена не найдена' });
    return reply.send(scene);
  });

  // DELETE /api/scenes/:id
  app.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = sceneIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const deleted = await deleteScene(parsed.data.id, request.auth!.user.id);
    if (!deleted) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сцена не найдена' });
    return reply.code(204).send();
  });

  // POST /api/scenes/reorder — reorder scenes
  app.post('/reorder', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = reorderScenesSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
    const storyId = (request.query as Record<string, string>).storyId;
    if (!storyId) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'storyId обязателен' });
    const scenes = await reorderScenes(storyId, request.auth!.user.id, parsed.data.sceneIds);
    if (!scenes) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сказка не найдена' });
    return reply.send(scenes);
  });

  done();
};

export function registerScenesRoutes(app: FastifyInstance): void {
  app.register(scenesRoutes, { prefix: '/api/scenes' });
}
