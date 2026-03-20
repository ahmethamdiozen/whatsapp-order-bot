import { Router, Request, Response } from 'express';
import { parseOrder } from '../bot/ai';
import { sendMessage } from '../bot/messenger';
import { findMenuItemByName, getAllLocations } from '../menu/menu.service';
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

      const session = await getSession(from);

      // Handle location selection
      if (session?.status === 'selecting_location') {
        const locations = await getAllLocations();
        const selectedIndex = parseInt(text) - 1;

        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= locations.length) {
          const locationList = locations
            .map((l, i) => `${i + 1}. ${l.name} — ${l.address}`)
            .join('\n');
          await sendMessage(from, `Please enter a valid number:\n\n${locationList}`);
          return res.sendStatus(200);
        }

        const selectedLocation = locations[selectedIndex];
        await setSession(from, {
          ...session,
          locationId: selectedLocation.id,
          status: 'awaiting_confirmation',
          items: [],
          total: 0,
        });

        await sendMessage(
          from,
          `📍 Selected: *${selectedLocation.name}*\n\nWhat would you like to order?\nExample: "2 burgers and 1 coke"`
        );

        return res.sendStatus(200);
      }

      // Handle order confirmation
      if (session?.status === 'awaiting_confirmation' && session.items.length > 0) {
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

      // Handle order input when location is already selected
      if (session?.status === 'awaiting_confirmation' && session.locationId && session.items.length === 0) {
        const parsed = await parseOrder(text);
        console.log('AI parsed:', JSON.stringify(parsed, null, 2));

        if (parsed.intent === 'order' && parsed.items.length > 0) {
          const resolvedItems = await Promise.all(
            parsed.items.map(async (item) => {
              const menuItem = await findMenuItemByName(item.name, session.locationId!);
              return { ...item, menuItem };
            })
          );

          const notFound = resolvedItems.filter(i => !i.menuItem);
          const found = resolvedItems.filter(i => i.menuItem);

          if (notFound.length > 0) {
            const names = notFound.map(i => i.name).join(', ');
            await sendMessage(from, `❌ The following items are not available: ${names}`);
            return res.sendStatus(200);
          }

          const total = found.reduce((sum, i) => {
            return sum + (i.menuItem!.price * i.quantity);
          }, 0);

          await setSession(from, {
            ...session,
            items: found.map(i => ({
              name: i.menuItem!.name,
              quantity: i.quantity,
              price: i.menuItem!.price,
              menuItemId: i.menuItem!.id,
            })),
            total,
          });

          const itemList = found
            .map(i => `${i.quantity}x ${i.menuItem!.name} — $${(i.menuItem!.price * i.quantity).toFixed(2)}`)
            .join('\n');

          await sendMessage(
            from,
            `✅ Your order summary:\n\n${itemList}\n\nTotal: $${total.toFixed(2)}\n\nType *YES* to confirm or *NO* to cancel.`
          );
        } else {
          await sendMessage(from, 'Please tell us what you would like to order.\nExample: "2 burgers and 1 coke"');
        }

        return res.sendStatus(200);
      }

      // New conversation — ask user to select a location
      const locations = await getAllLocations();
      const locationList = locations
        .map((l, i) => `${i + 1}. ${l.name} — ${l.address}`)
        .join('\n');

      await setSession(from, {
        status: 'selecting_location',
        items: [],
        total: 0,
      });

      await sendMessage(
        from,
        `👋 Welcome! Please select a branch by entering its number:\n\n${locationList}`
      );
    }
  }

  res.sendStatus(200);
});