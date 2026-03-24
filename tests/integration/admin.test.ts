jest.mock('../../src/order/order.service');
jest.mock('../../src/bot/messenger');
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    order: { findMany: jest.fn() },
  },
}));
jest.mock('../../src/lib/redis', () => ({ redis: {} }));
jest.mock('../../src/lib/session');
jest.mock('../../src/menu/menu.service');
jest.mock('../../src/bot/ai');
jest.mock('../../src/payment/payment.service');
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({})));

import request from 'supertest';
import { app } from '../../src/app';
import { updateOrderStatus } from '../../src/order/order.service';
import { sendMessage } from '../../src/bot/messenger';
import { prisma } from '../../src/lib/prisma';

const mockUpdateOrderStatus = updateOrderStatus as jest.Mock;
const mockSendMessage = sendMessage as jest.Mock;
const mockOrderFindMany = prisma.order.findMany as jest.Mock;

const ADMIN_HEADERS = { 'x-admin-token': 'test-admin-token' };

beforeEach(() => {
  mockSendMessage.mockResolvedValue(undefined);
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('Admin — auth middleware', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/admin/orders');
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong token provided', async () => {
    const res = await request(app).get('/admin/orders').set('x-admin-token', 'wrong-token');
    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/orders ────────────────────────────────────────────────────────

describe('GET /admin/orders', () => {
  it('returns list of orders', async () => {
    const mockOrders = [
      { id: 1, customerPhone: '+905001234567', status: 'CONFIRMED', totalPrice: 9.99, items: [], location: { name: 'Downtown' } },
    ];
    mockOrderFindMany.mockResolvedValue(mockOrders);

    const res = await request(app).get('/admin/orders').set(ADMIN_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockOrders);
  });

  it('returns empty array when no orders', async () => {
    mockOrderFindMany.mockResolvedValue([]);

    const res = await request(app).get('/admin/orders').set(ADMIN_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── PATCH /admin/orders/:id/status ──────────────────────────────────────────

describe('PATCH /admin/orders/:id/status', () => {
  it('updates status and returns updated order', async () => {
    mockUpdateOrderStatus.mockResolvedValue({ id: 1, status: 'PREPARING', customerPhone: '+905001234567' });

    const res = await request(app)
      .patch('/admin/orders/1/status')
      .set(ADMIN_HEADERS)
      .send({ status: 'PREPARING' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, status: 'PREPARING' });
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(1, 'PREPARING');
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/admin/orders/1/status')
      .set(ADMIN_HEADERS)
      .send({ status: 'FLYING' });

    expect(res.status).toBe(400);
    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
  });

  it.each([
    ['PREPARING', 'being prepared'],
    ['READY', 'ready'],
    ['DELIVERED', 'delivered'],
    ['CANCELLED', 'cancelled'],
  ] as const)('sends WhatsApp notification for %s status', async (status, expectedText) => {
    mockUpdateOrderStatus.mockResolvedValue({ id: 1, status, customerPhone: '+905001234567' });

    await request(app)
      .patch('/admin/orders/1/status')
      .set(ADMIN_HEADERS)
      .send({ status });

    expect(mockSendMessage).toHaveBeenCalledWith('+905001234567', expect.stringContaining(expectedText));
  });

  it('does NOT send notification for PENDING or CONFIRMED status', async () => {
    mockUpdateOrderStatus.mockResolvedValue({ id: 1, status: 'PENDING', customerPhone: '+905001234567' });

    await request(app)
      .patch('/admin/orders/1/status')
      .set(ADMIN_HEADERS)
      .send({ status: 'PENDING' });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
