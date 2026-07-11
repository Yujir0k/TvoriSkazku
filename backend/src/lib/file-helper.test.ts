import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('./prisma.js', () => ({
  prisma: {
    userFile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    usageCounter: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('./storage.js', () => ({
  storage: {
    upload: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn(),
  },
}));

vi.mock('../modules/tariffs/tariffs.service.js', () => ({
  incrementUsage: vi.fn(),
}));

import { prisma } from './prisma.js';
import { storage } from './storage.js';
import { incrementUsage } from '../modules/tariffs/tariffs.service.js';

describe('file-helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.delete).mockResolvedValue(undefined);
  });

  it('exists and exports expected functions', async () => {
    const mod = await import('./file-helper.js');
    expect(typeof mod.uploadFile).toBe('function');
    expect(typeof mod.deleteFile).toBe('function');
    expect(typeof mod.replaceFile).toBe('function');
  });

  it('uploadFile creates UserFile and calls incrementUsage', async () => {
    const { uploadFile } = await import('./file-helper.js');

    vi.mocked(storage.upload).mockResolvedValue({ objectName: 'user1/file.jpg', size: 1024 });
    vi.mocked(prisma.userFile.create).mockResolvedValue({ id: 'file-1', objectName: 'user1/file.jpg', size: 1024, userId: 'user1', originalName: 'test.jpg', mimeType: 'image/jpeg', category: 'photo', createdAt: new Date() } as never);

    const result = await uploadFile('user1', Buffer.from('test'), 'image/jpeg', 'test.jpg', 'photo');

    expect(storage.upload).toHaveBeenCalledWith('user1', expect.any(Buffer), 'image/jpeg', 'test.jpg', 'photo');
    expect(prisma.userFile.create).toHaveBeenCalled();
    expect(incrementUsage).toHaveBeenCalledWith('user1', 'storageBytes', 1024);
    expect(result.objectName).toBe('user1/file.jpg');
  });

  it('uploadFile cleans up orphan on UserFile failure', async () => {
    const { uploadFile } = await import('./file-helper.js');

    vi.mocked(storage.upload).mockResolvedValue({ objectName: 'user1/orphan.jpg', size: 512 });
    vi.mocked(prisma.userFile.create).mockRejectedValue(new Error('DB error'));

    await expect(uploadFile('user1', Buffer.from('x'), 'image/jpeg', 'x.jpg')).rejects.toThrow('DB error');
    expect(storage.delete).toHaveBeenCalledWith('user1/orphan.jpg');
  });

  it('deleteFile removes file and decrements storage', async () => {
    const { deleteFile } = await import('./file-helper.js');

    vi.mocked(prisma.userFile.findFirst).mockResolvedValue({ userId: 'user1', size: 1024, objectName: 'user1/file.jpg' } as never);
    vi.mocked(prisma.userFile.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.usageCounter.findFirst).mockResolvedValue({ id: 'counter-1', used: 5000, userId: 'user1', resource: 'storageBytes' } as never);
    vi.mocked(prisma.usageCounter.update).mockResolvedValue({} as never);

    await deleteFile('user1/file.jpg');

    expect(storage.delete).toHaveBeenCalledWith('user1/file.jpg');
    expect(prisma.userFile.deleteMany).toHaveBeenCalled();
    expect(prisma.usageCounter.update).toHaveBeenCalledWith({
      where: { id: 'counter-1' },
      data: { used: 3976 },
    });
  });

  it('deleteFile propagates storage errors', async () => {
    const { deleteFile } = await import('./file-helper.js');
    vi.mocked(prisma.userFile.findFirst).mockResolvedValue(null as never);
    vi.mocked(storage.delete).mockRejectedValueOnce(new Error('not found'));

    await expect(deleteFile('nonexistent')).rejects.toThrow('not found');
  });

  it('replaceFile uploads new and deletes old', async () => {
    const { replaceFile } = await import('./file-helper.js');

    vi.mocked(storage.upload).mockResolvedValue({ objectName: 'user1/new.jpg', size: 2048 });
    vi.mocked(prisma.userFile.create).mockResolvedValue({ id: 'new-file', createdAt: new Date(), objectName: 'user1/new.jpg', size: 2048, userId: 'user1', originalName: 'new.jpg', mimeType: 'image/jpeg', category: 'photo' } as never);

    // For deleteFile internal call: findFirst returns old file info, deleteMany succeeds
    vi.mocked(prisma.userFile.findFirst).mockImplementation(async (args: any) => {
      if (args?.where?.objectName === 'user1/old.jpg') {
        return { userId: 'user1', size: 1024, objectName: 'user1/old.jpg' } as never;
      }
      return null;
    });
    vi.mocked(prisma.userFile.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.usageCounter.findFirst).mockResolvedValue({ id: 'c1', used: 5000 } as never);

    const result = await replaceFile('user1', Buffer.from('new'), 'image/jpeg', 'new.jpg', 'photo', 'user1/old.jpg');

    expect(result.objectName).toBe('user1/new.jpg');
    expect(storage.delete).toHaveBeenCalledWith('user1/old.jpg');
    expect(prisma.usageCounter.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { used: 3976 },
    });
  });

  it('replaceFile rolls back on delete failure', async () => {
    const { replaceFile } = await import('./file-helper.js');

    // uploadFile succeeds
    vi.mocked(storage.upload).mockResolvedValue({ objectName: 'user1/orphan.jpg', size: 500 });
    vi.mocked(prisma.userFile.create).mockResolvedValue({ id: 'new-file', createdAt: new Date(), objectName: 'user1/orphan.jpg', size: 500, userId: 'user1', originalName: 'new.jpg', mimeType: 'image/jpeg', category: 'photo' } as never);

    // deleteFile(old) fails
    vi.mocked(prisma.userFile.findFirst).mockImplementation(async (args: any) => {
      if (args?.where?.objectName === 'user1/old.jpg') {
        return { userId: 'user1', size: 100, objectName: 'user1/old.jpg' } as never;
      }
      return null;
    });
    vi.mocked(storage.delete).mockRejectedValueOnce(new Error('MinIO unreachable'));
    vi.mocked(prisma.userFile.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.usageCounter.findFirst).mockResolvedValue({ id: 'c1', used: 5000 } as never);

    await expect(replaceFile('user1', Buffer.from('x'), 'image/jpeg', 'x.jpg', 'photo', 'user1/old.jpg')).rejects.toThrow('MinIO unreachable');

    // The rollback should have deleted the orphan and its UserFile
    expect(storage.delete).toHaveBeenCalledWith('user1/orphan.jpg');
    expect(prisma.userFile.deleteMany).toHaveBeenCalledWith({ where: { objectName: 'user1/orphan.jpg' } });
    expect(prisma.usageCounter.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { used: 4500 },
    });
  });

  it('deleteFile never decrements storageBytes below zero', async () => {
    const { deleteFile } = await import('./file-helper.js');

    vi.mocked(prisma.userFile.findFirst).mockResolvedValue({ userId: 'u1', size: 500, objectName: 'small.jpg' } as never);
    vi.mocked(prisma.userFile.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.usageCounter.findFirst).mockResolvedValue({ id: 'c1', used: 100 } as never);

    await deleteFile('small.jpg');

    expect(prisma.usageCounter.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { used: 0 },
    });
  });

  it('deleteFile propagates errors and decrements storage with usageCounter mock', async () => {
    const { deleteFile } = await import('./file-helper.js');

    vi.mocked(prisma.userFile.findFirst).mockResolvedValue({ userId: 'u1', size: 500, objectName: 'test.jpg' } as never);
    vi.mocked(prisma.userFile.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(storage.delete).mockResolvedValue(undefined);
    vi.mocked(prisma.usageCounter.findFirst).mockResolvedValue({ id: 'c1', used: 1000 } as never);

    await deleteFile('test.jpg');
    expect(storage.delete).toHaveBeenCalledWith('test.jpg');
    expect(prisma.usageCounter.update).toHaveBeenCalled();
  });
});

describe('StorageBytes', () => {
  it('deleteFile calls storage.delete and prisma.userFile.deleteMany', async () => {
    vi.mocked(prisma.userFile.findFirst).mockResolvedValue({ userId: 'u1', size: 100, objectName: 'x.jpg', id: 'f1', originalName: 'x.jpg', mimeType: 'image/jpeg', category: 'photo', createdAt: new Date() } as never);
    vi.mocked(prisma.userFile.deleteMany).mockResolvedValue({ count: 1 } as never);

    const { deleteFile: df } = await import('./file-helper.js');
    await df('x.jpg');
    expect(storage.delete).toHaveBeenCalledWith('x.jpg');
    expect(prisma.userFile.deleteMany).toHaveBeenCalledWith({ where: { objectName: 'x.jpg' } });
  });
});
