import { prisma } from '../lib/prisma';

export interface PromoResult {
  valid: boolean;
  discountPercent?: number;
  error?: string;
}

export async function validatePromoCode(code: string): Promise<PromoResult> {
  const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });

  if (!promo || !promo.isActive) {
    return { valid: false, error: 'Invalid promo code.' };
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return { valid: false, error: 'This promo code has expired.' };
  }

  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    return { valid: false, error: 'This promo code has reached its usage limit.' };
  }

  return { valid: true, discountPercent: promo.discountPercent };
}

export async function incrementPromoUsage(code: string): Promise<void> {
  await prisma.promoCode.update({
    where: { code: code.toUpperCase() },
    data: { usedCount: { increment: 1 } },
  });
}

export async function getAllPromoCodes() {
  return prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createPromoCode(data: {
  code: string;
  discountPercent: number;
  expiresAt?: string;
  usageLimit?: number;
}) {
  return prisma.promoCode.create({
    data: {
      code: data.code.toUpperCase(),
      discountPercent: data.discountPercent,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      usageLimit: data.usageLimit ?? null,
    },
  });
}

export async function togglePromoCode(code: string, isActive: boolean) {
  return prisma.promoCode.update({
    where: { code: code.toUpperCase() },
    data: { isActive },
  });
}

export async function deletePromoCode(code: string) {
  return prisma.promoCode.delete({ where: { code: code.toUpperCase() } });
}
