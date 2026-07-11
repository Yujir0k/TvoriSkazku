import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { authService, EmailAlreadyRegisteredError, InvalidCredentialsError } from './auth.service.js';
import { PrivacyConsentRequiredError, getConsentInfo, hasAcceptedLatestConsent, acceptPrivacyConsent } from '../../lib/privacy-consent.service.js';
import { passwordHasher } from './password.service.js';
import { normalizeEmail, normalizeName } from './normalize.js';
import { signInSchema, signUpSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema, updateAccountSchema } from './auth.schema.js';
import {
  clearSessionCookie,
  loadAuthContext,
  requireAuth,
  setSessionCookie,
} from './auth.middleware.js';
import { sessionService } from './session.service.js';
import { createEmailVerificationToken, verifyEmailWithToken, createPasswordResetToken, verifyPasswordResetToken, markPasswordResetUsed, deleteExpiredEmailVerifications } from '../mailer/token.service.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from '../mailer/mail.service.js';

export const authRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post('/sign-up', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = signUpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    try {
      const result = await authService.signUp(parsed.data);
      setSessionCookie(reply, result.session.sessionId);

      // Отправка письма подтверждения не блокирует ответ
      Promise.resolve().then(async () => {
        try {
          const token = await createEmailVerificationToken(result.user.id);
          await sendVerificationEmail(result.user.email, token, result.user.name);
        } catch (err) {
          request.log.warn({ err, userId: result.user.id }, 'Не удалось отправить письмо подтверждения');
        }
      }).catch(() => {});

      return reply.code(201).send({ user: result.user });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: error.message,
        });
      }
      if (error instanceof PrivacyConsentRequiredError) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: error.message,
        });
      }
      request.log.error({ err: error }, 'Sign-up failed');
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Не удалось зарегистрировать пользователя',
      });
    }
  });

  app.post('/sign-in', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = signInSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    try {
      const result = await authService.signIn(parsed.data);
      setSessionCookie(reply, result.session.sessionId);
      return reply.send({ user: result.user });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: error.message,
        });
      }
      request.log.error({ err: error }, 'Sign-in failed');
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Не удалось выполнить вход',
      });
    }
  });

  app.post('/sign-out', async (request, reply) => {
    const context = await loadAuthContext(request);
    if (context) {
      await authService.signOut(context.sessionId);
    }
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.post('/sign-out-all', { preHandler: [requireAuth] }, async (request, reply) => {
    const context = request.auth!;
    await authService.signOutAll(context.user.id);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get('/me', async (request, reply) => {
    const context = await loadAuthContext(request);
    if (!context) {
      if (request.cookies?.[env.SESSION_COOKIE_NAME]) {
        clearSessionCookie(reply);
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Требуется авторизация',
        });
      }
      return reply.send({ user: null });
    }

    const user = await authService.getCurrentUser(context.user.id);
    if (!user) {
      clearSessionCookie(reply);
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Требуется авторизация',
      });
    }
    return reply.send({ user });
  });

  // Verify email with token
  app.post('/verify-email', async (request, reply) => {
    const parsed = verifyEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректный токен',
      });
    }

    const result = await verifyEmailWithToken(parsed.data.token);
    if (!result) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Недействительный или просроченный токен',
      });
    }

    return reply.send({ message: 'Email успешно подтверждён' });
  });

  // Resend verification email
  app.post('/resend-verification', {
    preHandler: [requireAuth],
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '5 minutes',
      },
    },
  }, async (request, reply) => {
    const context = request.auth!;

    if (context.user.emailVerifiedAt) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Email уже подтверждён',
      });
    }

    // Отзываем старые токены
    await deleteExpiredEmailVerifications();
    // Удаляем все старые токены этого пользователя
    await prisma.emailVerification.deleteMany({ where: { userId: context.user.id } });

    const token = await createEmailVerificationToken(context.user.id);
    await sendVerificationEmail(context.user.email, token, context.user.name);

    return reply.send({ message: 'Письмо отправлено' });
  });

  // Forgot password
  app.post('/forgot-password', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Некорректный email',
      });
    }

    // Всегда возвращаем успех для защиты от перебора email
    try {
      const normalizedEmail = normalizeEmail(parsed.data.email);
      const user = await prisma.user.findUnique({ where: { normalizedEmail } });

      if (user) {
        // Отзываем старые reset-токены
        await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });

        const token = await createPasswordResetToken(user.id);
        await sendPasswordResetEmail(user.email, token, user.name);
      }
    } catch (err) {
      request.log.error({ err }, 'Forgot password processing failed');
    }

    return reply.send({ message: 'Если пользователь с таким email существует, письмо отправлено' });
  });

  // Reset password with token
  app.post('/reset-password', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    const verification = await verifyPasswordResetToken(parsed.data.token);
    if (!verification) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Недействительный или просроченный токен',
      });
    }

    // Атомарно: пароль + пометка токена + инвалидация сессий в одной Prisma-транзакции
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verification.userId },
        data: { passwordHash: await passwordHasher.hash(parsed.data.password) },
      }),
      prisma.passwordReset.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Invalidate all sessions for security
    await authService.signOutAll(verification.userId);

    // Send notification
    try {
      const user = await prisma.user.findUnique({ where: { id: verification.userId } });
      if (user) {
        await sendPasswordChangedEmail(user.email, user.name);
      }
    } catch (err) {
      request.log.error({ err }, 'Failed to send password changed email');
    }

    return reply.send({ message: 'Пароль успешно изменён' });
  });

  // Update account (name)
  app.patch('/account', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = updateAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Некорректные данные',
      });
    }

    const context = request.auth!;
    const name = parsed.data.name ? normalizeName(parsed.data.name) : undefined;

    if (!name) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Имя обязательно',
      });
    }

    const user = await authService.updateName(context.user.id, name);
    return reply.send({ user });
  });

  // List all sessions for current user
  app.get('/sessions', { preHandler: [requireAuth] }, async (request, reply) => {
    const context = request.auth!;
    const sessions = await sessionService.getUserSessions(context.user.id);
    return reply.send({ sessions });
  });

  // Delete a specific session
  app.delete('/sessions/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const context = request.auth!;
    const { id } = request.params as { id: string };

    const record = await sessionService.getSession(id);
    if (!record) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Сессия не найдена',
      });
    }

    // Проверяем, что сессия принадлежит текущему пользователю
    if (record.userId !== context.user.id) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Нельзя удалить чужую сессию',
      });
    }

    await sessionService.deleteSession(id);

    // Если удалили текущую сессию — чистим cookie
    if (id === context.sessionId) {
      clearSessionCookie(reply);
    }

    return reply.code(204).send();
  });
  // Delete account
  app.delete('/account', { preHandler: [requireAuth] }, async (request, reply) => {
    const context = request.auth!;

    // Сначала удаляем файлы пользователя из MinIO
    await authService.deleteAccount(context.user.id);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  // GET /api/auth/privacy-consent — информация о согласии
  app.get('/privacy-consent', async (_request, reply) => {
    return reply.send(getConsentInfo());
  });

  // GET /api/auth/privacy-consent/status — принял ли пользователь согласие
  app.get('/privacy-consent/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const context = request.auth!;
    const accepted = await hasAcceptedLatestConsent(context.user.id);
    return reply.send({ accepted });
  });

  // POST /api/auth/privacy-consent/accept — принять согласие
  app.post('/privacy-consent/accept', { preHandler: [requireAuth] }, async (request, reply) => {
    const context = request.auth!;
    await acceptPrivacyConsent(context.user.id);
    return reply.send({ accepted: true });
  });

  done();
};

export function registerAuthRoutes(app: FastifyInstance): void {
  app.register(authRoutes, { prefix: '/api/auth' });
}

export { requireAuth, setSessionCookie, clearSessionCookie };

export const SESSION_TTL_SECONDS = env.SESSION_TTL_SECONDS;
