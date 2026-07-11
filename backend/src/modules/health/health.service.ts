import { prisma } from '../../lib/prisma.js';
import { pingRedis } from '../../lib/redis.js';

export type HealthCheckResult = {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
};

async function timeCheck(fn: () => Promise<void>): Promise<HealthCheckResult> {
  const startedAt = Date.now();

  try {
    await fn();
    return { status: 'ok', latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function buildHealthReport() {
  const [database, redis] = await Promise.all([
    timeCheck(() => prisma.$queryRaw`SELECT 1`),
    timeCheck(() => pingRedis()),
  ]);

  const checks = {
    backend: {
      status: 'ok' as const,
      latencyMs: 0,
    },
    database,
    redis,
  };

  const healthy = Object.values(checks).every((check) => check.status === 'ok');

  return {
    ok: healthy,
    checks,
    timestamp: new Date().toISOString(),
  };
}
