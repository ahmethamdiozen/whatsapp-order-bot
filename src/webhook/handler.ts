import { Router, Request, Response } from 'express';
import { parseOrder } from '../bot/ai';
import { sendMessage, sendInteractiveList, sendQuickActions, sendPostOrderActions } from '../bot/messenger';
import { findMenuItemById, getMenuGroupedByCategory, getAllLocations } from '../menu/menu.service';
import { getSession, setSession, clearSession, OrderSession } from '../lib/session';
import { createOrder, getOrdersByPhone } from '../order/order.service';

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
    ? `\n\n🛒 *Cart:*\n${session.items.map(i => `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}`).join('\n')}\n*Total: $${session.total.toFixed(2)}*`
    : '\n\n🛒 Your cart is empty.';

  const hint = session.items.length > 0
    ? '\n\nUse the buttons below or type *REMOVE [item]* to remove an item.'
    : '\n\nSelect items from the menu to add them to your cart.';

  await sendInteractiveList(
    to,
    `Here\'s our menu! Tap an item to add it to your cart. Select it again to add one more.${cartSummary}${hint}`,
    'View Menu',
    sections,
  );

  await sendQuickActions(to, session.items.length > 0);
}

async function getCartMessage(session: OrderSession): Promise<string> {
  if (session.items.length === 0) return '🛒 Your cart is empty.';

  const itemList = session.items
    .map(i => `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}`)
    .join('\n');

  return `🛒 *Your Cart:*\n\n${itemList}\n\n*Total: $${session.total.toFixed(2)}*\n\nType *REMOVE [item]* to remove an item.`;
}

