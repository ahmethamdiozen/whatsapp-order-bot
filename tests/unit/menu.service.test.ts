jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    menuItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    location: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/prisma';
import {
  getMenuByLocation,
  findMenuItemByName,
  findMenuItemById,
  getAllLocations,
  getMenuGroupedByCategory,
} from '../../src/menu/menu.service';

const mockFindMany = prisma.menuItem.findMany as jest.Mock;
const mockFindFirst = prisma.menuItem.findFirst as jest.Mock;
const mockFindUnique = prisma.menuItem.findUnique as jest.Mock;
const mockLocationFindMany = prisma.location.findMany as jest.Mock;

const mockItems = [
  { id: 1, name: 'Burger', description: 'Juicy', price: 9.99, category: 'Mains', isAvailable: true, locationId: 1, createdAt: new Date() },
  { id: 2, name: 'Fries', description: 'Crispy', price: 3.99, category: 'Sides', isAvailable: true, locationId: 1, createdAt: new Date() },
  { id: 3, name: 'Coke', description: 'Cold', price: 2.99, category: 'Drinks', isAvailable: true, locationId: 1, createdAt: new Date() },
  { id: 4, name: 'Salad', description: 'Fresh', price: 7.99, category: 'Mains', isAvailable: true, locationId: 1, createdAt: new Date() },
];

const mockLocations = [
  { id: 1, name: 'Downtown', address: '123 Main St', phone: '555-0001', isActive: true, createdAt: new Date() },
  { id: 2, name: 'Uptown', address: '456 Oak Ave', phone: '555-0002', isActive: true, createdAt: new Date() },
];

describe('Menu Service', () => {
  describe('getMenuByLocation', () => {
    it('returns available items sorted by category', async () => {
      mockFindMany.mockResolvedValue(mockItems);
      const result = await getMenuByLocation(1);
      expect(result).toEqual(mockItems);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { locationId: 1, isAvailable: true },
        orderBy: { category: 'asc' },
      });
    });

    it('returns empty array when no items', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await getMenuByLocation(99);
      expect(result).toEqual([]);
    });
  });

  describe('findMenuItemByName', () => {
    it('finds item by partial name (case-insensitive)', async () => {
      mockFindFirst.mockResolvedValue(mockItems[0]);
      const result = await findMenuItemByName('burg', 1);
      expect(result).toEqual(mockItems[0]);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { locationId: 1, isAvailable: true, name: { contains: 'burg', mode: 'insensitive' } },
      });
    });

    it('returns null when item not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await findMenuItemByName('pizza', 1);
      expect(result).toBeNull();
    });
  });

  describe('findMenuItemById', () => {
    it('returns item by id', async () => {
      mockFindUnique.mockResolvedValue(mockItems[0]);
      const result = await findMenuItemById(1);
      expect(result).toEqual(mockItems[0]);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns null for non-existent id', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await findMenuItemById(999);
      expect(result).toBeNull();
    });
  });

  describe('getAllLocations', () => {
    it('returns active locations sorted by name', async () => {
      mockLocationFindMany.mockResolvedValue(mockLocations);
      const result = await getAllLocations();
      expect(result).toEqual(mockLocations);
      expect(mockLocationFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getMenuGroupedByCategory', () => {
    it('groups items by category correctly', async () => {
      mockFindMany.mockResolvedValue(mockItems);
      const result = await getMenuGroupedByCategory(1);
      expect(Object.keys(result)).toEqual(expect.arrayContaining(['Mains', 'Sides', 'Drinks']));
      expect(result['Mains']).toHaveLength(2);
      expect(result['Sides']).toHaveLength(1);
      expect(result['Drinks']).toHaveLength(1);
    });

    it('returns empty object when no items', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await getMenuGroupedByCategory(1);
      expect(result).toEqual({});
    });
  });
});
