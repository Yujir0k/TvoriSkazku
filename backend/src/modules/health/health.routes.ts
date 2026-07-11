import type { FastifyInstance } from 'fastify';

import { buildHealthReport } from './health.service.js';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const report = await buildHealthReport();

    if (!report.ok) {
      return reply.code(503).send(report);
    }

    return reply.send(report);
  });
}
