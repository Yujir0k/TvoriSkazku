import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import { getConsentInfo } from './voice-consent.service.js';

const VOICE_UPLOAD_DISABLED_MESSAGE = 'Запись и загрузка пользовательского голоса отключены. Используйте готовые голоса рассказчиков.';

function disabledVoiceReply(reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) {
  return reply.code(410).send({
    statusCode: 410,
    error: 'Gone',
    message: VOICE_UPLOAD_DISABLED_MESSAGE,
  });
}

const voiceRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get('/consent-info', async (_request, reply) => {
    return reply.send(getConsentInfo());
  });

  app.get('/consent', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.post('/consent', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.post('/consent/revoke', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.get('/samples', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.get('/samples/:id', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.post('/samples', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.patch('/samples/:id', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.delete('/samples/:id', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));
  app.get('/samples/:id/audio-url', { preHandler: [requireAuth] }, async (_request, reply) => disabledVoiceReply(reply));

  done();
};

export function registerVoiceRoutes(app: FastifyInstance): void {
  app.register(voiceRoutes, { prefix: '/api/voice' });
}
