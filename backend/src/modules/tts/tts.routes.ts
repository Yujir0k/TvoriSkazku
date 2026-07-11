import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { requireAuth } from '../auth/auth.middleware.js';
import { env } from '../../config/env.js';
import { z } from 'zod';
import { listVoices, textToSpeech, DEFAULT_VOICE_ID, VOICE_CATALOG } from './elevenlabs.provider.js';
import { checkLimit } from '../tariffs/tariffs.service.js';
import { prisma } from '../../lib/prisma.js';
import { deleteFile } from '../../lib/file-helper.js';
import { createTtsJob, cancelTtsJobInQueue } from './tts.queue.js';
import { storage } from '../../lib/storage.js';
import { assertSafeForExternalAi, PERSONAL_DATA_BLOCK_MESSAGE } from '../../lib/personal-data-filter.js';


const PREVIEW_CACHE_VERSION = 'ru-v4-short';

/**
 * Парсит personalizationNames из Story (JSON-строка) в массив строк.
 */
function parsePersonalizationNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((n): n is string => typeof n === 'string' && n.trim().length >= 2);
    }
    return [];
  } catch {
    return [];
  }
}

export const RUSSIAN_VOICE_PREVIEW_TEXT_BY_ID: Record<string, string> = {
  TX3LPaxmHKxFdv7VOQHJ: 'Привет, мечтатель. Я добрый рассказчик. Сейчас мы откроем волшебную книгу и отправимся в сказку, где чудеса ждут за каждой страницей.',
  ZHIn0jcgR6VIvVAXkwWV: 'Здравствуй, маленький путешественник. Я поведу тебя спокойным голосом туда, где светятся тропинки и начинается доброе приключение.',
  NQJnREzQtnAHHZnia0tY: 'Садись поближе, мой друг. Мудрый дедушка расскажет тихую сказку о смелом огоньке, который нашёл дорогу домой.',
  GquPFn9xormgmHaJ2KdN: 'Привет, маленький друг. Я добрый медведь. Пойдём по лесной тропинке искать мёд, звёзды и большое тёплое чудо.',
  ymDCYd8puC7gYjxIamPt: 'Здравствуй, солнышко. Бабушка укроет сказку тёплым пледом, и за окном мягко зашепчут добрые звёзды.',
  hLjwV7lYzk15SWLUmhEH: 'Тише, слушай внимательно. Я открою тайную дверь в лунный лес, где каждое эхо хранит маленькое волшебство.',
  GN4wbsbejSnGSa1AzjH5: 'Привет, маленький волшебник. Я добрая феечка. Взмахну палочкой, и твоя сказка засияет искорками чудес.',
  q22qntNqQAvTaBoqE089: 'Добро пожаловать в сказку. Я мягко проведу историю от первой строки до счастливого финала, где добро обязательно победит.',
};

export function getRussianVoicePreviewText(voiceId: string): string {
  return RUSSIAN_VOICE_PREVIEW_TEXT_BY_ID[voiceId] || RUSSIAN_VOICE_PREVIEW_TEXT_BY_ID[DEFAULT_VOICE_ID];
}

const previewGeneration = new Map<string, Promise<Buffer>>();

async function getRussianVoicePreview(voiceId: string): Promise<Buffer> {
  const existing = previewGeneration.get(voiceId);
  if (existing) return existing;

  const generation = (async () => {
    const result = await textToSpeech(getRussianVoicePreviewText(voiceId), voiceId, false, {
      modelId: 'eleven_multilingual_v2',
    });
    const cacheKey = `system/voice-previews/${PREVIEW_CACHE_VERSION}-${voiceId}.mp3`;
    await storage.putObject(cacheKey, result.audioBuffer, 'audio/mpeg').catch(() => {});
    return result.audioBuffer;
  })();

  previewGeneration.set(voiceId, generation);
  try {
    return await generation;
  } finally {
    previewGeneration.delete(voiceId);
  }
}

function publicTtsError(message: string): string {
  if (message.includes('текущего IP или региона') || message.includes('ELEVENLABS_REGION_BLOCKED')) {
    return 'Сервис озвучки недоступен с текущего региона (HTTP 403). Попробуйте позже.';
  }
  if (message.includes('ElevenLabs API error 401')) {
    return 'Сервис озвучки отклонил запрос. Проверьте настройки подключения.';
  }
  if (message.includes('ElevenLabs API error 402')) {
    return 'Выбранный голос недоступен на текущем тарифе сервиса озвучки. Выберите другой голос или обновите тариф подключения.';
  }
  if (message.includes('ElevenLabs API error')) {
    return 'Ошибка сервиса озвучки. Попробуйте позже.';
  }
  return message.slice(0, 200);
}

