import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const RELAY_SHARED_SECRET = process.env.RELAY_SHARED_SECRET || '';
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io';
const MAX_TEXT_LENGTH = 5000;
const MAX_BODY_BYTES = 10_240; // 10 KB
const ELEVENLABS_TIMEOUT_MS = 60_000;

if (!ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY is required');
  process.exit(1);
}
if (!RELAY_SHARED_SECRET) {
  console.error('RELAY_SHARED_SECRET is required');
  process.exit(1);
}

const app = Fastify({
  logger: {
    level: 'info',
    redact: {
      paths: ['req.headers', 'req.body', 'res.body', 'body', 'text'],
      censor: '[REDACTED]',
    },
  },
  bodyLimit: MAX_BODY_BYTES,
});

// Rate limit: 10 requests per minute per IP
await app.register(rateLimit, {
  max: 10,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Слишком много запросов. Попробуйте позже.',
  }),
});

// Проверка server-to-server shared secret
app.addHook('preHandler', (request, reply, done) => {
  if (request.url === '/tts' && request.method === 'POST') {
    const auth = request.headers['x-relay-secret'];
    if (!auth || auth !== RELAY_SHARED_SECRET) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
  }
  done();
});

// POST /tts — озвучка через ElevenLabs
app.post('/tts', async (request, reply) => {
  const body = request.body || {};

  // Строгая валидация: разрешены только requestId, text, voiceId, format
  const allowedKeys = new Set(['requestId', 'text', 'voiceId', 'format']);
  const receivedKeys = Object.keys(body);
  const unknownKeys = receivedKeys.filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    return reply.code(400).send({ error: 'Unknown fields: ' + unknownKeys.join(', ') });
  }

  const { text, voiceId, requestId, format } = body;

  if (!text || !voiceId) {
    return reply.code(400).send({ error: 'text and voiceId are required' });
  }
  if (typeof text !== 'string' || typeof voiceId !== 'string') {
    return reply.code(400).send({ error: 'text and voiceId must be strings' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return reply.code(400).send({
      error: `Text too long (max ${MAX_TEXT_LENGTH} characters)`,
      statusCode: 400,
    });
  }

  // Минимальное логирование — без headers, text, payload
  request.log.info({ requestId, status: 'forwarding' }, 'TTS relay: forwarding');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);

  try {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        model_id: 'eleven_multilingual_v2',
        text,
        language_code: 'ru',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      request.log.warn({ requestId, statusCode: response.status }, 'TTS relay: upstream error');
      return reply.code(response.status).send({
        error: 'Upstream error',
        statusCode: response.status,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    request.log.info({ requestId, size: buffer.length }, 'TTS relay: completed');

    return reply
      .header('Content-Type', 'audio/mpeg')
      .header('Content-Length', buffer.length)
      .header('X-Request-Id', requestId)
      .send(buffer);
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      return reply.code(504).send({ error: 'Relay upstream timeout', statusCode: 504 });
    }
    request.log.error({ requestId, err: error instanceof Error ? error.message : 'Unknown' }, 'TTS relay: failed');
    return reply.code(502).send({ error: 'Relay upstream failed', statusCode: 502 });
  }
});

// GET /health
app.get('/health', async () => ({
  status: 'ok',
  service: 'tts-relay',
  timestamp: new Date().toISOString(),
}));

const start = async () => {
  try {
    await app.listen({ host: HOST, port: PORT });
    console.log('TTS relay listening on port', PORT);
  } catch (err) {
    console.error('Failed to start TTS relay:', err);
    process.exit(1);
  }
};

start();
