import { describe, it, expect, vi } from 'vitest';
import { createIllustrationSchema, illustrationIdParamSchema } from './illustrations.schema.js';
import { PERSONAL_DATA_BLOCK_MESSAGE } from '../../lib/personal-data-filter.js';

describe('Illustrations schema', () => {
  it('createIllustrationSchema validates', () => {
    expect(createIllustrationSchema.safeParse({ storyId: 's1' }).success).toBe(true);
    expect(createIllustrationSchema.safeParse({}).success).toBe(false);
  });

  it('illustrationIdParamSchema validates', () => {
    expect(illustrationIdParamSchema.safeParse({ id: 'ill-1' }).success).toBe(true);
    expect(illustrationIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('ImageProvider', () => {
  it('GET /api/illustrations/provider-status via inject returns 200', async () => {
    const fastify = (await import('fastify')).default;
    const app = fastify({ logger: false });
    const { registerIllustrationsRoutes } = await import('./index.js');
    await app.register(registerIllustrationsRoutes);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/illustrations/provider-status' });
    await app.close();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.configured).toBe(false);
    expect(body.message).toBeTruthy();
  });

  it('stub provider returns IMAGE_PROVIDER_NOT_CONFIGURED', async () => {
    const { createStubImageProvider, IMAGE_PROVIDER_NOT_CONFIGURED, IMAGE_DISABLED_MESSAGE } = await import('./illustrations.service.js');
    const stub = createStubImageProvider();

    try { await stub.createJob({ style: '', description: '' }); } catch (e: any) {
      expect(e.code).toBe(IMAGE_PROVIDER_NOT_CONFIGURED);
    }
    try { await stub.getStatus('x'); } catch (e: any) {
      expect(e.code).toBe(IMAGE_PROVIDER_NOT_CONFIGURED);
    }
  });

  it('assertSafeForExternalAi blocks personal data before imageProvider.createJob', async () => {
    const { assertSafeForExternalAi } = await import('../../lib/personal-data-filter.js');

    // Personal data in descriptions must be blocked
    expect(() => assertSafeForExternalAi('паспорт 4512 123456', 'watercolor')).toThrow(PERSONAL_DATA_BLOCK_MESSAGE);
    expect(() => assertSafeForExternalAi('телефон +7 999 123 45 67', 'watercolor')).toThrow(PERSONAL_DATA_BLOCK_MESSAGE);
    expect(() => assertSafeForExternalAi('адрес улица Ленина дом 5', 'watercolor')).toThrow(PERSONAL_DATA_BLOCK_MESSAGE);

    // Safe data should pass
    expect(() => assertSafeForExternalAi('волшебный замок и дракон', 'акварель')).not.toThrow();
    expect(() => assertSafeForExternalAi('принцесса в лесу', 'мультяшный стиль')).not.toThrow();
  });
});
