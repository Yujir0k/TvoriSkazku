import { prisma } from '../../lib/prisma.js';
import { deleteFile } from '../../lib/file-helper.js';
import { assertNoPersonalData, assertSafeNameInput } from '../../lib/personal-data-filter.js';
import { incrementUsage } from '../tariffs/tariffs.service.js';
import type { CreateProfileInput, UpdateProfileInput } from './profiles.schema.js';

export interface ChildProfileRecord {
  id: string;
  userId: string;
  name: string;
  age: string;
  ageGroup: string;
  interests: string;
  favoriteThemes: string;
  description: string;
  photoObjectName: string | null;
  presetAvatarId: string;
  createdAt: Date;
  updatedAt: Date;
}

function assertProfileInput(data: CreateProfileInput | UpdateProfileInput): void {
  if (data.name !== undefined) assertSafeNameInput(data.name);
  assertNoPersonalData(data.interests || '', data.favoriteThemes || '', data.description || '');
}

export async function createProfile(userId: string, data: CreateProfileInput): Promise<ChildProfileRecord> {
  assertProfileInput(data);

  const profile = await prisma.childProfile.create({
    data: {
      userId,
      name: data.name,
      age: '',
      ageGroup: data.ageGroup,
      interests: data.interests,
      favoriteThemes: data.favoriteThemes,
      description: data.description,
      presetAvatarId: data.presetAvatarId,
    },
  });
  // Usage tracking
  try { await incrementUsage(userId, 'childProfiles'); } catch {}
  return profile;
}

export async function getProfiles(userId: string): Promise<ChildProfileRecord[]> {
  return prisma.childProfile.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProfileById(profileId: string, userId: string): Promise<ChildProfileRecord | null> {
  return prisma.childProfile.findFirst({
    where: { id: profileId, userId },
  });
}

export async function updateProfile(
  profileId: string,
  userId: string,
  data: UpdateProfileInput,
): Promise<ChildProfileRecord | null> {
  const existing = await getProfileById(profileId, userId);
  if (!existing) return null;

  assertProfileInput(data);

  return prisma.childProfile.update({
    where: { id: profileId },
    data,
  });
}

export async function deleteProfile(profileId: string, userId: string): Promise<boolean> {
  const existing = await getProfileById(profileId, userId);
  if (!existing) return false;

  if (existing.photoObjectName) {
    try {
      await deleteFile(existing.photoObjectName);
    } catch {}
  }

  await prisma.childProfile.delete({ where: { id: profileId } });
  return true;
}
