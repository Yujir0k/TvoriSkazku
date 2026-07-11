import fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';

import { env } from './config/env.js';
import { loggerOptions } from './config/logger.js';
import { registerHealthRoutes } from './modules/health/index.js';
import { registerAuthRoutes } from './modules/auth/index.js';
import { registerStoriesRoutes } from './modules/stories/index.js';
import { registerProfilesRoutes } from './modules/profiles/index.js';
import { registerCharactersRoutes } from './modules/characters/index.js';
import { registerTariffsRoutes } from './modules/tariffs/index.js';
import { registerScenesRoutes } from './modules/scenes/index.js';
import { registerIllustrationsRoutes } from './modules/illustrations/index.js';
import { registerBooksRoutes } from './modules/books/index.js';
import { registerTtsRoutes } from './modules/tts/index.js';

export function createApp() {
  const app = fastify({
    logger: loggerOptions,
  });

  const allowedOrigins = new Set(
    [
      env.FRONTEND_ORIGIN,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean),
  );

  app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.register(cookie, {
    secret: undefined,
  });

  app.register(rateLimit, {
    global: true,
    max: 600,
    timeWindow: '1 minute',
  });

  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');

    if (request.url.startsWith('/api/auth/')) {
      reply.header('Cache-Control', 'no-store');
    }

    return payload;
  });

  app.setErrorHandler((error: { statusCode?: number; message?: string }, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled application error');
      reply.code(500).send({
        message: 'Внутренняя ошибка сервера. Попробуйте позже.',
      });
      return;
    }

    reply.code(statusCode).send({
      message: error.message || 'Ошибка запроса',
    });
  });

  app.get('/api', async () => ({
    service: 'tvoriskazku-backend',
    status: 'ok',
  }));

  app.register(registerHealthRoutes, { prefix: '/api' });
  app.register(registerAuthRoutes);
  app.register(registerStoriesRoutes);
  app.register(registerProfilesRoutes);
  app.register(registerCharactersRoutes);
  app.register(registerTariffsRoutes);
  app.register(registerScenesRoutes);
  app.register(registerIllustrationsRoutes);
  app.register(registerBooksRoutes);
  app.register(registerTtsRoutes);

  return app;
}
