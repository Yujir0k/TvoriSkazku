import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RedisClientType } from 'redis';

import { createSessionService } from './session.service.js';

type FakeRedis = {
  store: Map<string, string>;
  sets: Map<string, Set<string>>;
  ttls: Map<string, number>;
} & Record<string, unknown>;

function createFakeRedis(): FakeRedis {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();

  const fake = {
    store,
    sets,
    ttls,
    isOpen: true,
    async connect() {},
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, opts?: { EX?: number }) {
      store.set(key, value);
      if (opts?.EX) ttls.set(key, opts.EX);
      return 'OK';
    },
    async del(key: string) {
      const existed = store.has(key);
      store.delete(key);
      ttls.delete(key);
      return existed ? 1 : 0;
    },
    async sAdd(key: string, ...members: string[]) {
      if (!sets.has(key)) sets.set(key, new Set());
      const set = sets.get(key)!;
      let added = 0;
      for (const m of members) {
        if (!set.has(m)) {
          set.add(m);
          added++;
        }
      }
      return added;
    },
    async sRem(key: string, ...members: string[]) {
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const m of members) {
        if (set.delete(m)) removed++;
      }
      return removed;
    },
    async sMembers(key: string) {
      return Array.from(sets.get(key) ?? []);
    },
    async expire(key: string, seconds: number) {
      if (store.has(key) || sets.has(key)) {
        ttls.set(key, seconds);
        return 1;
      }
      return 0;
    },
    multi() {
      const ops: Array<() => Promise<unknown>> = [];
      const pipeline = {
        set(key: string, value: string, opts?: { EX?: number }) {
          ops.push(async () => {
            store.set(key, value);
            if (opts?.EX) ttls.set(key, opts.EX);
            return 'OK';
          });
          return pipeline;
        },
        get(key: string) {
          ops.push(async () => store.get(key) ?? null);
          return pipeline;
        },
        del(key: string) {
          ops.push(async () => {
            const existed = store.has(key);
            store.delete(key);
            ttls.delete(key);
            return existed ? 1 : 0;
          });
          return pipeline;
        },
        sAdd(key: string, ...members: string[]) {
          ops.push(async () => {
            if (!sets.has(key)) sets.set(key, new Set());
            const set = sets.get(key)!;
            let added = 0;
            for (const m of members) {
              if (!set.has(m)) {
                set.add(m);
                added++;
              }
            }
            return added;
          });
          return pipeline;
        },
        sRem(key: string, ...members: string[]) {
          ops.push(async () => {
            const set = sets.get(key);
            if (!set) return 0;
            let removed = 0;
            for (const m of members) {
              if (set.delete(m)) removed++;
            }
            return removed;
          });
          return pipeline;
        },
        expire(key: string, seconds: number) {
          ops.push(async () => {
            if (store.has(key) || sets.has(key)) {
              ttls.set(key, seconds);
              return 1;
            }
            return 0;
          });
          return pipeline;
        },
        async exec() {
          const results: unknown[] = [];
          for (const op of ops) {
            results.push(await op());
          }
          return results;
        },
      };
      return pipeline;
    },
  };

  return fake as unknown as FakeRedis;
}

