import { randomBytes } from 'node:crypto';

import type { RedisClientType } from 'redis';

import { env } from '../../config/env.js';
import { redis } from '../../lib/redis.js';

export type SessionRecord = {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
};

export type SessionServiceOptions = {
  ttlSeconds: number;
  rollingTtlSeconds: number;
  sessionPrefix: string;
  userIndexPrefix: string;
};

export type SessionService = {
  createSession(userId: string): Promise<SessionRecord>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  touchSession(sessionId: string): Promise<SessionRecord | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteAllUserSessions(userId: string): Promise<string[]>;
  getUserSessions(userId: string): Promise<Array<{ sessionId: string; createdAt: number; lastSeenAt: number }>>;
};

const DEFAULT_OPTIONS: SessionServiceOptions = {
  ttlSeconds: env.SESSION_TTL_SECONDS,
  rollingTtlSeconds: env.SESSION_ROLLING_TTL,
  sessionPrefix: env.SESSION_REDIS_PREFIX,
  userIndexPrefix: env.SESSION_USER_INDEX_PREFIX,
};

function sessionKey(prefix: string, sessionId: string): string {
  return `${prefix}${sessionId}`;
}

function userIndexKey(prefix: string, userId: string): string {
  return `${prefix}${userId}`;
}

function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function createSessionService(
  redis: RedisClientType,
  options: SessionServiceOptions = DEFAULT_OPTIONS,
): SessionService {
  return {
    async createSession(userId: string): Promise<SessionRecord> {
      await ensureConnected(redis);
      const sessionId = generateSessionId();
      const now = Date.now();
      const record: SessionRecord = {
        sessionId,
        userId,
        createdAt: now,
        lastSeenAt: now,
      };
      const key = sessionKey(options.sessionPrefix, sessionId);
      const indexKey = userIndexKey(options.userIndexPrefix, userId);

      const pipeline = redis.multi();
      pipeline.set(key, JSON.stringify(record), {
        EX: options.rollingTtlSeconds,
      });
      pipeline.sAdd(indexKey, sessionId);
      pipeline.expire(indexKey, options.rollingTtlSeconds);
      await pipeline.exec();

      return record;
    },

    async getSession(sessionId: string): Promise<SessionRecord | null> {
      await ensureConnected(redis);
      const key = sessionKey(options.sessionPrefix, sessionId);
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }
      const record = parseRecord(raw, sessionId);
      // Проверяем абсолютный максимум времени жизни сессии
      if (Date.now() - record.createdAt > options.ttlSeconds * 1000) {
        // Сессия истекла по абсолютному TTL — удаляем
        await this.deleteSession(sessionId);
        return null;
      }
      // Rolling TTL: продлеваем, если прошло больше половины rolling-периода
      const age = Date.now() - record.lastSeenAt;
      if (age > (options.rollingTtlSeconds * 1000) / 2) {
        return this.touchSession(sessionId);
      }
      return record;
    },

    async touchSession(sessionId: string): Promise<SessionRecord | null> {
      await ensureConnected(redis);
      const key = sessionKey(options.sessionPrefix, sessionId);
      const raw = await redis.get(key);
      if (!raw) {
        return null;
      }
      const record = parseRecord(raw, sessionId);
      // Проверяем абсолютный максимум
      if (Date.now() - record.createdAt > options.ttlSeconds * 1000) {
        await this.deleteSession(sessionId);
        return null;
      }
      const updated: SessionRecord = {
        ...record,
        lastSeenAt: Date.now(),
      };
      const indexKey = userIndexKey(options.userIndexPrefix, record.userId);
      const pipeline = redis.multi();
      pipeline.set(key, JSON.stringify(updated), {
        EX: options.rollingTtlSeconds,
      });
      pipeline.expire(indexKey, options.rollingTtlSeconds);
      await pipeline.exec();

      return updated;
    },

    async deleteSession(sessionId: string): Promise<void> {
      await ensureConnected(redis);
      const key = sessionKey(options.sessionPrefix, sessionId);
      const raw = await redis.get(key);
      if (raw) {
        const record = parseRecord(raw, sessionId);
        const indexKey = userIndexKey(options.userIndexPrefix, record.userId);
        const pipeline = redis.multi();
        pipeline.del(key);
        pipeline.sRem(indexKey, sessionId);
        await pipeline.exec();
      } else {
        await redis.del(key);
      }
    },

    async deleteAllUserSessions(userId: string): Promise<string[]> {
      await ensureConnected(redis);
      const indexKey = userIndexKey(options.userIndexPrefix, userId);
      const sessionIds = await redis.sMembers(indexKey);
      if (sessionIds.length === 0) {
        return [];
      }
      const pipeline = redis.multi();
      for (const sessionId of sessionIds) {
        pipeline.del(sessionKey(options.sessionPrefix, sessionId));
      }
      pipeline.del(indexKey);
      await pipeline.exec();
      return sessionIds;
    },

    async getUserSessions(userId: string): Promise<Array<{ sessionId: string; createdAt: number; lastSeenAt: number }>> {
      await ensureConnected(redis);
      const indexKey = userIndexKey(options.userIndexPrefix, userId);
      const sessionIds = await redis.sMembers(indexKey);
      const result: Array<{ sessionId: string; createdAt: number; lastSeenAt: number }> = [];
      for (const sessionId of sessionIds) {
        const raw = await redis.get(sessionKey(options.sessionPrefix, sessionId));
        if (raw) {
          try {
            const record = JSON.parse(raw);
            result.push({
              sessionId: record.sessionId || sessionId,
              createdAt: record.createdAt,
              lastSeenAt: record.lastSeenAt,
            });
          } catch {
            // skip invalid records
          }
        }
      }
      return result;
    },
  };
}

async function ensureConnected(redis: RedisClientType): Promise<void> {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

function parseRecord(raw: string, sessionId: string): SessionRecord {
  const parsed = JSON.parse(raw) as SessionRecord;
  return {
    ...parsed,
    sessionId,
  };
}

export const sessionService = createSessionService(
  redis as unknown as RedisClientType,
);
