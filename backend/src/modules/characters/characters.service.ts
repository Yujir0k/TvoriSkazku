import { prisma } from '../../lib/prisma.js';
import { deleteFile } from '../../lib/file-helper.js';
import { assertNoPersonalData, assertSafeNameInput } from '../../lib/personal-data-filter.js';
import { incrementUsage } from '../tariffs/tariffs.service.js';
import type { CreateCharacterInput, UpdateCharacterInput } from './characters.schema.js';

function assertCharacterInput(data: CreateCharacterInput | UpdateCharacterInput): void {
  if (data.name !== undefined) assertSafeNameInput(data.name);
  assertNoPersonalData(data.role || '', data.description || '', data.traits || '', data.interests || '');
}

export async function createCharacter(userId: string, data: CreateCharacterInput) {
  assertCharacterInput(data);

  if (data.childProfileId) {
    const profile = await prisma.childProfile.findFirst({ where: { id: data.childProfileId, userId } });
    if (!profile) throw new Error('Профиль ребёнка не найден');
  }
  const char = await prisma.character.create({
    data: {
      userId,
      childProfileId: data.childProfileId || null,
      name: data.name,
      role: data.role,
      description: data.description,
      traits: data.traits,
      interests: data.interests,
      presetAvatarId: data.presetAvatarId,
      voiceId: data.voiceId || '',
      voiceEnabled: data.voiceEnabled || false,
    },
  });
  try { await incrementUsage(userId, 'characters'); } catch {}
  return char;
}

export async function getCharacters(userId: string, query: { childProfileId?: string }) {
  const where: Record<string, unknown> = { userId };
  if (query.childProfileId) where.childProfileId = query.childProfileId;
  return prisma.character.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export async function getCharacterById(characterId: string, userId: string) {
  return prisma.character.findFirst({ where: { id: characterId, userId } });
}

export async function updateCharacter(characterId: string, userId: string, data: UpdateCharacterInput) {
  const existing = await getCharacterById(characterId, userId);
  if (!existing) return null;

  assertCharacterInput(data);

  if (data.childProfileId) {
    const profile = await prisma.childProfile.findFirst({ where: { id: data.childProfileId, userId } });
    if (!profile) throw new Error('Профиль ребёнка не найден');
  }
  const nextVoiceEnabled = data.voiceEnabled ?? existing.voiceEnabled;
  const nextVoiceId = data.voiceId ?? existing.voiceId;
  if (nextVoiceEnabled && !nextVoiceId) {
    throw new Error('Выберите готовый голос');
  }
  return prisma.character.update({ where: { id: characterId }, data });
}

export async function deleteCharacter(characterId: string, userId: string): Promise<boolean> {
  const existing = await getCharacterById(characterId, userId);
  if (!existing) return false;
  if (existing.photoObjectName) { try { await deleteFile(existing.photoObjectName); } catch {} }
  await prisma.character.delete({ where: { id: characterId } });
  return true;
}
