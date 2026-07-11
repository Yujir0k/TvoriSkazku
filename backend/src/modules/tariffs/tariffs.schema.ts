import { z } from 'zod';

export const PLAN_NAMES = ['free', 'family', 'premium'] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

export interface PlanLimits {
  textGenerations: number;
  childProfiles: number;
  characters: number;
  illustrations: number;
  storageBytes: number;
  pdfBooks: number;
  audioGenerations: number;
}

export interface PlanDefinition {
  id: PlanName;
  name: string;
  description: string;
  price: number;
  limits: PlanLimits;
}

export const PLAN_DEFINITIONS: Record<PlanName, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Первые сказки',
    description: 'бесплатно',
    price: 0,
    limits: {
      textGenerations: 1,
      childProfiles: 1,
      characters: 3,
      illustrations: 0,
      storageBytes: 10 * 1024 * 1024, // 10 MB
      pdfBooks: 0,
      audioGenerations: 1, // 1 озвучка на бесплатном тарифе
    },
  },
  family: {
    id: 'family',
    name: 'Семейный',
    description: 'планируется',
    price: 399,
    limits: {
      textGenerations: 15,
      childProfiles: 3,
      characters: 10,
      illustrations: 10,
      storageBytes: 100 * 1024 * 1024, // 100 MB
      pdfBooks: 3,
      audioGenerations: 5,
    },
  },
  premium: {
    id: 'premium',
    name: 'Премиум',
    description: 'скоро',
    price: 799,
    limits: {
      textGenerations: 999999,
      childProfiles: 6,
      characters: 30,
      illustrations: 50,
      storageBytes: 500 * 1024 * 1024, // 500 MB
      pdfBooks: 20,
      audioGenerations: 999999,
    },
  },
};

export const RESOURCES = [
  'textGenerations',
  'childProfiles',
  'characters',
  'illustrations',
  'storageBytes',
  'pdfBooks',
  'audioGenerations',
] as const;

export type ResourceName = (typeof RESOURCES)[number];

// Запрос /api/tariffs возвращает список планов
// GET /api/tariffs/me — текущий тариф и лимиты
