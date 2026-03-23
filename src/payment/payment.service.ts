import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createPaymentLink(orderId: number, totalPrice: number): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Order #${orderId}` },
          unit_amount: Math.round(totalPrice * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.APP_URL}/payment/success?order=${orderId}`,
    cancel_url: `${process.env.APP_URL}/payment/cancel?order=${orderId}`,
    metadata: { orderId: String(orderId) },
  });

  return session.url!;
}
