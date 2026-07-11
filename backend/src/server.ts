import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { redis, connectRedis } from './lib/redis.js';
import { storage } from './lib/storage.js';
import { createApp } from './app.js';
import { startWorker } from './modules/stories/index.js';
import { startTtsWorker, stopTtsWorker } from './modules/tts/index.js';

async function start() {
  const app = createApp();

  try {
    await connectRedis();
    await storage.ensureBucket();
    startWorker();
    startTtsWorker();
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ host: env.HOST, port: env.PORT }, 'Backend started');
  } catch (error) {
    app.log.error(error, 'Failed to start backend');
    process.exitCode = 1;
  }

  const shutdown = async () => {
    try {
      await stopTtsWorker();
      await app.close();
      await prisma.$disconnect();
      if (redis.isOpen) {
        await redis.quit();
      }
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