/**
 * Собирает известные имена ребёнка и персонажей для очистки текста
 * перед отправкой на зарубежный TTS relay.
 *
 * Источники (в порядке приоритета):
 * 1. storyNames — из personalizationNames, сохранённых при генерации истории
 * 2. characterVoices — ключи (имена персонажей для voice mapping)
 * 3. childProfiles пользователя — fallback
 */
async function collectNamesForTtsSanitization(
  userId: string,
  characterVoices?: Record<string, string>,
  storyNames: string[] = [],
): Promise<string[]> {
  const names = new Set<string>();

  // 1. Имена из personalizationNames (самые точные — привязаны к этой истории)
  for (const name of storyNames) {
    if (name && name.trim().length >= 2) names.add(name.trim());
  }

  // 2. Имена из characterVoices — ключи это имена персонажей
  if (characterVoices) {
    for (const name of Object.keys(characterVoices)) {
      if (name && name.trim().length >= 2) names.add(name.trim());
    }
  }

  // 3. Имена из childProfiles пользователя (fallback)
  try {
    const profiles = await prisma.childProfile.findMany({
      where: { userId },
      select: { name: true },
    });
    for (const profile of profiles) {
      if (profile.name && profile.name.trim().length >= 2) {
        names.add(profile.name.trim());
      }
    }
  } catch {
    // Если БД недоступна, используем то, что есть
  }

  return Array.from(names);
}

