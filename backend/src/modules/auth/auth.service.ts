import { PrismaClient } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import { normalizeEmail, normalizeName } from './normalize.js';
import { passwordHasher, type PasswordHasher } from './password.service.js';
import { sessionService, type SessionService } from './session.service.js';
import { toPublicUser, type PublicUser } from './types.js';
import type { SessionRecord } from './session.service.js';
import { PrivacyConsentRequiredError } from '../../lib/privacy-consent.service.js';
import { PRIVACY_CONSENT_VERSION } from '../../lib/privacy-constants.js';

export type AuthDependencies = {
  db: PrismaClient;
  passwords: PasswordHasher;
  sessions: SessionService;
};

export type SignUpResult = {
  user: PublicUser;
  session: SessionRecord;
};

export type SignInResult = SignUpResult;

export const INVALID_CREDENTIALS_MESSAGE = 'Неверный email или пароль';
export const EMAIL_ALREADY_REGISTERED_MESSAGE = 'Пользователь с таким email уже зарегистрирован';

const defaultDependencies: AuthDependencies = {
  db: prisma,
  passwords: passwordHasher,
  sessions: sessionService,
};

export function createAuthService(deps: AuthDependencies = defaultDependencies) {
  return {
    async signUp(input: {
      name: string;
      email: string;
      password: string;
      privacyConsentAccepted?: boolean;
    }): Promise<SignUpResult> {
      if (!input.privacyConsentAccepted) {
        throw new PrivacyConsentRequiredError();
      }
      const name = normalizeName(input.name);
      const email = input.email.trim();
      const normalizedEmail = normalizeEmail(email);
      const passwordHash = await deps.passwords.hash(input.password);

      try {
        const result = await deps.db.$transaction(async (tx: any) => {
          const user = await tx.user.create({
            data: {
              name,
              email,
              normalizedEmail,
              passwordHash,
            },
          });

          await tx.privacyConsent.create({
            data: { userId: user.id, consentVersion: PRIVACY_CONSENT_VERSION },
          });

          return user;
        });

        const session = await deps.sessions.createSession(result.id);
        return {
          user: toPublicUser(result),
          session,
        };
      } catch (error) {
        const code = (error as Record<string, unknown> | null)?.code;
        if (code === 'P2002') {
          throw new EmailAlreadyRegisteredError();
        }
        throw error;
      }
    },

    async signIn(input: { email: string; password: string }): Promise<SignInResult> {
      const normalizedEmail = normalizeEmail(input.email);
      const user = await deps.db.user.findUnique({
        where: { normalizedEmail },
      });

      if (!user) {
        await deps.passwords.hash(input.password);
        throw new InvalidCredentialsError();
      }

      const valid = await deps.passwords.verify(user.passwordHash, input.password);
      if (!valid) {
        throw new InvalidCredentialsError();
      }

      const session = await deps.sessions.createSession(user.id);
      return {
        user: toPublicUser(user),
        session,
      };
    },

    async signOut(sessionId: string): Promise<void> {
      await deps.sessions.deleteSession(sessionId);
    },

    async signOutAll(userId: string): Promise<string[]> {
      return deps.sessions.deleteAllUserSessions(userId);
    },

    async getCurrentUser(userId: string): Promise<PublicUser | null> {
      const user = await deps.db.user.findUnique({ where: { id: userId } });
      if (!user) {
        return null;
      }
      return toPublicUser(user);
    },

    async updateName(userId: string, name: string): Promise<PublicUser> {
      const user = await deps.db.user.update({
        where: { id: userId },
        data: { name },
      });
      return toPublicUser(user);
    },

    async updatePassword(userId: string, newPassword: string): Promise<void> {
      const passwordHash = await deps.passwords.hash(newPassword);
      await deps.db.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
    },

    async deleteAccount(userId: string): Promise<void> {
      // 1. Delete all user files in MinIO (all categories)
      try {
        await storage.deleteAllUserObjects(userId);
      } catch {}

      // 2. Delete all Redis sessions
      await deps.sessions.deleteAllUserSessions(userId);

      // 3. Delete user (cascade removes stories, profiles, characters, etc.)
      await deps.db.user.delete({ where: { id: userId } });
    },
  };
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super(EMAIL_ALREADY_REGISTERED_MESSAGE);
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super(INVALID_CREDENTIALS_MESSAGE);
    this.name = 'InvalidCredentialsError';
  }
}

export const authService = createAuthService();
