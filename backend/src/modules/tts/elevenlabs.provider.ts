import { env } from '../../config/env.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildForeignTtsPayload, sanitizeForForeignTts } from '../../lib/foreign-tts-sanitizer.js';

let musicMetadata: typeof import('music-metadata') | null = null;
async function getMusicMetadata() {
  if (!musicMetadata) {
    musicMetadata = await import('music-metadata');
  }
  return musicMetadata;
}

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  description: string;
  gender: 'male' | 'female';
  previewUrl?: string;
  available: boolean;
}

export const VOICE_CATALOG: Omit<ElevenLabsVoice, 'available'>[] = [
  {
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Добрый рассказчик', description: 'Тёплый голос для основной истории', gender: 'male',
    previewUrl: '/assets/voice-previews/TX3LPaxmHKxFdv7VOQHJ.mp3',
  },
  {
    voiceId: 'ZHIn0jcgR6VIvVAXkwWV', name: 'Другой основной рассказчик', description: 'Спокойный запасной голос для главного повествования', gender: 'male',
    previewUrl: '/assets/voice-previews/ZHIn0jcgR6VIvVAXkwWV.mp3',
  },
  {
    voiceId: 'NQJnREzQtnAHHZnia0tY', name: 'Мудрый дедушка', description: 'Неторопливый голос для мудрых советов и добрых финалов', gender: 'male',
    previewUrl: '/assets/voice-previews/NQJnREzQtnAHHZnia0tY.mp3',
  },
  {
    voiceId: 'GquPFn9xormgmHaJ2KdN', name: 'Медведь', description: 'Мягкий низкий голос для больших и добрых персонажей', gender: 'male',
    previewUrl: '/assets/voice-previews/GquPFn9xormgmHaJ2KdN.mp3',
  },
  {
    voiceId: 'ymDCYd8puC7gYjxIamPt', name: 'Бабушка', description: 'Ласковый домашний голос для тёплых сказок перед сном', gender: 'female',
    previewUrl: '/assets/voice-previews/ymDCYd8puC7gYjxIamPt.mp3',
  },
  {
    voiceId: 'hLjwV7lYzk15SWLUmhEH', name: 'Загадочная рассказчица', description: 'Таинственный голос для волшебных лесов и секретов', gender: 'female',
    previewUrl: '/assets/voice-previews/hLjwV7lYzk15SWLUmhEH.mp3',
  },
  {
    voiceId: 'GN4wbsbejSnGSa1AzjH5', name: 'Добрая феечка', description: 'Светлый сказочный голос для чудес и добрых превращений', gender: 'female',
    previewUrl: '/assets/voice-previews/GN4wbsbejSnGSa1AzjH5.mp3',
  },
  {
    voiceId: 'q22qntNqQAvTaBoqE089', name: 'Женский рассказчик', description: 'Ровный женский голос для спокойного повествования', gender: 'female',
    previewUrl: '/assets/voice-previews/q22qntNqQAvTaBoqE089.mp3',
  },
];

export const DEFAULT_VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ';

function voicePreviewPath(voiceId: string): string {
  return `/api/tts/voices/${encodeURIComponent(voiceId)}/preview`;
}

const SAFE_TAGS = new Set([
  '[softly]', '[warmly]', '[whispers]', '[excited]', '[curious]',
  '[mischievously]', '[laughs]', '[sighs]',
]);

const TAG_REGEX = /\[[a-zA-Zа-яА-Я]+\]/g;

export function filterAudioTags(text: string): string {
  return text.replace(TAG_REGEX, (match) => (SAFE_TAGS.has(match.toLowerCase()) ? match : ''));
}

const MAX_TTS_CHARS = 4500;

