import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  POLZA_AI_API_KEY: 'test-image-key',
  POLZA_AI_BASE_URL: 'https://polza.ai/api',
  POLZA_IMAGE_MODEL: 'black-forest-labs/flux.2-flex',
  POLZA_IMAGE_TIMEOUT_MS: 30_000,
}));

vi.mock('../../config/env.js', () => ({ env: mockEnv }));

import { PolzaImageProvider } from './polza-image.provider.js';

describe('Polza image provider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts a 4:3 2K children-book illustration job', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'aig-1' }) });
    const provider = new PolzaImageProvider();
    await expect(provider.createJob({ style: 'акварель', description: 'Зайчик идёт к замку по цветочной тропинке' })).resolves.toEqual({ jobId: 'aig-1' });

    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe('https://polza.ai/api/v1/media');
    const body = JSON.parse(request[1].body);
    expect(body.model).toBe('black-forest-labs/flux.2-flex');
    expect(body.input.aspect_ratio).toBe('4:3');
    expect(body.input.image_resolution).toBe('2K');
    expect(body.input.output_format).toBe('jpeg');
    expect(body.input.prompt).toContain('детской сказки');
  });

  it('reads a completed image URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'completed', data: { url: 'https://cdn.test/image.jpg' } }),
    });
    const provider = new PolzaImageProvider();
    await expect(provider.getStatus('aig-1')).resolves.toEqual({
      status: 'completed',
      imageUrl: 'https://cdn.test/image.jpg',
      error: undefined,
    });
  });
});
