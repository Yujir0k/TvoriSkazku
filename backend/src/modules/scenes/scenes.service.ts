import { prisma } from '../../lib/prisma.js';
import type { CreateSceneInput, UpdateSceneInput } from './scenes.schema.js';

export async function checkStoryOwner(storyId: string, userId: string): Promise<boolean> {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { userId: true } });
  return story?.userId === userId;
}

export async function getScenes(storyId: string, userId: string) {
  const owned = await checkStoryOwner(storyId, userId);
  if (!owned) return [];

  return prisma.storyScene.findMany({
    where: { storyId },
    orderBy: { position: 'asc' },
  });
}

export async function getSceneById(sceneId: string, userId: string) {
  const scene = await prisma.storyScene.findUnique({ where: { id: sceneId } });
  if (!scene || scene.userId !== userId) return null;
  return scene;
}

export async function createScene(userId: string, data: CreateSceneInput) {
  const owned = await checkStoryOwner(data.storyId, userId);
  if (!owned) return null;

  // Auto-assign position if not provided
  let position = data.position;
  if (position === undefined) {
    const last = await prisma.storyScene.findFirst({
      where: { storyId: data.storyId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (last?.position ?? -1) + 1;
  }

  return prisma.storyScene.create({
    data: {
      storyId: data.storyId,
      userId,
      position,
      title: data.title,
      description: data.description,
      style: data.style,
    },
  });
}

export async function updateScene(sceneId: string, userId: string, data: UpdateSceneInput) {
  const existing = await getSceneById(sceneId, userId);
  if (!existing) return null;

  return prisma.storyScene.update({
    where: { id: sceneId },
    data,
  });
}

export async function deleteScene(sceneId: string, userId: string): Promise<boolean> {
  const existing = await getSceneById(sceneId, userId);
  if (!existing) return false;

  await prisma.storyScene.delete({ where: { id: sceneId } });
  return true;
}

export async function reorderScenes(storyId: string, userId: string, sceneIds: string[]) {
  const owned = await checkStoryOwner(storyId, userId);
  if (!owned) return null;

  // Update each scene's position
  await Promise.all(
    sceneIds.map((id, index) =>
      prisma.storyScene.updateMany({
        where: { id, storyId },
        data: { position: index },
      }),
    ),
  );

  return prisma.storyScene.findMany({
    where: { storyId },
    orderBy: { position: 'asc' },
  });
}
