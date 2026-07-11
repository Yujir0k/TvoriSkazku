import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import { getPlans, getSubscriptionSummary } from './tariffs.service.js';

const tariffsRoutes: FastifyPluginCallback = (app, _options, done) => {
  // GET /api/tariffs — список тарифов
  app.get('/', async (_request, reply) => {
    const plans = getPlans();
    return reply.send(plans);
  });

  // GET /api/tariffs/me — текущий тариф и лимиты пользователя
  app.get('/me', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const context = request.auth!;
    const summary = await getSubscriptionSummary(context.user.id);
    return reply.send(summary);
  });

  done();
};

export function registerTariffsRoutes(app: FastifyInstance): void {
  app.register(tariffsRoutes, { prefix: '/api/tariffs' });
}