export function splitTextForTts(text: string, maxLen = MAX_TTS_CHARS): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    const chapterIdx = remaining.lastIndexOf('\n\n##', maxLen);
    if (chapterIdx > maxLen * 0.3) {
      chunks.push(remaining.slice(0, chapterIdx).trim());
      remaining = remaining.slice(chapterIdx).trim();
      continue;
    }
    const paraIdx = remaining.lastIndexOf('\n\n', maxLen);
    if (paraIdx > maxLen * 0.3) {
      chunks.push(remaining.slice(0, paraIdx).trim());
      remaining = remaining.slice(paraIdx).trim();
      continue;
    }
    let splitIdx = -1;
    const searchEnd = Math.min(maxLen, remaining.length);
    for (let i = searchEnd; i >= Math.min(searchEnd - 200, 0); i--) {
      const char = remaining[i];
      if ((char === '.' || char === '!' || char === '?') && (i + 1 >= remaining.length || remaining[i + 1] === ' ' || remaining[i + 1] === '\n')) {
        const afterQuote = remaining.slice(0, i + 1);
        const quoteCount = (afterQuote.match(/"/g) || []).length;
        if (quoteCount % 2 === 0) {
          splitIdx = i + 1;
          break;
        }
      }
    }
    if (splitIdx > maxLen * 0.3) {
      chunks.push(remaining.slice(0, splitIdx).trim());
      remaining = remaining.slice(splitIdx).trim();
    } else {
      chunks.push(remaining.slice(0, maxLen).trim());
      remaining = remaining.slice(maxLen).trim();
    }
  }
  if (remaining.trim()) chunks.push(remaining.trim());
  return chunks;
}

export async function textToSpeechViaForeignRelay(
  text: string,
  voiceId: string,
  expressive: boolean,
  options: { modelId?: string; signal?: AbortSignal; namesToRemove?: string[] } = {},
): Promise<{ audioBuffer: Buffer; durationMs: number }> {
  if (!env.FOREIGN_TTS_RELAY_URL) {
    throw new ElevenLabsError('Foreign TTS relay не настроен', 503, 'FOREIGN_TTS_NOT_CONFIGURED');
  }

  const filteredText = expressive ? filterAudioTags(text) : text.replace(TAG_REGEX, '');

  // Для foreign relay создаём payload с именами для удаления
  const payload = buildForeignTtsPayload(filteredText, voiceId, options.namesToRemove || []);
  if (!payload) {
    throw new ElevenLabsError('Текст сказки содержит недопустимые данные для внешней озвучки', 400, 'FOREIGN_TTS_BLOCKED');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.FOREIGN_TTS_TIMEOUT_MS);
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(env.FOREIGN_TTS_RELAY_URL.replace(/\/+$/, '') + '/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-relay-secret': env.FOREIGN_TTS_RELAY_SECRET || '',
      },
      body: JSON.stringify(payload),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ElevenLabsError(
        `Foreign TTS relay error (${response.status})${body ? ': ' + body.slice(0, 200) : ''}`,
        response.status,
        'FOREIGN_TTS_RELAY_' + response.status,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const durationMs = await getMp3Duration(audioBuffer) || Math.round((filteredText.length / 30) * 1000);

    return { audioBuffer, durationMs };
  } finally {
    clearTimeout(timeout);
  }
}

export class ElevenLabsError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
    this.name = 'ElevenLabsError';
  }
}

function createRequestSignal(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(env.ELEVENLABS_TIMEOUT_MS);
  if (!signal) return timeoutSignal;
  return AbortSignal.any([signal, timeoutSignal]);
}

async function elevenLabsFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = env.ELEVENLABS_BASE_URL.replace(/\/+$/, '');
  const url = baseUrl + path;
  const signal = createRequestSignal(options.signal ?? undefined);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': env.ELEVENLABS_API_KEY || '',
      ...options.headers,
    },
    signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const contentType = response.headers?.get?.('content-type') || '';
    const isCloudflareBlock = response.status === 403 && (
      contentType.includes('text/html')
      || /just a moment|cloudflare|cf-ray/i.test(body)
    );
    if (isCloudflareBlock) {
      throw new ElevenLabsError(
        'ElevenLabs заблокировал запрос с текущего IP или региона (HTTP 403)',
        403,
        'ELEVENLABS_REGION_BLOCKED',
      );
    }
    let message = 'ElevenLabs API error ' + response.status;
    if (body) message += ': ' + body.slice(0, 200);
    throw new ElevenLabsError(message, response.status, 'ELEVENLABS_' + response.status);
  }
  return response;
}

export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const foreignConfigured = Boolean(env.FOREIGN_TTS_ENABLED) && Boolean(env.FOREIGN_TTS_RELAY_URL) && Boolean(env.FOREIGN_TTS_RELAY_SECRET);
  const configured = foreignConfigured || Boolean(env.ELEVENLABS_API_KEY);
  return VOICE_CATALOG.map((voice) => ({
    ...voice,
    previewUrl: voice.previewUrl || voicePreviewPath(voice.voiceId),
    available: configured,
  }));
}

export function isRetryableElevenLabsError(error: unknown): boolean {
  if (!(error instanceof ElevenLabsError)) return true;
  if (error.code === 'ELEVENLABS_REGION_BLOCKED') return false;
  return error.statusCode === 408
    || error.statusCode === 425
    || error.statusCode === 429
    || error.statusCode >= 500;
}

