import type { User } from '@prisma/client';

export type SessionRecord = {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: string | null;
  createdAt: string;
};

export type SessionData = {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
};

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicUser(user: Pick<User, 'id' | 'name' | 'email' | 'emailVerifiedAt' | 'createdAt'>): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
