const mockConstructEvent = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
);
jest.mock('../../src/order/order.service');
jest.mock('../../src/bot/messenger');
jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/lib/redis', () => ({ redis: {} }));
jest.mock('../../src/lib/session');
jest.mock('../../src/menu/menu.service');
jest.mock('../../src/bot/ai');
jest.mock('../../src/payment/payment.service');
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({})));

import request from 'supertest';
import { app } from '../../src/app';
import { updatePaymentStatus } from '../../src/order/order.service';
import { sendMessage } from '../../src/bot/messenger';

const mockUpdatePaymentStatus = updatePaymentStatus as jest.Mock;
const mockSendMessage = sendMessage as jest.Mock;

beforeEach(() => {
  mockSendMessage.mockResolvedValue(undefined);
});

// ─── Success / Cancel pages ──────────────────────────────────────────────────

describe('GET /payment/success', () => {
  it('returns success page with order id', async () => {
    const res = await request(app).get('/payment/success').query({ order: '42' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('42');
    expect(res.text.toLowerCase()).toContain('success');
  });
});

describe('GET /payment/cancel', () => {
  it('returns cancel page with order id', async () => {
    const res = await request(app).get('/payment/cancel').query({ order: '42' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('42');
    expect(res.text.toLowerCase()).toContain('cancel');
  });
});

// ─── Stripe Webhook ──────────────────────────────────────────────────────────

describe('POST /payment/stripe-webhook', () => {
  it('returns 400 on invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });

    const res = await request(app)
      .post('/payment/stripe-webhook')
      .set('stripe-signature', 'invalid-sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
  });

  it('updates payment status to PAID and sends WhatsApp on checkout.session.completed', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: { orderId: '42' } } },
    });
    mockUpdatePaymentStatus.mockResolvedValue({ id: 42, customerPhone: '+905001234567' });

    const res = await request(app)
      .post('/payment/stripe-webhook')
      .set('stripe-signature', 'valid-sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(mockUpdatePaymentStatus).toHaveBeenCalledWith(42, 'PAID');
    expect(mockSendMessage).toHaveBeenCalledWith('+905001234567', expect.stringContaining('Payment received'));
  });

  it('updates payment status to FAILED on checkout.session.expired', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.expired',
      data: { object: { metadata: { orderId: '42' } } },
    });
    mockUpdatePaymentStatus.mockResolvedValue({ id: 42, customerPhone: '+905001234567' });

    const res = await request(app)
      .post('/payment/stripe-webhook')
      .set('stripe-signature', 'valid-sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(mockUpdatePaymentStatus).toHaveBeenCalledWith(42, 'FAILED');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('ignores events without orderId in metadata', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: {} } },
    });

    const res = await request(app)
      .post('/payment/stripe-webhook')
      .set('stripe-signature', 'valid-sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
  });
});
