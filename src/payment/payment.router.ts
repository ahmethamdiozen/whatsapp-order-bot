import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { updatePaymentStatus } from '../order/order.service';
import { sendMessage } from '../bot/messenger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const paymentRouter = Router();

// Stripe webhook — raw body required for signature verification
paymentRouter.post('/stripe-webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature error:', err);
    return res.sendStatus(400);
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = parseInt(session.metadata?.orderId ?? '0');

  if (!orderId) return res.sendStatus(200);

  if (event.type === 'checkout.session.completed') {
    const order = await updatePaymentStatus(orderId, 'PAID');
    await sendMessage(
      order.customerPhone,
      `✅ Payment received for Order #${order.id}. Thank you! Your order is being prepared.`
    );
  } else if (event.type === 'checkout.session.expired') {
    await updatePaymentStatus(orderId, 'FAILED');
  }

  res.sendStatus(200);
});

// Success page
paymentRouter.get('/success', (req: Request, res: Response) => {
  const orderId = req.query.order;
  res.send(`<h2>Payment successful! Order #${orderId} confirmed. You can close this page.</h2>`);
});

// Cancel page
paymentRouter.get('/cancel', (req: Request, res: Response) => {
  const orderId = req.query.order;
  res.send(`<h2>Payment cancelled for Order #${orderId}. Please try again via WhatsApp.</h2>`);
});
