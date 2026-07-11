import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return value;
}

const booleanEnv = z.preprocess(parseBoolean, z.boolean());
const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

// Priority (first wins): backend/.env.local > backend/.env > ../.env.local > ../.env
// NOTE: process.env takes highest priority since dotenv never overwrites set vars
const envFiles = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env.local'),
  path.resolve(process.cwd(), '..', '.env'),
];

for (const file of envFiles) {
  if (existsSync(file)) {
    loadDotenv({ path: file });
  }
}

const DEMO_SECRETS = ['change-me-password', 'changeme', 'password', 'secret', 'demo', 'test', '12345678'];

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().url().default('http://127.0.0.1:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  MAILPIT_HOST: z.string().min(1).default('127.0.0.1'),
  MAILPIT_SMTP_PORT: z.coerce.number().int().positive().default(1025),
  MAILPIT_WEB_PORT: z.coerce.number().int().positive().default(8025),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  SESSION_COOKIE_NAME: z.string().min(1).default('tvoriskazku_session'),
  SESSION_REDIS_PREFIX: z.string().min(1).default('tvoriskazku:session:'),
  SESSION_USER_INDEX_PREFIX: z.string().min(1).default('tvoriskazku:session-user:'),
  SESSION_ROLLING_TTL: z.coerce.number().int().positive().default(60 * 60 * 24),

  // Yandex Cloud AI (Foundation Models)
  YANDEX_API_KEY: z.string().min(1),
  YANDEX_FOLDER_ID: z.string().min(1),
  YANDEX_MODEL: z.string().min(1).default('deepseek-v4-flash'),
  YANDEX_MAX_TOKENS: z.coerce.number().int().positive().default(9000),
  YANDEX_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  // ElevenLabs TTS
  ELEVENLABS_API_KEY: optionalSecret,
  ELEVENLABS_BASE_URL: z.string().url().default('https://api.elevenlabs.io'),
  ELEVENLABS_MODEL_ID: z.string().min(1).default('eleven_v3'),
  ELEVENLABS_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),

  // Image generation (Polza.ai Media API)
  POLZA_AI_API_KEY: optionalSecret,
  POLZA_AI_BASE_URL: z.string().url().default('https://polza.ai/api'),
  POLZA_IMAGE_MODEL: z.string().min(1).default('black-forest-labs/flux.2-flex'),
  POLZA_IMAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),

  // Redis prefixes for stories
  STORIES_JOB_PREFIX: z.string().min(1).default('tvoriskazku:story:'),
  STORIES_QUEUE_KEY: z.string().min(1).default('tvoriskazku:stories:queue'),
  STORIES_JOB_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24), // 24 часа для демо

  // MinIO
  MINIO_ENDPOINT: z.string().min(1).default('127.0.0.1'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z.preprocess(parseBoolean, z.boolean()).default(false),
  MINIO_ACCESS_KEY: z.string().min(1).default('tvoriskazku'),
  MINIO_SECRET_KEY: z.string().min(1).default('change-me-password'),
  MINIO_BUCKET: z.string().min(1).default('tvoriskazku'),
  MINIO_PRESIGNED_EXPIRY_SECONDS: z.coerce.number().int().positive().default(3600),

  // Foreign TTS Relay (stateless, for ElevenLabs)
  FOREIGN_TTS_RELAY_URL: z.string().url().optional(),
  FOREIGN_TTS_RELAY_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  FOREIGN_TTS_ENABLED: booleanEnv.default(false),
  FOREIGN_TTS_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),

  // Tariff / limits
  LIMITS_ENFORCEMENT_ENABLED: booleanEnv.default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`);
  throw new Error(`Invalid environment variables:\n${issues.join('\n')}`);
}

// --- Production validation ---
if (parsed.data.NODE_ENV === 'production') {
  // Demo/default secrets check
  if (
    DEMO_SECRETS.includes(parsed.data.MINIO_SECRET_KEY.toLowerCase()) ||
    DEMO_SECRETS.includes(parsed.data.POSTGRES_PASSWORD.toLowerCase()) ||
    DEMO_SECRETS.includes(parsed.data.REDIS_URL.toLowerCase())
  ) {
    throw new Error('Production: обнаружены demo/default секреты. Установите безопасные значения для MINIO_SECRET_KEY, POSTGRES_PASSWORD, REDIS_URL.');
  }

  // FRONTEND_ORIGIN must be HTTPS
  if (!parsed.data.FRONTEND_ORIGIN.startsWith('https://')) {
    throw new Error('Production: FRONTEND_ORIGIN должен быть HTTPS.');
  }

  // Foreign TTS: если включён, требуется URL и secret
  if (parsed.data.FOREIGN_TTS_ENABLED) {
    if (!parsed.data.FOREIGN_TTS_RELAY_URL || !parsed.data.FOREIGN_TTS_RELAY_SECRET) {
      throw new Error('Production: FOREIGN_TTS_ENABLED=true требует FOREIGN_TTS_RELAY_URL и FOREIGN_TTS_RELAY_SECRET.');
    }
  }

  // No silent fallback: if foreign enabled, direct ElevenLabs key is not used
  if (parsed.data.FOREIGN_TTS_ENABLED && parsed.data.ELEVENLABS_API_KEY) {
    console.warn('Production: FOREIGN_TTS_ENABLED=true — ELEVENLABS_API_KEY не используется. Direct ElevenLabs отключён.');
  }
}

export const env = parsed.data;