describe('session service', () => {
  let fakeRedis: FakeRedis;
  let service: ReturnType<typeof createSessionService>;

  const options = {
    ttlSeconds: 3600,
    rollingTtlSeconds: 1800,
    sessionPrefix: 'sess:',
    userIndexPrefix: 'user-sess:',
  };

  beforeEach(() => {
    fakeRedis = createFakeRedis();
    service = createSessionService(
      fakeRedis as unknown as RedisClientType,
      options,
    );
  });

  it('создаёт сессию с уникальным ID', async () => {
    const s1 = await service.createSession('user-1');
    const s2 = await service.createSession('user-1');
    expect(s1.sessionId).not.toBe(s2.sessionId);
    expect(s1.userId).toBe('user-1');
  });

  it('сохраняет сессию в Redis с rolling TTL', async () => {
    const session = await service.createSession('user-1');
    expect(fakeRedis.store.has(`sess:${session.sessionId}`)).toBe(true);
    expect(fakeRedis.ttls.get(`sess:${session.sessionId}`)).toBe(1800);
  });

  it('добавляет session ID в индекс пользователя', async () => {
    const session = await service.createSession('user-1');
    const index = fakeRedis.sets.get(`user-sess:user-1`);
    expect(index?.has(session.sessionId)).toBe(true);
  });

  it('возвращает сессию по ID', async () => {
    const created = await service.createSession('user-1');
    const found = await service.getSession(created.sessionId);
    expect(found?.sessionId).toBe(created.sessionId);
    expect(found?.userId).toBe('user-1');
  });

  it('возвращает null для отсутствующей сессии', async () => {
    const found = await service.getSession('nonexistent');
    expect(found).toBeNull();
  });

  it('touchSession обновляет lastSeenAt и сбрасывает rolling TTL', async () => {
    const created = await service.createSession('user-1');
    await new Promise((r) => setTimeout(r, 10));
    const touched = await service.touchSession(created.sessionId);
    expect(touched?.lastSeenAt).toBeGreaterThan(created.lastSeenAt);
    // После create - rollingTtlSeconds (1800). После touch - тоже rollingTtlSeconds (1800)
    expect(fakeRedis.ttls.get(`sess:${created.sessionId}`)).toBe(1800);
  });

  it('touchSession возвращает null для отсутствующей сессии', async () => {
    const touched = await service.touchSession('nonexistent');
    expect(touched).toBeNull();
  });

  it('удаляет сессию и убирает из индекса', async () => {
    const session = await service.createSession('user-1');
    await service.deleteSession(session.sessionId);
    expect(fakeRedis.store.has(`sess:${session.sessionId}`)).toBe(false);
    expect(fakeRedis.sets.get(`user-sess:user-1`)?.has(session.sessionId)).toBe(false);
  });

  it('deleteSession не вызывает ошибку для отсутствующей сессии', async () => {
    await expect(service.deleteSession('nonexistent')).resolves.toBeUndefined();
  });

  it('deleteAllUserSessions удаляет все сессии пользователя', async () => {
    const s1 = await service.createSession('user-1');
    const s2 = await service.createSession('user-1');
    const s3 = await service.createSession('user-2');

    const deleted = await service.deleteAllUserSessions('user-1');
    expect(deleted).toHaveLength(2);
    expect(fakeRedis.store.has(`sess:${s1.sessionId}`)).toBe(false);
    expect(fakeRedis.store.has(`sess:${s2.sessionId}`)).toBe(false);
    expect(fakeRedis.store.has(`sess:${s3.sessionId}`)).toBe(true);
  });

  it('deleteAllUserSessions возвращает пустой массив для пользователя без сессий', async () => {
    const deleted = await service.deleteAllUserSessions('user-no-sessions');
    expect(deleted).toEqual([]);
  });

  it('getSession проверяет абсолютный TTL и удаляет просроченную сессию', async () => {
    const created = await service.createSession('user-1');
    // Симулируем истечение абсолютного TTL: ставим createdAt в прошлое
    const raw = JSON.parse(fakeRedis.store.get(`sess:${created.sessionId}`) || '{}');
    raw.createdAt = Date.now() - 7200 * 1000; // 2 часа назад (ttlSeconds=3600)
    fakeRedis.store.set(`sess:${created.sessionId}`, JSON.stringify(raw));
    const found = await service.getSession(created.sessionId);
    expect(found).toBeNull();
    // Сессия должна быть удалена
    expect(fakeRedis.store.has(`sess:${created.sessionId}`)).toBe(false);
  });

  it('getSession продлевает rolling TTL при активности', async () => {
    const created = await service.createSession('user-1');
    // Ставим lastSeenAt достаточно старым, чтобы сработал rolling-пропуск (> половины rollingTtlSeconds)
    const raw = JSON.parse(fakeRedis.store.get(`sess:${created.sessionId}`) || '{}');
    raw.lastSeenAt = Date.now() - 1200 * 1000; // 20 минут назад (половина 1800 = 900)
    fakeRedis.store.set(`sess:${created.sessionId}`, JSON.stringify(raw));
    const found = await service.getSession(created.sessionId);
    expect(found).not.toBeNull();
    if (found) {
      expect(found.lastSeenAt).toBeGreaterThan(raw.lastSeenAt);
    }
  });
});