export async function textToSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
  expressive = false,
  options: { modelId?: string; signal?: AbortSignal; namesToRemove?: string[] } = {},
): Promise<{ audioBuffer: Buffer; durationMs: number }> {
  // Если настроен foreign TTS relay — используем его (fail-closed: без fallback)
  if (env.FOREIGN_TTS_ENABLED) {
    if (!env.FOREIGN_TTS_RELAY_URL || !env.FOREIGN_TTS_RELAY_SECRET) {
      throw new ElevenLabsError('Foreign TTS relay не настроен. Укажите FOREIGN_TTS_RELAY_URL и FOREIGN_TTS_RELAY_SECRET', 503, 'FOREIGN_TTS_NOT_CONFIGURED');
    }
    const names = options.namesToRemove || [];
    return textToSpeechViaForeignRelay(text, voiceId, expressive, { ...options, namesToRemove: names });
  }

  if (!env.ELEVENLABS_API_KEY) {
    throw new ElevenLabsError('ElevenLabs не настроен', 503, 'TTS_NOT_CONFIGURED');
  }

  const filteredText = expressive ? filterAudioTags(text) : text.replace(TAG_REGEX, '');

  const response = await elevenLabsFetch('/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128', {
    method: 'POST',
    body: JSON.stringify({
      model_id: options.modelId || env.ELEVENLABS_MODEL_ID,
      text: filteredText,
      language_code: 'ru' as string,
    }),
    signal: options.signal,
  });

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);
  const durationMs = await getMp3Duration(audioBuffer) || Math.round((filteredText.length / 30) * 1000);

  return { audioBuffer, durationMs };
}

// ─── Dialogue TTS (настоящий /v1/text-to-dialogue) ─────────────────────────────

export interface DialogueLine {
  text: string;
  voiceId: string;
  kind?: 'narration' | 'dialogue';
}

const MAX_DIALOGUE_CHARS = 2000;
const MAX_DIALOGUE_VOICES = 10;

export function extractDialogues(text: string): DialogueLine[] {
  const lines: DialogueLine[] = [];
  const regex = /[-—]?\s*[""««]([^""»»]+)[""»»]\s*[-—]?/g;
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const narration = text.slice(lastIndex, match.index).trim();
      if (narration.length > 5) lines.push({ text: narration, voiceId: DEFAULT_VOICE_ID, kind: 'narration' });
    }
    const speech = match[1].trim();
    if (speech.length > 5) lines.push({ text: speech, voiceId: '', kind: 'dialogue' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining.length > 5) lines.push({ text: remaining, voiceId: DEFAULT_VOICE_ID, kind: 'narration' });
  }
  return lines;
}

interface DialogueInput {
  text: string;
  voice_id: string;
}

