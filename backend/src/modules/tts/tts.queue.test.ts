import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockSet, mockRPush, mockLPop, mockLRem, mockDel, mockKeys, mockZAdd, mockZRem, mockZRangeByScore, mockZRemRangeByScore, mockEval } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockRPush: vi.fn(),
  mockLPop: vi.fn(),
  mockLRem: vi.fn(),
  mockDel: vi.fn(),
  mockKeys: vi.fn(),
  mockZAdd: vi.fn(),
  mockZRem: vi.fn(),
  mockZRangeByScore: vi.fn(),
  mockZRemRangeByScore: vi.fn(),
  mockEval: vi.fn(),
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    get: mockGet,
    set: mockSet,
    rPush: mockRPush,
    lPop: mockLPop,
    lRem: mockLRem,
    del: mockDel,
    keys: mockKeys,
    zAdd: mockZAdd,
    zRem: mockZRem,
    zRangeByScore: mockZRangeByScore,
    zRemRangeByScore: mockZRemRangeByScore,
    eval: mockEval,
  },
}));

import {
  createTtsJob,
  getTtsJob,
  updateTtsJob,
  popTtsJob,
  cancelTtsJobInQueue,
  isTtsJobActive as isTtsJobActiveFn,
  acquireProcessingLock,
  releaseProcessingLock,
  renewProcessingLock,
  getProcessingJobIds,
  getBackoffDelay,
  MAX_RETRIES,
  scheduleRetry,
  processRetries,
} from './tts.queue.js';

describe('TTS Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createTtsJob creates and pushes job', async () => {
    mockSet.mockResolvedValue('OK');
    mockRPush.mockResolvedValue(1);

    const jobId = await createTtsJob({
      audioId: 'audio-1', userId: 'user-1', storyId: 'story-1',
      voiceId: 'voice-1', mode: 'single', expressive: true,
    });
    expect(jobId).toBeTruthy();
    expect(mockSet).toHaveBeenCalled();
    expect(mockRPush).toHaveBeenCalled();
  });

  it('getTtsJob returns null for missing job', async () => {
    mockGet.mockResolvedValue(null);
    expect(await getTtsJob('non-existent')).toBeNull();
  });

  it('getTtsJob parses stored job', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ jobId: 'job-1', status: 'queued', retryCount: 0 }));
    const job = await getTtsJob('job-1');
    expect(job?.status).toBe('queued');
  });

  it('popTtsJob returns job ID', async () => {
    mockLPop.mockResolvedValue('job-1');
    expect(await popTtsJob()).toBe('job-1');
  });

  it('cancelTtsJobInQueue cancels queued job', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ jobId: 'job-1', status: 'queued', retryCount: 0 }));
    mockLRem.mockResolvedValue(1);
    mockZRem.mockResolvedValue(1);
    mockSet.mockResolvedValue('OK');
    expect(await cancelTtsJobInQueue('job-1')).toBe(true);
  });

  it('cancelTtsJobInQueue fails for completed job', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ jobId: 'job-1', status: 'completed', retryCount: 0 }));
    expect(await cancelTtsJobInQueue('job-1')).toBe(false);
  });

  it('isTtsJobActive checks status', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ jobId: 'job-1', status: 'processing', retryCount: 0 }));
    expect(await isTtsJobActiveFn('job-1')).toBe(true);

    mockGet.mockResolvedValue(JSON.stringify({ jobId: 'job-2', status: 'completed', retryCount: 0 }));
    expect(await isTtsJobActiveFn('job-2')).toBe(false);
  });

  it('acquireProcessingLock returns token on success', async () => {
    mockSet.mockResolvedValue('OK');
    const { locked, token } = await acquireProcessingLock('job-1');
    expect(locked).toBe(true);
    expect(token).toBeTruthy();
    expect(mockSet).toHaveBeenCalledWith(
      expect.any(String), expect.any(String),
      expect.objectContaining({ NX: true, EX: 300 }),
    );
  });

  it('acquireProcessingLock returns locked=false when lock exists', async () => {
    mockSet.mockResolvedValue(null);
    const { locked } = await acquireProcessingLock('job-1');
    expect(locked).toBe(false);
  });

  it('releaseProcessingLock uses token-safe eval', async () => {
    mockEval.mockResolvedValue(1);
    await releaseProcessingLock('job-1', 'token-1');
    expect(mockEval).toHaveBeenCalled();
  });

  it('renewProcessingLock extends TTL', async () => {
    mockEval.mockResolvedValue(1);
    expect(await renewProcessingLock('job-1', 'token-1')).toBe(true);
  });

  it('scheduleRetry adds to ZSET', async () => {
    mockZAdd.mockResolvedValue(1);
    await scheduleRetry('job-1', 5000);
    expect(mockZAdd).toHaveBeenCalled();
  });

  it('processRetries re-queues due items', async () => {
    mockEval.mockResolvedValue(2);
    expect(await processRetries()).toBe(2);
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining('zrangebyscore'),
      expect.objectContaining({
        keys: expect.arrayContaining([
          expect.stringContaining('retry'),
          expect.stringContaining('queue'),
        ]),
      }),
    );
  });

  it('getBackoffDelay returns increasing delays capped at 60s', () => {
    expect(getBackoffDelay(0)).toBe(2000);
    expect(getBackoffDelay(4)).toBe(32000);
    expect(getBackoffDelay(10)).toBe(60000);
  });

  it('MAX_RETRIES is 5', () => {
    expect(MAX_RETRIES).toBe(5);
  });
});
