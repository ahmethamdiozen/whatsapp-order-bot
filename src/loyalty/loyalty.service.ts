import { prisma } from '../lib/prisma';

export const POINTS_PER_DOLLAR = 1;       // 1 point per $1 spent
export const POINTS_REDEMPTION_RATE = 100; // 100 points = $5 discount
export const REDEMPTION_VALUE = 5;         // dollars

export async function getOrCreateAccount(phone: string) {
  return prisma.loyaltyAccount.upsert({
    where: { phone },
    create: { phone },
    update: {},
  });
}

export async function getPoints(phone: string): Promise<number> {
  const account = await prisma.loyaltyAccount.findUnique({ where: { phone } });
  return account?.points ?? 0;
}

export async function earnPoints(phone: string, orderTotal: number): Promise<number> {
  const earned = Math.floor(orderTotal * POINTS_PER_DOLLAR);
  if (earned === 0) return 0;

  await prisma.loyaltyAccount.upsert({
    where: { phone },
    create: { phone, points: earned, totalEarned: earned },
    update: {
      points: { increment: earned },
      totalEarned: { increment: earned },
    },
  });

  return earned;
}

export async function redeemPoints(phone: string): Promise<{ discount: number; pointsUsed: number } | null> {
  const account = await prisma.loyaltyAccount.findUnique({ where: { phone } });
  if (!account || account.points < POINTS_REDEMPTION_RATE) return null;

  const sets = Math.floor(account.points / POINTS_REDEMPTION_RATE);
  const pointsUsed = sets * POINTS_REDEMPTION_RATE;
  const discount = sets * REDEMPTION_VALUE;

  await prisma.loyaltyAccount.update({
    where: { phone },
    data: { points: { decrement: pointsUsed } },
  });

  return { discount, pointsUsed };
}

export async function getAllAccounts() {
  return prisma.loyaltyAccount.findMany({ orderBy: { points: 'desc' } });
}
