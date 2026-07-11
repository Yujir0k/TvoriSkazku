import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { PLAN_DEFINITIONS, RESOURCES } from './tariffs.schema.js';
import type { PlanName, PlanLimits } from './tariffs.schema.js';

export function getPlans() {
  return Object.values(PLAN_DEFINITIONS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    limits: plan.limits,
  }));
}

export async function getUserPlan(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const planId: PlanName = subscription?.plan === 'family' || subscription?.plan === 'premium'
    ? subscription.plan
    : 'free';

  return {
    plan: PLAN_DEFINITIONS[planId],
    subscription: subscription
      ? {
          periodStart: subscription.periodStart,
          periodEnd: subscription.periodEnd,
          autoRenew: subscription.autoRenew,
        }
      : null,
  };
}

export async function getUsage(userId: string): Promise<Record<string, number>> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const counters = await prisma.usageCounter.findMany({
    where: {
      userId,
      periodStart: { gte: startOfMonth },
    },
    select: { resource: true, used: true },
  });

  const usage: Record<string, number> = {};
  for (const r of RESOURCES) {
    usage[r] = 0;
  }
  for (const c of counters) {
    usage[c.resource] = c.used;
  }

  // storageBytes: фактический объём из user_files, а не месячный счётчик
  usage.storageBytes = await getStorageUsed(userId);

  // illustrations: считаем по факту
  usage.illustrations = await prisma.storyIllustration.count({ where: { userId } });

  // pdfBooks
  usage.pdfBooks = await prisma.bookProject.count({ where: { userId } });

  return usage;
}

export async function getSubscriptionSummary(userId: string) {
  const { plan, subscription } = await getUserPlan(userId);
  const usage = await getUsage(userId);

  const limits = plan.limits;
  const remaining: Record<string, number | boolean> = {};
  const exceeded: Record<string, boolean> = {};

  for (const r of RESOURCES) {
    const limit = limits[r as keyof PlanLimits];
    const used = usage[r] || 0;

    if (typeof limit === 'boolean') {
      remaining[r] = limit;
      exceeded[r] = false;
    } else {
      const remain = Math.max(0, limit - used);
      remaining[r] = remain;
      exceeded[r] = used >= limit;
    }
  }

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      price: plan.price,
    },
    subscription,
    usage,
    limits,
    remaining,
    exceeded,
    enforcement: env.LIMITS_ENFORCEMENT_ENABLED,
  };
}

export async function incrementUsage(userId: string, resource: string, amount = 1): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const existing = await prisma.usageCounter.findFirst({
    where: {
      userId,
      resource,
      periodStart: { gte: startOfMonth },
    },
  });

  if (existing) {
    await prisma.usageCounter.update({
      where: { id: existing.id },
      data: { used: { increment: amount } },
    });
  } else {
    await prisma.usageCounter.create({
      data: {
        userId,
        resource,
        used: amount,
        periodStart: startOfMonth,
        periodEnd: endOfMonth,
      },
    });
  }
}

export async function checkLimit(userId: string, resource: string): Promise<{ allowed: boolean; remaining: number }> {
  if (!env.LIMITS_ENFORCEMENT_ENABLED) {
    return { allowed: true, remaining: 999999 };
  }

  const summary = await getSubscriptionSummary(userId);
  const limit = summary.limits[resource as keyof PlanLimits];

  if (typeof limit === 'boolean') {
    return limit ? { allowed: true, remaining: 1 } : { allowed: false, remaining: 0 };
  }

  const used = summary.usage[resource] || 0;
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, remaining };
}

export async function getStorageUsed(userId: string): Promise<number> {
  const result = await prisma.userFile.aggregate({
    where: { userId },
    _sum: { size: true },
  });
  return result._sum.size || 0;
}

export async function getChildProfileCount(userId: string): Promise<number> {
  return prisma.childProfile.count({ where: { userId } });
}

export async function getCharacterCount(userId: string): Promise<number> {
  return prisma.character.count({ where: { userId } });
}

export async function getStoryCount(userId: string): Promise<number> {
  return prisma.story.count({ where: { userId } });
}
