import { env } from '../../config/env.js';

export interface PolzaMediaStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  data?: { url?: string } | string | null;
  error?: { code?: string; message?: string } | null;
}

export class PolzaImageError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly code: string) {
    super(message);
    this.name = 'PolzaImageError';
  }
}

async function polzaFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!env.POLZA_AI_API_KEY) {
    throw new PolzaImageError('Сервис иллюстраций не настроен', 503, 'IMAGE_PROVIDER_NOT_CONFIGURED');
  }
  const response = await fetch(`${env.POLZA_AI_BASE_URL.replace(/\/+$/, '')}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.POLZA_AI_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(env.POLZA_IMAGE_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new PolzaImageError(
      `Image API error ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
      response.status,
      `IMAGE_PROVIDER_${response.status}`,
    );
  }
  return response;
}

function buildIllustrationPrompt(style: string, description: string): string {
  const visualStyle = style.trim() || 'мягкая акварельная иллюстрация для детской книги';
  return [
    'Создай добрую иллюстрацию для детской сказки.',
    `Сцена: ${description.trim()}.`,
    `Стиль: ${visualStyle}.`,
    'Тёплая светлая палитра, выразительные дружелюбные персонажи, аккуратная книжная композиция, высокая детализация.',
    'Без надписей, букв, логотипов, рамок, водяных знаков и пугающих деталей.',
    'Горизонтальная композиция 4:3, пригодная для печати в PDF-книге.',
  ].join(' ');
}

export class PolzaImageProvider {
  async createJob(params: { style: string; description: string }): Promise<{ jobId: string }> {
    const response = await polzaFetch('/v1/media', {
      method: 'POST',
      body: JSON.stringify({
        model: env.POLZA_IMAGE_MODEL,
        input: {
          prompt: buildIllustrationPrompt(params.style, params.description),
          aspect_ratio: '4:3',
          image_resolution: '2K',
          output_format: 'jpeg',
          images: [],
        },
        async: true,
      }),
    });
    const data = await response.json() as { id?: string };
    if (!data.id) throw new PolzaImageError('Сервис не вернул идентификатор генерации', 502, 'IMAGE_PROVIDER_BAD_RESPONSE');
    return { jobId: data.id };
  }

  async getStatus(jobId: string): Promise<{ status: string; imageUrl?: string; error?: string }> {
    const response = await polzaFetch(`/v1/media/${encodeURIComponent(jobId)}`);
    const data = await response.json() as PolzaMediaStatus;
    const imageUrl = typeof data.data === 'object' && data.data ? data.data.url : undefined;
    return {
      status: data.status,
      imageUrl,
      error: data.error?.message,
    };
  }

  async cancelJob(): Promise<boolean> {
    // Media API does not document a guaranteed cancellation operation for images.
    return false;
  }

  async getResult(jobId: string): Promise<{ url: string } | null> {
    const status = await this.getStatus(jobId);
    return status.status === 'completed' && status.imageUrl ? { url: status.imageUrl } : null;
  }
}
