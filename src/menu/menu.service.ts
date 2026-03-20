import { prisma } from '../lib/prisma';

export async function getMenuByLocation(locationId: number) {
  return prisma.menuItem.findMany({
    where: {
      locationId,
      isAvailable: true,
    },
    orderBy: { category: 'asc' },
  });
}

export async function findMenuItemByName(name: string, locationId: number) {
  return prisma.menuItem.findFirst({
    where: {
      locationId,
      isAvailable: true,
      name: { contains: name, mode: 'insensitive' },
    },
  });
}

export async function getAllLocations() {
    return prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc'},
    });
}