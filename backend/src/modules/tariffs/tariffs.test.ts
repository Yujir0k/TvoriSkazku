import { describe, it, expect } from 'vitest';
import { PLAN_DEFINITIONS, RESOURCES } from './tariffs.schema.js';
import { getPlans } from './tariffs.service.js';

describe('Tariffs', () => {
  it('getPlans returns all plans', () => {
    const plans = getPlans();
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.id)).toEqual(['free', 'family', 'premium']);
  });

  it('free plan has 1 textGeneration', () => {
    expect(PLAN_DEFINITIONS.free.limits.textGenerations).toBe(1);
  });

  it('family plan has 15 textGenerations', () => {
    expect(PLAN_DEFINITIONS.family.limits.textGenerations).toBe(15);
  });

  it('premium plan has 999999 textGenerations (unlimited)', () => {
    expect(PLAN_DEFINITIONS.premium.limits.textGenerations).toBe(999999);
  });

  it('all RESOURCES have limits in all plans', () => {
    for (const plan of Object.values(PLAN_DEFINITIONS)) {
      for (const r of RESOURCES) {
        expect(plan.limits).toHaveProperty(r);
      }
    }
  });

  it('storage bytes are defined', () => {
    expect(PLAN_DEFINITIONS.free.limits.storageBytes).toBeGreaterThan(0);
    expect(PLAN_DEFINITIONS.premium.limits.storageBytes).toBeGreaterThan(PLAN_DEFINITIONS.family.limits.storageBytes);
  });
});
