import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { sessionService } from './session.service.js';
import type { AuthenticatedUser } from './types.js';

export const SESSION_COOKIE_NAME = env.SESSION_COOKIE_NAME;

export type AuthContext = {
  user: AuthenticatedUser;
  sessionId: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext | null;
  }
}

export async function loadAuthContext(request: FastifyRequest): Promise<AuthContext | null> {
  const sessionId = request.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return null;
  }

  const record = await sessionService.getSession(sessionId);
  if (!record) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    return null;
  }

  return {
    sessionId: record.sessionId,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      normalizedEmail: user.normalizedEmail,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const context = await loadAuthContext(request);
  if (!context) {
    clearSessionCookie(reply);
    await reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Требуется авторизация',
    });
    return;
  }
  request.auth = context;
}

export function registerAuthHook(app: FastifyInstance): void {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.auth = null;
  });
}

export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: env.SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  });
}