async function startLocationSelection(from: string) {
  const locations = await getAllLocations();
  const locationList = locations
    .map((l, i) => `${i + 1}. ${l.name} — ${l.address}`)
    .join('\n');

  await setSession(from, { status: 'selecting_location', items: [], total: 0 });
  await sendMessage(from, `Please select a branch by entering its number:\n\n${locationList}`);
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

      // Handle interactive messages (button replies and list replies)
      if (message.type === 'interactive') {
        const buttonId = message.interactive?.button_reply?.id as string;
        const selectedId = message.interactive?.list_reply?.id as string;

        // Handle button replies
        if (buttonId) {
          // Quick action buttons (browsing menu)
          if (buttonId === 'action_checkout') {
            if (!session?.items.length) {
              await sendMessage(from, '🛒 Your cart is empty. Please select items first.');
              await showMenu(from, session!.locationId!, session!);
            } else {
              await setSession(from, { ...session!, status: 'awaiting_confirmation' });
              const itemList = session!.items
                .map(i => `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}`)
                .join('\n');
              await sendMessage(
                from,
                `✅ *Order Summary:*\n\n${itemList}\n\n*Total: $${session!.total.toFixed(2)}*\n\nType *YES* to confirm or *BACK* to return to menu.`
              );
            }
          } else if (buttonId === 'action_clear') {
            const clearedSession = { ...session!, items: [], total: 0 };
            await setSession(from, clearedSession);
            await sendMessage(from, '🗑️ Cart cleared!');
            await showMenu(from, session!.locationId!, clearedSession);
          } else if (buttonId === 'action_menu') {
            await showMenu(from, session!.locationId!, session!);

          // Post-order buttons
          } else if (buttonId === 'post_new_order') {
            await startLocationSelection(from);
          } else if (buttonId === 'post_my_orders') {
            const orders = await getOrdersByPhone(from);

            if (orders.length === 0) {
              await sendMessage(from, '📦 You have no previous orders.');
            } else {
              const orderList = orders.map(order => {
                const itemList = order.items
                  .map(i => `  • ${i.quantity}x ${i.menuItem.name}`)
                  .join('\n');
                return `*Order #${order.id}* — ${order.status}\n${itemList}\nTotal: $${order.totalPrice.toFixed(2)}\n📍 ${order.location.name}`;
              }).join('\n\n');

              await sendMessage(from, `📦 *Your Recent Orders:*\n\n${orderList}`);
            }

            await sendPostOrderActions(from);
          }

          return res.sendStatus(200);
        }

        // Handle menu item selection from list
        if (selectedId?.startsWith('item_') && session?.locationId) {
          const menuItemId = parseInt(selectedId.replace('item_', ''));
          const menuItem = await findMenuItemById(menuItemId);

          if (!menuItem) {
            await sendMessage(from, '❌ Item not found. Please try again.');
            return res.sendStatus(200);
          }

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

          const qty = updatedItems.find(i => i.menuItemId === menuItemId)!.quantity;
          await sendMessage(from, `✅ *${menuItem.name}* added! (${qty}x in cart)`);
          await showMenu(from, session.locationId, updatedSession);
        }

        return res.sendStatus(200);
      }

      const text = message.text?.body?.trim() ?? '';
      const upper = text.toUpperCase();
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

      // Handle order confirmation
      if (session?.status === 'awaiting_confirmation') {
        if (upper === 'YES') {
          const order = await createOrder(from, session);
          await setSession(from, { status: 'post_order', items: [], total: 0 });
          await sendMessage(
            from,
            `🎉 Your order has been confirmed!\n\nOrder #${order.id}\nTotal: $${order.totalPrice.toFixed(2)}\n\nYour order is being prepared. Thank you!`
          );
          await sendPostOrderActions(from);
        } else if (upper === 'NO' || upper === 'BACK') {
          await setSession(from, { ...session, status: 'browsing_menu' });
          await sendMessage(from, '↩️ No problem! Going back to your cart.');
          await showMenu(from, session.locationId!, { ...session, status: 'browsing_menu' });
        } else {
          await sendMessage(from, 'Please type *YES* to confirm or *BACK* to return to menu.');
        }

        return res.sendStatus(200);
      }

      // Handle post-order state (text fallback if buttons not tapped)
      if (session?.status === 'post_order') {
        await sendPostOrderActions(from);
        return res.sendStatus(200);
      }

      // Handle commands while browsing menu
      if (session?.status === 'browsing_menu') {
        if (upper === 'CART') {
          await sendMessage(from, await getCartMessage(session));
          return res.sendStatus(200);
        }

        if (upper === 'MENU') {
          await showMenu(from, session.locationId!, session);
          return res.sendStatus(200);
        }

        if (upper === 'CLEAR' || upper === 'RESET') {
          const clearedSession = { ...session, items: [], total: 0 };
          await setSession(from, clearedSession);
          await sendMessage(from, '🗑️ Cart cleared!');
          await showMenu(from, session.locationId!, clearedSession);
          return res.sendStatus(200);
        }

        if (upper.startsWith('REMOVE ')) {
          const itemName = text.slice(7).trim();
          const existingItem = session.items.find(i =>
            i.name.toLowerCase().includes(itemName.toLowerCase())
          );

          if (!existingItem) {
            await sendMessage(from, `❌ *${itemName}* not found in your cart.`);
            await sendMessage(from, await getCartMessage(session));
            return res.sendStatus(200);
          }

          const updatedItems = session.items
            .map(i => i.menuItemId === existingItem.menuItemId
              ? { ...i, quantity: i.quantity - 1 }
              : i
            )
            .filter(i => i.quantity > 0);

          const newTotal = updatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
          const updatedSession = { ...session, items: updatedItems, total: newTotal };
          await setSession(from, updatedSession);

          await sendMessage(from, `🗑️ Removed one *${existingItem.name}* from cart.`);
          await showMenu(from, session.locationId!, updatedSession);
          return res.sendStatus(200);
        }

        if (upper === 'CHECKOUT' || upper === 'ORDER') {
          if (session.items.length === 0) {
            await sendMessage(from, '🛒 Your cart is empty. Please select items from the menu first.');
            await showMenu(from, session.locationId!, session);
            return res.sendStatus(200);
          }

          await setSession(from, { ...session, status: 'awaiting_confirmation' });

          const itemList = session.items
            .map(i => `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}`)
            .join('\n');

          await sendMessage(
            from,
            `✅ *Order Summary:*\n\n${itemList}\n\n*Total: $${session.total.toFixed(2)}*\n\nType *YES* to confirm or *BACK* to return to menu.`
          );
          return res.sendStatus(200);
        }

        // Fallback — AI parsing for natural language
        const parsed = await parseOrder(text);
        if (parsed.intent === 'cancel') {
          await clearSession(from);
          await sendMessage(from, '❌ Order cancelled. Send any message to start again.');
          return res.sendStatus(200);
        }

        await sendMessage(from, 'Use the buttons below or type *REMOVE [item]* to remove an item from your cart.');
        await showMenu(from, session.locationId!, session);
        return res.sendStatus(200);
      }

      // New conversation — welcome message
      await sendMessage(from, '👋 Welcome! Let\'s get your order started.');
      await startLocationSelection(from);
    }
  }

  res.sendStatus(200);
});