const ttsRoutes: FastifyPluginCallback = (app, _options, done) => {
  // GET /api/tts/voices
  app.get('/voices', async (_request, reply) => {
    try {
      return reply.send(await listVoices());
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number; code?: string };
      const statusCode = e.statusCode || 503;
      const providerError = e.code?.startsWith('ELEVENLABS_');
      return reply.code(e.statusCode || 503).send({
        statusCode,
        error: 'Service Unavailable',
        message: providerError
          ? 'Не удалось получить каталог голосов. Проверьте настройки подключения и доступность сервиса.'
          : 'Сервис озвучки временно недоступен. Попробуйте позже.',
        code: e.code || 'TTS_ERROR',
      });
    }
  });

  // GET /api/tts/voices/:voiceId/preview — русское демо, одинаковое для честного сравнения голосов.
  // Результат сохраняется в MinIO и повторно не расходует лимит провайдера.
  app.get('/voices/:voiceId/preview', async (request, reply) => {
    const { voiceId } = request.params as { voiceId: string };
    const voice = VOICE_CATALOG.find((item) => item.voiceId === voiceId);
    if (!voice) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Демо голоса не найдено' });
    }

    try {
      const cacheKey = `system/voice-previews/${PREVIEW_CACHE_VERSION}-${voiceId}.mp3`;
      if (await storage.exists(cacheKey)) {
        const cached = await storage.getObject(cacheKey);
        return reply
          .header('Content-Type', 'audio/mpeg')
          .header('Content-Length', String(cached.size))
          .header('Cache-Control', 'public, max-age=31536000, immutable')
          .send(cached.stream);
      }

      const audio = await getRussianVoicePreview(voiceId);
      return reply
        .header('Content-Type', 'audio/mpeg')
        .header('Content-Length', String(audio.length))
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(audio);
    } catch (error) {
      const publicMessage = error instanceof Error ? publicTtsError(error.message) : 'Не удалось создать русское демо голоса';
      return reply.code(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: publicMessage,
      });
    }
  });

  // GET /api/tts/status
  app.get('/status', async (_request, reply) => {
    const hasDirectKey = !!env.ELEVENLABS_API_KEY;
    const foreignEnabled = !!env.FOREIGN_TTS_ENABLED;
    const foreignUrl = !!env.FOREIGN_TTS_RELAY_URL;
    const foreignSecret = !!env.FOREIGN_TTS_RELAY_SECRET;
    const foreignFullyConfigured = foreignEnabled && foreignUrl && foreignSecret;

    if (foreignEnabled && !(foreignUrl && foreignSecret)) {
      return reply.send({
        configured: false,
        mode: 'foreign_incomplete',
        model: null,
        message: 'Озвучка через внешний relay включена, но не указаны FOREIGN_TTS_RELAY_URL и/или FOREIGN_TTS_RELAY_SECRET',
        defaultVoice: null,
      });
    }

    const configured = foreignFullyConfigured || hasDirectKey;
    const mode = foreignFullyConfigured ? 'foreign_relay' : (hasDirectKey ? 'direct' : 'none');
    return reply.send({
      configured,
      mode,
      model: configured ? env.ELEVENLABS_MODEL_ID : null,
      message: configured
        ? (foreignFullyConfigured ? 'Озвучка через внешний relay' : 'Сервис озвучки подключён')
        : 'Озвучка не настроена',
      defaultVoice: configured ? DEFAULT_VOICE_ID : null,
    });
  });

  // POST /api/tts/stories/:storyId/audio — запустить озвучку
  app.post('/stories/:storyId/audio', { preHandler: [requireAuth] }, async (request, reply) => {
    const { storyId } = request.params as { storyId: string };
    const userId = request.auth!.user.id;

    const bodySchema = z.object({
      voiceId: z.string().min(1).optional().default(DEFAULT_VOICE_ID),
      mode: z.enum(['single', 'dialogue']).optional().default('single'),
      expressive: z.boolean().optional().default(true),
      characterVoices: z.record(z.string(), z.string()).optional(),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Неверные параметры' });
    }
    const { voiceId, mode, expressive, characterVoices } = parsed.data;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.userId !== userId) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сказка не найдена' });
    }
    if (!story.content) {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'У сказки нет текста' });
    }
    const ttsConfigured = Boolean(env.ELEVENLABS_API_KEY) || (Boolean(env.FOREIGN_TTS_ENABLED) && Boolean(env.FOREIGN_TTS_RELAY_URL) && Boolean(env.FOREIGN_TTS_RELAY_SECRET));
    if (!ttsConfigured) {
      return reply.code(503).send({ statusCode: 503, error: 'Service Unavailable', message: 'TTS не настроен' });
    }

    // Fail-safe: если FOREIGN_TTS_ENABLED, проверяем, что личные данные известны
    if (env.FOREIGN_TTS_ENABLED) {
      if (story.ttsPrivacyStatus === 'unknown') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Невозможно гарантировать безопасность персональных данных для этой сказки при текущей схеме озвучки.',
        });
      }
      if (!story.personalizationNames && env.FOREIGN_TTS_ENABLED) {
        // История без personalizationNames. Если она не была создана через генерацию — это OK.
        // Если была — могли потерять данные. Блокируем только если есть признаки персонализации.
        // Для manually created stories (без childName/профиля) — пропускаем.
      }
    }
    try {
      assertSafeForExternalAi(story.title, story.content, characterVoices ? Object.keys(characterVoices).join('\n') : '');
    } catch (error) {
      if (error instanceof Error && error.name === 'PersonalDataError') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: PERSONAL_DATA_BLOCK_MESSAGE,
        });
      }
      throw error;
    }

    const existing = await prisma.storyAudio.findFirst({
      where: { storyId, status: { in: ['queued', 'processing'] } },
    });
    if (existing) {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'Озвучка уже создаётся' });
    }

    const { allowed } = await checkLimit(userId, 'audioGenerations');
    if (!allowed) {
      return reply.code(429).send({ statusCode: 429, error: 'Too Many Requests', message: 'Лимит бесплатной озвучки исчерпан' });
    }

    const audio = await prisma.storyAudio.create({
      data: {
        storyId, userId, voiceId,
        provider: 'elevenlabs', status: 'queued',
        progress: 1,
        mimeType: 'audio/mpeg', mode, expressive,
        characterVoices: characterVoices ? JSON.stringify(characterVoices) : null,
      },
    });

    // Собираем известные имена для очистки в foreign TTS:
    // 1. Из personalizationNames, сохранённых при генерации истории
    // 2. Из childProfiles пользователя (fallback)
    // 3. Из characterVoices keys
    const storyNames = parsePersonalizationNames(story.personalizationNames);
    const namesToRemove = await collectNamesForTtsSanitization(userId, characterVoices, storyNames);

    let jobId: string;
    try {
      jobId = await createTtsJob({
        audioId: audio.id,
        userId,
        storyId: story.id,
        voiceId,
        mode,
        expressive,
        characterVoices,
        namesToRemove: namesToRemove.length > 0 ? namesToRemove : undefined,
      });
    } catch {
      await prisma.storyAudio.delete({ where: { id: audio.id } }).catch(() => {});
      return reply.code(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Не удалось создать задачу озвучки' });
    }

    // The database link is required for reliable cancellation and recovery.
    try {
      await prisma.storyAudio.update({
        where: { id: audio.id },
        data: { jobId },
      });
    } catch {
      await cancelTtsJobInQueue(jobId).catch(() => {});
      await prisma.storyAudio.delete({ where: { id: audio.id } }).catch(() => {});
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Не удалось сохранить задачу озвучки',
      });
    }

    return reply.code(202).send({ id: audio.id, jobId, status: 'queued', message: 'Озвучка запущена' });
  });

  // GET /api/tts/stories/:storyId/audio — список озвучек сказки
  app.get('/stories/:storyId/audio', { preHandler: [requireAuth] }, async (request, reply) => {
    const { storyId } = request.params as { storyId: string };
    const userId = request.auth!.user.id;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.userId !== userId) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сказка не найдена' });
    }

    const audioList = await prisma.storyAudio.findMany({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, voiceId: true, provider: true, status: true, durationMs: true, error: true, createdAt: true, progress: true, mode: true, expressive: true },
    });
    return reply.send(audioList);
  });

  // GET /api/tts/story-audio/:id/status
  app.get('/story-audio/:id/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth!.user.id;

    const audio = await prisma.storyAudio.findUnique({ where: { id } });
    if (!audio || audio.userId !== userId) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Озвучка не найдена' });
    }

    return reply.send({
      id: audio.id,
      status: audio.status,
      progress: audio.progress,
      mode: audio.mode,
      expressive: audio.expressive,
      error: audio.error ? publicTtsError(audio.error) : null,
      durationMs: audio.durationMs,
      voiceId: audio.voiceId,
    });
  });

  // GET /api/tts/story-audio/:id/url
  app.get('/story-audio/:id/url', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth!.user.id;

    const audio = await prisma.storyAudio.findUnique({ where: { id } });
    if (!audio || audio.userId !== userId) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Озвучка не найдена' });
    }

    if (audio.status !== 'completed' || !audio.objectName) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Аудио ещё не готово' });
    }

    const url = await storage.getUrl(audio.objectName);
    return reply.send({ url, durationMs: audio.durationMs });
  });

  // GET /api/tts/story-audio/:id/download — same-origin authenticated MP3.
  // Streaming through the backend avoids MinIO CORS and expired presigned URL
  // failures in the browser download flow.
  app.get('/story-audio/:id/download', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth!.user.id;

    const audio = await prisma.storyAudio.findUnique({ where: { id } });
    if (!audio || audio.userId !== userId) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Озвучка не найдена' });
    }
    if (audio.status !== 'completed' || !audio.objectName) {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'MP3 ещё не готов' });
    }

    try {
      const file = await storage.getObject(audio.objectName);
      const filename = `skazka-${audio.storyId}.mp3`;
      return reply
        .header('Content-Type', audio.mimeType || file.contentType || 'audio/mpeg')
        .header('Content-Length', String(file.size))
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Cache-Control', 'private, no-store')
        .send(file.stream);
    } catch {
      return reply.code(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Не удалось получить MP3 из хранилища. Попробуйте ещё раз.',
      });
    }
  });

  // DELETE /api/tts/story-audio/:id
  app.delete('/story-audio/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth!.user.id;

    const audio = await prisma.storyAudio.findUnique({ where: { id } });
    if (!audio || audio.userId !== userId) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Озвучка не найдена' });
    }

    if (audio.status === 'processing' || audio.status === 'queued') {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'Нельзя удалить озвучку во время генерации' });
    }

    if (audio.objectName) {
      try { await deleteFile(audio.objectName); } catch {}
    }
    await prisma.storyAudio.delete({ where: { id } });
    return reply.code(204).send();
  });

  // POST /api/tts/story-audio/:id/cancel — отмена задачи
  app.post('/story-audio/:id/cancel', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.auth!.user.id;

    const audio = await prisma.storyAudio.findUnique({ where: { id } });
    if (!audio || audio.userId !== userId) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Озвучка не найдена' });
    }

    // Разрешаем отмену queued и processing
    if (audio.status !== 'queued' && audio.status !== 'processing') {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'Можно отменить только ожидающую или выполняющуюся задачу' });
    }

    await prisma.storyAudio.update({
      where: { id },
      data: { status: 'cancelled', error: 'Отменено пользователем' },
    });

    // Cancel in Redis too
    if (audio.jobId) {
      await cancelTtsJobInQueue(audio.jobId).catch(() => {});
    }

    return reply.send({ cancelled: true, message: 'Озвучка отменена' });
  });

  done();
};

export function registerTtsRoutes(app: FastifyInstance): void {
  app.register(ttsRoutes, { prefix: '/api/tts' });
}
