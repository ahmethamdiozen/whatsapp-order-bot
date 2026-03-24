const mockSessionsCreate = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionsCreate } },
  })),
);

import { createPaymentLink } from '../../src/payment/payment.service';

describe('Payment Service', () => {
  describe('createPaymentLink', () => {
    it('creates a Stripe checkout session and returns the URL', async () => {
      mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/test123' });

      const url = await createPaymentLink(42, 19.98);

      expect(url).toBe('https://checkout.stripe.com/pay/test123');
      expect(mockSessionsCreate).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Order #42' },
              unit_amount: 1998,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'https://test.example.com/payment/success?order=42',
        cancel_url: 'https://test.example.com/payment/cancel?order=42',
        metadata: { orderId: '42' },
      });
    });

    it('converts price to cents correctly', async () => {
      mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/test456' });

      await createPaymentLink(1, 9.99);

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({ unit_amount: 999 }),
            }),
          ],
        }),
      );
    });
  });
});
