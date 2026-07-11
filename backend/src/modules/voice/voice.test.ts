import { describe, it, expect } from 'vitest';
import { CONSENT_TEXT, CONSENT_VERSION } from './voice-consent.schema.js';
import { getConsentInfo } from './voice-consent.service.js';

describe('Voice Consent', () => {
  it('getConsentInfo returns version and text', () => {
    const info = getConsentInfo();
    expect(info.version).toBe(CONSENT_VERSION);
    expect(info.text.length).toBeGreaterThan(50);
  });

  it('CONSENT_TEXT is defined', () => {
    expect(CONSENT_TEXT.length).toBeGreaterThan(100);
    expect(CONSENT_TEXT).toContain('отключён');
    expect(CONSENT_TEXT).toContain('готовая студийная озвучка');
  });

  it('GET /api/voice/consent-info via inject returns 200', async () => {
    const fastify = (await import('fastify')).default;
    const app = fastify({ logger: false });
    const { registerVoiceRoutes } = await import('./index.js');
    await app.register(registerVoiceRoutes);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/api/voice/consent-info' });
    await app.close();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.version).toBe('1.0');
    expect(body.text.length).toBeGreaterThan(50);
  });
});

describe('Voice Samples', () => {
  it('sample schema validates correctly', async () => {
    const { createSampleSchema, updateSampleNameSchema, sampleIdParamSchema } = await import('./voice-samples.schema.js');

    expect(createSampleSchema.safeParse({ name: 'Test', durationMs: 5000 }).success).toBe(true);
    expect(createSampleSchema.safeParse({ name: '', durationMs: 5000 }).success).toBe(false);
    expect(updateSampleNameSchema.safeParse({ name: 'New name' }).success).toBe(true);
    expect(sampleIdParamSchema.safeParse({ id: 'abc' }).success).toBe(true);
    expect(sampleIdParamSchema.safeParse({}).success).toBe(false);
  });
});
