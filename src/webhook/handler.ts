import { Router, Request, Response } from 'express';
import { parseOrder } from '../bot/ai';
import { sendMessage, sendInteractiveList } from '../bot/messenger';
import { findMenuItemById, getMenuGroupedByCategory, getAllLocations } from '../menu/menu.service';
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

async function showMenu(to: string, locationId: number, session: OrderSession) {
  const grouped = await getMenuGroupedByCategory(locationId);

  const sections = Object.entries(grouped).map(([category, items]) => ({
    title: category,
    rows: items.map(item => ({
      id: `item_${item.id}`,
      title: item.name,
      description: `$${item.price.toFixed(2)}${item.description ? ' — ' + item.description : ''}`,
    })),
  }));

  const cartSummary = session.items.length > 0
    ? `\n\n🛒 Cart: ${session.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}\nTotal: $${session.total.toFixed(2)}`
    : '';

  await sendInteractiveList(
    to,
    `Here's our menu! Select an item to add to your cart.${cartSummary}`,
    'View Menu',
    sections,
  );
}

webhookRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const session = await getSession(from);

      // Handle interactive list reply (menu item selection)
      if (message.type === 'interactive') {
        const selectedId = message.interactive?.list_reply?.id as string;
        const selectedTitle = message.interactive?.list_reply?.title as string;

        if (selectedId?.startsWith('item_') && session?.locationId) {
          const menuItemId = parseInt(selectedId.replace('item_', ''));
          const menuItem = await findMenuItemById(menuItemId);

          if (!menuItem) {
            await sendMessage(from, '❌ Item not found. Please try again.');
            return res.sendStatus(200);
          }

          // Add item to cart
          const existingItem = session.items.find(i => i.menuItemId === menuItemId);
          let updatedItems = [...session.items];

          if (existingItem) {
            updatedItems = updatedItems.map(i =>
              i.menuItemId === menuItemId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            );
          } else {
            updatedItems.push({
              name: menuItem.name,
              quantity: 1,
              price: menuItem.price,
              menuItemId: menuItem.id,
            });
          }

          const newTotal = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

          const updatedSession: OrderSession = {
            ...session,
            items: updatedItems,
            total: newTotal,
            status: 'browsing_menu',
          };

          await setSession(from, updatedSession);

          // Show updated menu with cart
          await showMenu(from, session.locationId, updatedSession);
        }

        return res.sendStatus(200);
      }

      const text = message.text?.body?.trim();
      console.log(`Message received - From: ${from}, Text: ${text}`);

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
        const newSession: OrderSession = {
          locationId: selectedLocation.id,
          items: [],
          total: 0,
          status: 'browsing_menu',
        };

        await setSession(from, newSession);
        await sendMessage(from, `📍 *${selectedLocation.name}* selected!`);
        await showMenu(from, selectedLocation.id, newSession);
        return res.sendStatus(200);
      }

      // Handle checkout / confirmation commands while browsing menu
      if (session?.status === 'browsing_menu') {
        const upper = text.toUpperCase();

        if (upper === 'CHECKOUT' || upper === 'ORDER') {
          if (session.items.length === 0) {
            await sendMessage(from, '🛒 Your cart is empty. Please select items from the menu first.');
            await showMenu(from, session.locationId!, session);
            return res.sendStatus(200);
          }

          await setSession(from, { ...session, status: 'awaiting_confirmation' });

          const itemList = session.items
            .map(i => `${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}`)
            .join('\n');

          await sendMessage(
            from,
            `✅ Your order summary:\n\n${itemList}\n\nTotal: $${session.total.toFixed(2)}\n\nType *YES* to confirm or *NO* to cancel.`
          );
          return res.sendStatus(200);
        }

        if (upper === 'CLEAR' || upper === 'RESET') {
          await setSession(from, { ...session, items: [], total: 0 });
          await sendMessage(from, '🗑️ Cart cleared.');
          await showMenu(from, session.locationId!, { ...session, items: [], total: 0 });
          return res.sendStatus(200);
        }

        if (upper === 'MENU') {
          await showMenu(from, session.locationId!, session);
          return res.sendStatus(200);
        }

        // If user types freely, try AI parsing
        const parsed = await parseOrder(text);
        if (parsed.intent === 'order') {
          await sendMessage(from, 'Please select items directly from the menu, or type *CHECKOUT* when ready.');
          await showMenu(from, session.locationId!, session);
        } else {
          await sendMessage(from, 'Type *CHECKOUT* to place your order, *CLEAR* to empty your cart, or *MENU* to see the menu again.');
        }

        return res.sendStatus(200);
      }

      // Handle order confirmation
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