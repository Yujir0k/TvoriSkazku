import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';

import { prisma } from '../../lib/prisma.js';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TOKEN_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour

export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);

  await prisma.emailVerification.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });

  return raw;
}

export async function verifyEmailWithToken(rawToken: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(rawToken);

  const record = await prisma.emailVerification.findUnique({
    where: { tokenHash },
  });

  if (!record) return null;
  if (record.expiresAt < new Date()) return null;

  // Mark email as verified and delete the token
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerification.deleteMany({
      where: { id: record.id },
    }),
  ]);

  return { userId: record.userId };
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);

  await prisma.passwordReset.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    },
  });

  return raw;
}

export async function verifyPasswordResetToken(rawToken: string): Promise<{ userId: string; id: string } | null> {
  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordReset.findUnique({
    where: { tokenHash },
  });

  if (!record) return null;
  if (record.expiresAt < new Date()) return null;
  if (record.usedAt) return null;

  return { userId: record.userId, id: record.id };
}

export async function markPasswordResetUsed(id: string): Promise<void> {
  await prisma.passwordReset.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}

export async function deleteExpiredEmailVerifications(): Promise<void> {
  await prisma.emailVerification.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export async function deleteExpiredPasswordResets(): Promise<void> {
  await prisma.passwordReset.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
