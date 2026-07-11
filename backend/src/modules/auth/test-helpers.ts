import type { PasswordHasher } from './password.service.js';
import type { SessionService, SessionRecord } from './session.service.js';

export type FakeUserRecord = {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createFakePasswordHasher(): PasswordHasher & {
  hashes: Map<string, string>;
} {
  const hashes = new Map<string, string>();
  return {
    hashes,
    async hash(password: string): Promise<string> {
      const hash = `fake-hash:${password}:${Math.random().toString(36).slice(2)}`;
      hashes.set(hash, password);
      return hash;
    },
    async verify(hash: string, password: string): Promise<boolean> {
      return hashes.get(hash) === password;
    },
  };
}

export function createFakeSessionService(): SessionService & {
  sessions: Map<string, SessionRecord>;
  userIndex: Map<string, Set<string>>;
} {
  const sessions = new Map<string, SessionRecord>();
  const userIndex = new Map<string, Set<string>>();

  return {
    sessions,
    userIndex,
    async createSession(userId: string): Promise<SessionRecord> {
      const sessionId = `sess-${Math.random().toString(36).slice(2)}`;
      const now = Date.now();
      const record: SessionRecord = {
        sessionId,
        userId,
        createdAt: now,
        lastSeenAt: now,
      };
      sessions.set(sessionId, record);
      if (!userIndex.has(userId)) {
        userIndex.set(userId, new Set());
      }
      userIndex.get(userId)!.add(sessionId);
      return record;
    },
    async getSession(sessionId: string): Promise<SessionRecord | null> {
      return sessions.get(sessionId) ?? null;
    },
    async touchSession(sessionId: string): Promise<SessionRecord | null> {
      const record = sessions.get(sessionId);
      if (!record) return null;
      const updated = { ...record, lastSeenAt: Date.now() };
      sessions.set(sessionId, updated);
      return updated;
    },
    async deleteSession(sessionId: string): Promise<void> {
      const record = sessions.get(sessionId);
      if (record) {
        userIndex.get(record.userId)?.delete(sessionId);
      }
      sessions.delete(sessionId);
    },
    async deleteAllUserSessions(userId: string): Promise<string[]> {
      const ids = Array.from(userIndex.get(userId) ?? []);
      for (const id of ids) {
        sessions.delete(id);
      }
      userIndex.delete(userId);
      return ids;
    },
    async getUserSessions(userId: string): Promise<Array<{ sessionId: string; createdAt: number; lastSeenAt: number }>> {
      const ids = Array.from(userIndex.get(userId) ?? []);
      return Array.from(sessions.entries())
        .filter(([id]) => ids.includes(id))
        .map(([sessionId, rec]) => ({
          sessionId: rec.sessionId,
          createdAt: rec.createdAt,
          lastSeenAt: rec.lastSeenAt,
        }));
    },
  };
}

export function createFakeDb(users: FakeUserRecord[] = []) {
  const store = new Map<string, FakeUserRecord>();
  const normalizedIndex = new Map<string, string>();
  let idCounter = 0;

  for (const user of users) {
    store.set(user.id, user);
    normalizedIndex.set(user.normalizedEmail, user.id);
  }

  return {
    store,
    normalizedIndex,
    user: {
      async create({ data }: { data: Omit<FakeUserRecord, 'id' | 'createdAt' | 'updatedAt'> }) {
        if (normalizedIndex.has(data.normalizedEmail)) {
          const error = new Error('Unique constraint failed') as Error & {
            code: string;
            clientVersion: string;
          };
          error.code = 'P2002';
          error.clientVersion = 'test';
          throw error;
        }
        idCounter += 1;
        const now = new Date();
        const user: FakeUserRecord = {
          ...data,
          id: `user-${idCounter}`,
          createdAt: now,
          updatedAt: now,
        };
        store.set(user.id, user);
        normalizedIndex.set(user.normalizedEmail, user.id);
        return user;
      },
      async findUnique({ where }: { where: { id?: string; normalizedEmail?: string } }) {
        if (where.id) return store.get(where.id) ?? null;
        if (where.normalizedEmail) {
          const id = normalizedIndex.get(where.normalizedEmail);
          return id ? store.get(id) ?? null : null;
        }
        return null;
      },
    },
  };
}

export function toPrismaLike(fakeDb: ReturnType<typeof createFakeDb>) {
  const consentStore = new Map<string, { userId: string; consentVersion: string; acceptedAt: Date }>();

  // Создаём фейковый tx-клиент с теми же методами
  const createTx = () => ({
    user: fakeDb.user,
    privacyConsent: {
      async create({ data }: { data: { userId: string; consentVersion: string } }) {
        const record = { ...data, acceptedAt: new Date() };
        const key = data.userId + '__' + data.consentVersion;
        consentStore.set(key, record);
        return record;
      },
    },
  });

  return {
    user: fakeDb.user,
    privacyConsent: createTx().privacyConsent,
    $transaction: async (arg: unknown) => {
      // Interactive transaction: $transaction(callback) => callback(tx)
      if (typeof arg === 'function') {
        return (arg as (tx: Record<string, unknown>) => unknown)(createTx() as any);
      }
      return [];
    },
  } as unknown as import('@prisma/client').PrismaClient;
}
