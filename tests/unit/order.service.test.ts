jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    order: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/prisma';
import { createOrder, updateOrderStatus, updatePaymentStatus, getOrdersByPhone } from '../../src/order/order.service';
import { OrderSession } from '../../src/lib/session';

const mockCreate = prisma.order.create as jest.Mock;
const mockUpdate = prisma.order.update as jest.Mock;
const mockFindMany = prisma.order.findMany as jest.Mock;

const mockSession: OrderSession = {
  locationId: 1,
  items: [
    { name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 },
    { name: 'Coke', quantity: 2, price: 2.99, menuItemId: 3 },
  ],
  total: 15.97,
  status: 'awaiting_confirmation',
};

describe('Order Service', () => {
  describe('createOrder', () => {
    it('creates order with correct data', async () => {
      const mockOrder = { id: 1, customerPhone: '+905001234567', totalPrice: 15.97, status: 'CONFIRMED', items: [] };
      mockCreate.mockResolvedValue(mockOrder);

      const result = await createOrder('+905001234567', mockSession);

      expect(result).toEqual(mockOrder);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          customerPhone: '+905001234567',
          locationId: 1,
          totalPrice: 15.97,
          discountAmount: 0,
          promoCode: null,
          status: 'CONFIRMED',
          items: {
            create: [
              { quantity: 1, price: 9.99, menuItemId: 1 },
              { quantity: 2, price: 2.99, menuItemId: 3 },
            ],
          },
        },
        include: { items: true },
      });
    });

    it('throws when locationId is missing', async () => {
      const sessionWithoutLocation: OrderSession = { ...mockSession, locationId: undefined };
      await expect(createOrder('+905001234567', sessionWithoutLocation))
        .rejects.toThrow('Location ID is required to create an order');
    });
  });

  describe('updateOrderStatus', () => {
    it.each([
      ['PREPARING'],
      ['READY'],
      ['DELIVERED'],
      ['CANCELLED'],
    ] as const)('updates order status to %s', async (status) => {
      const mockOrder = { id: 1, status, customerPhone: '+905001234567' };
      mockUpdate.mockResolvedValue(mockOrder);

      const result = await updateOrderStatus(1, status);

      expect(result).toEqual(mockOrder);
      expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { status } });
    });
  });

  describe('updatePaymentStatus', () => {
    it('updates payment status to PAID', async () => {
      mockUpdate.mockResolvedValue({ id: 1, paymentStatus: 'PAID', customerPhone: '+905001234567' });
      await updatePaymentStatus(1, 'PAID');
      expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { paymentStatus: 'PAID' } });
    });

    it('updates payment status to FAILED', async () => {
      mockUpdate.mockResolvedValue({ id: 1, paymentStatus: 'FAILED', customerPhone: '+905001234567' });
      await updatePaymentStatus(1, 'FAILED');
      expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { paymentStatus: 'FAILED' } });
    });
  });

  describe('getOrdersByPhone', () => {
    it('returns last 5 orders with items and location', async () => {
      const mockOrders = [{ id: 1, customerPhone: '+905001234567', items: [], location: { name: 'Downtown' } }];
      mockFindMany.mockResolvedValue(mockOrders);

      const result = await getOrdersByPhone('+905001234567');

      expect(result).toEqual(mockOrders);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { customerPhone: '+905001234567' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: { include: { menuItem: true } },
          location: true,
        },
      });
    });

    it('returns empty array when no orders', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await getOrdersByPhone('+905009999999');
      expect(result).toEqual([]);
    });
  });
});
