import { Router, Request, Response } from 'express';
import { parseOrder } from '../bot/ai';
import { sendMessage } from '../bot/messenger';
import { findMenuItemByName } from '../menu/menu.service';
import { getSession, setSession, clearSession, OrderSession } from '../lib/session';
import { createOrder } from '../order/order.service';

export const webhookRouter = Router();

webhookRouter.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

webhookRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body?.trim();
      console.log(`Message received - From: ${from}, Text: ${text}`);

      // Check if there is an existing session for this user
      const session = await getSession(from);

      // Handle confirmation response
      if (session?.status === 'awaiting_confirmation') {
        if (text.toUpperCase() === 'YES') {
          const order = await createOrder(from, session);
          await clearSession(from);
          await sendMessage(
            from,
            `🎉 Your order has been confirmed!\n\nOrder #${order.id}\nTotal: $${order.totalPrice.toFixed(2)}\n\nYour order is being prepared. Thank you!`
          );
        } else if (text.toUpperCase() === 'NO') {
          await clearSession(from);
          await sendMessage(from, '❌ Order cancelled. Feel free to place a new order anytime.');
        } else {
          await sendMessage(from, 'Please type *YES* to confirm or *NO* to cancel your order.');
        }

        return res.sendStatus(200);
      }

      // Parse incoming message as a new order
      const parsed = await parseOrder(text);
      console.log('AI parsed:', JSON.stringify(parsed, null, 2));

      if (parsed.intent === 'order' && parsed.items.length > 0) {
        const locationId = 1;

        // Match parsed items against the menu
        const resolvedItems = await Promise.all(
          parsed.items.map(async (item) => {
            const menuItem = await findMenuItemByName(item.name, locationId);
            return { ...item, menuItem };
          })
        );

        const notFound = resolvedItems.filter(i => !i.menuItem);
        const found = resolvedItems.filter(i => i.menuItem);

        // Notify user if any items were not found in the menu
        if (notFound.length > 0) {
          const names = notFound.map(i => i.name).join(', ');
          await sendMessage(from, `❌ The following items are not available: ${names}`);
          return res.sendStatus(200);
        }

        // Calculate total price
        const total = found.reduce((sum, i) => {
          return sum + (i.menuItem!.price * i.quantity);
        }, 0);

        // Save pending order to session
        const newSession: OrderSession = {
          locationId,
          items: found.map(i => ({
            name: i.menuItem!.name,
            quantity: i.quantity,
            price: i.menuItem!.price,
            menuItemId: i.menuItem!.id,
          })),
          total,
          status: 'awaiting_confirmation',
        };

        await setSession(from, newSession);

        // Send order summary to user
        const itemList = found
          .map(i => `${i.quantity}x ${i.menuItem!.name} — $${(i.menuItem!.price * i.quantity).toFixed(2)}`)
          .join('\n');

        await sendMessage(
          from,
          `✅ Your order summary:\n\n${itemList}\n\nTotal: $${total.toFixed(2)}\n\nType *YES* to confirm or *NO* to cancel.`
        );
      } else {
        // Default message for unrecognized input
        await sendMessage(from, 'Hello! To place an order, just tell us what you would like.\nExample: "2 burgers and 1 coke"');
      }
    }
  }

  res.sendStatus(200);
});