export async function textToDialogue(
  lines: DialogueLine[],
  characterVoices: Record<string, string>,
  shouldContinue?: () => Promise<boolean>,
  options: { signal?: AbortSignal } = {},
): Promise<{ audioBuffer: Buffer; durationMs: number }> {
  // Dialogue mode не поддерживается через foreign relay — блокируем
  if (env.FOREIGN_TTS_ENABLED) {
    throw new ElevenLabsError('Режим озвучки по ролям недоступен при текущей схеме подключения', 503, 'DIALOGUE_NOT_AVAILABLE');
  }
  if (!env.ELEVENLABS_API_KEY) {
    throw new ElevenLabsError('ElevenLabs не настроен', 503, 'TTS_NOT_CONFIGURED');
  }

  if (lines.length === 0) {
    throw new ElevenLabsError('Нет текста для озвучки', 400, 'EMPTY_DIALOGUE');
  }

  const availableVoices = Object.values(characterVoices).filter(Boolean);
  const usedVoiceIds = new Set<string>();
  let dialogueIndex = 0;

  // Назначаем голос для каждой реплики по индексу
  // narration → DEFAULT_VOICE_ID, цитированные реплики → character voice по индексу
  const inputs: DialogueInput[] = lines.map((line) => {
    const isDialogue = line.kind === 'dialogue' || (!line.kind && line.voiceId === '');
    const voiceId = isDialogue && availableVoices.length > 0
      ? availableVoices[dialogueIndex++ % availableVoices.length]
      : (line.voiceId || DEFAULT_VOICE_ID);
    usedVoiceIds.add(voiceId);
    return { text: line.text, voice_id: voiceId };
  });

  if (usedVoiceIds.size > MAX_DIALOGUE_VOICES) {
    throw new ElevenLabsError('Слишком много уникальных голосов (макс. ' + MAX_DIALOGUE_VOICES + ')', 400, 'TOO_MANY_VOICES');
  }

  // Разбиваем на чанки, сохраняя voice_id по индексу
  const chunks: DialogueInput[][] = [];
  let current: DialogueInput[] = [];
  let currentLen = 0;
  for (const inp of inputs) {
    // Если реплика длиннее MAX_DIALOGUE_CHARS, разбиваем её саму
    if (inp.text.length > MAX_DIALOGUE_CHARS) {
      if (current.length > 0) {
        chunks.push(current);
        current = [];
        currentLen = 0;
      }
      // Разбиваем длинную реплику на части
      for (let i = 0; i < inp.text.length; i += MAX_DIALOGUE_CHARS) {
        chunks.push([{ text: inp.text.slice(i, i + MAX_DIALOGUE_CHARS), voice_id: inp.voice_id }]);
      }
      continue;
    }
    if (currentLen + inp.text.length > MAX_DIALOGUE_CHARS && current.length > 0) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(inp);
    currentLen += inp.text.length;
  }
  if (current.length > 0) chunks.push(current);

  const audioParts: Buffer[] = [];

  for (const chunk of chunks) {
    if (shouldContinue && !(await shouldContinue())) {
      throw new TtsCancelledError();
    }
    const response = await elevenLabsFetch('/v1/text-to-dialogue', {
      method: 'POST',
      body: JSON.stringify({
        model_id: env.ELEVENLABS_MODEL_ID,
        inputs: chunk,
        language_code: 'ru',
      }),
      signal: options.signal,
    });

    const buf = Buffer.from(await response.arrayBuffer());
    audioParts.push(buf);
  }

  const finalBuffer = audioParts.length === 1 ? audioParts[0] : await mergeMp3Chunks(audioParts);
  const durationMs = await getMp3Duration(finalBuffer) || Math.round((lines.reduce((s, l) => s + l.text.length, 0) / 30) * 1000);

  return { audioBuffer: finalBuffer, durationMs };
}

export class TtsCancelledError extends Error {
  constructor() {
    super('TTS job cancelled');
    this.name = 'TtsCancelledError';
  }
}

// ─── MP3 Duration via music-metadata (без ffprobe) ────────────────────────────

async function getMp3Duration(buffer: Buffer): Promise<number | null> {
  const tmp = path.join(os.tmpdir(), 'dur-' + randomUUID() + '.mp3');
  try {
    fs.writeFileSync(tmp, buffer);
    const mm = await getMusicMetadata();
    const metadata = await mm.parseFile(tmp);
    if (metadata.format.duration) {
      return Math.round(metadata.format.duration * 1000);
    }
    return null;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ─── MP3 Merge via ffmpeg-static (frame-aware) ───────────────────────────────

let ffmpegPath: string | null = null;
async function getFfmpegPath(): Promise<string> {
  if (!ffmpegPath) {
    const ff = await import('ffmpeg-static') as unknown as { default: string | null };
    ffmpegPath = ff.default;
  }
  if (!ffmpegPath) throw new Error('ffmpeg-static not found');
  return ffmpegPath;
}

export async function mergeMp3Chunks(chunks: Buffer[]): Promise<Buffer> {
  if (chunks.length === 1) return chunks[0];

  const tmpDir = path.join(os.tmpdir(), 'tts-merge-' + randomUUID());
  fs.mkdirSync(tmpDir, { recursive: true });

  const fileListPath = path.join(tmpDir, 'files.txt');
  const outputPath = path.join(tmpDir, 'out.mp3');

  try {
    const files: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const fp = path.join(tmpDir, i + '.mp3');
      fs.writeFileSync(fp, chunks[i]);
      files.push(fp);
    }

    const fileList = files.map((f) => "file '" + f.replace(/\\/g, '/') + "'").join('\n');
    fs.writeFileSync(fileListPath, fileList, 'utf8');

    const ffPath = await getFfmpegPath();
    const { execFile } = await import('node:child_process');

    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        ffPath,
        [
          '-y',
          '-f', 'concat',
          '-safe', '0',
          '-i', fileListPath,
          '-c', 'copy',
          outputPath,
        ],
        { timeout: 30000 },
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
      child.on('error', reject);
    });

    return fs.readFileSync(outputPath);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
