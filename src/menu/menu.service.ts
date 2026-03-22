import { prisma } from '../lib/prisma';

export async function getMenuByLocation(locationId: number) {
  return prisma.menuItem.findMany({
    where: { locationId, isAvailable: true },
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

export async function findMenuItemById(id: number) {
  return prisma.menuItem.findUnique({
    where: { id },
  });
}

export async function getAllLocations() {
  return prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getMenuGroupedByCategory(locationId: number) {
  const items = await getMenuByLocation(locationId);

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  return grouped;
}