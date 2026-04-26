import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { captureException } from '../lib/sentry';
import { parseOrder } from '../bot/ai';
import { sendMessage, sendInteractiveList, sendQuickActions, sendPostOrderActions } from '../bot/messenger';
import { findMenuItemById, getMenuGroupedByCategory, getAllLocations } from '../menu/menu.service';
import { getSession, setSession, clearSession, OrderSession } from '../lib/session';
import { createOrder, getOrdersByPhone } from '../order/order.service';
import { createPaymentLink } from '../payment/payment.service';
import { validatePromoCode, incrementPromoUsage } from '../promo/promo.service';
import { t, Language } from '../lib/i18n';
import { getPoints, earnPoints, redeemPoints } from '../loyalty/loyalty.service';
import { prisma } from '../lib/prisma';

export const webhookRouter = Router();

webhookRouter.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

async function showMenu(to: string, locationId: number, session: OrderSession) {
  const lang = session.language ?? 'en';
  const tr = t(lang);
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
    ? `\n\n${tr.cartLabel}\n${session.items.map(i => {
        const noteLine = i.notes ? ` _(${i.notes})_` : '';
        return `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}${noteLine}`;
      }).join('\n')}\n${tr.orderTotal(session.total)}`
    : `\n\n${tr.cartEmptyLabel}`;

  const hint = session.items.length > 0
    ? `\n\n${tr.removeHint}`
    : '';

  await sendInteractiveList(
    to,
    `${lang === 'tr' ? 'Menümüz! Ürün eklemek için seçin.' : 'Our menu! Tap an item to add it to your cart.'}${cartSummary}${hint}`,
    lang === 'tr' ? 'Menüyü Gör' : 'View Menu',
    sections,
  );

  await sendQuickActions(to, session.items.length > 0, {
    body: lang === 'tr' ? 'Ne yapmak istersiniz?' : 'What would you like to do?',
    checkout: lang === 'tr' ? '✅ Sipariş Ver' : '✅ Checkout',
    clearCart: lang === 'tr' ? '🗑️ Sepeti Temizle' : '🗑️ Clear Cart',
    menu: lang === 'tr' ? '📋 Menü' : '📋 Menu',
  });
}

async function getCartMessage(session: OrderSession): Promise<string> {
  const lang = session.language ?? 'en';
  const tr = t(lang);

  if (session.items.length === 0) return tr.cartEmptyLabel;

  const itemList = session.items
    .map(i => {
      const noteLine = i.notes ? ` _(${i.notes})_` : '';
      return `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}${noteLine}`;
    })
    .join('\n');

  return `${tr.cartLabel}\n\n${itemList}\n\n${tr.orderTotal(session.total)}\n\n${tr.removeHint}`;
}

async function startLocationSelection(from: string, lang: Language) {
  const tr = t(lang);
  const locations = await getAllLocations();
  const locationList = locations
    .map((l, i) => `${i + 1}. ${l.name} — ${l.address}`)
    .join('\n');

  await setSession(from, { language: lang, status: 'selecting_location', items: [], total: 0 });
  await sendMessage(from, `${tr.selectLocation}\n\n${locationList}`);
}

function buildOrderSummary(session: OrderSession): string {
  const lang = session.language ?? 'en';
  const tr = t(lang);

  const itemList = session.items
    .map(i => {
      const noteLine = i.notes ? `\n  📝 ${i.notes}` : '';
      return `• ${i.quantity}x ${i.name} — $${(i.price * i.quantity).toFixed(2)}${noteLine}`;
    })
    .join('\n');

  const discountLine = session.discountAmount
    ? `\n${lang === 'tr' ? 'Promo indirimi' : 'Promo discount'}: -$${session.discountAmount.toFixed(2)}`
    : '';
  const loyaltyLine = session.loyaltyDiscount
    ? `\n${lang === 'tr' ? 'Puan indirimi' : 'Points discount'}: -$${session.loyaltyDiscount.toFixed(2)}`
    : '';

  return `${tr.orderSummaryHeader}\n\n${itemList}${discountLine}${loyaltyLine}\n\n${tr.orderTotal(session.total)}\n\n${tr.confirmPrompt}`;
}

function postOrderLabels(lang: Language) {
  return {
    body: lang === 'tr' ? 'Ne yapmak istersiniz?' : 'What would you like to do next?',
    newOrder: lang === 'tr' ? '🍔 Yeni Sipariş' : '🍔 New Order',
    reorder: lang === 'tr' ? '🔄 Tekrarla' : '🔄 Reorder',
    myOrders: lang === 'tr' ? '📦 Siparişlerim' : '📦 My Orders',
  };
}

webhookRouter.post('/', async (req: Request, res: Response) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!sig || !rawBody) {
      return res.sendStatus(403);
    }
    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      logger.warn('Invalid WhatsApp webhook signature');
      return res.sendStatus(403);
    }
  }

  const body = req.body;

  try {
  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const session = await getSession(from);
      const lang: Language = session?.language ?? 'en';
      const tr = t(lang);

      // Handle interactive messages (button replies and list replies)
      if (message.type === 'interactive') {
        const buttonId = message.interactive?.button_reply?.id as string;
        const selectedId = message.interactive?.list_reply?.id as string;

        // Handle button replies
        if (buttonId) {
          // Quick action buttons (browsing menu)
          if (buttonId === 'action_checkout') {
            if (!session?.items.length) {
              await sendMessage(from, tr.cartEmpty);
              await showMenu(from, session!.locationId!, session!);
            } else {
              await setSession(from, { ...session!, status: 'awaiting_confirmation' });
              await sendMessage(from, buildOrderSummary(session!));
            }
          } else if (buttonId === 'action_clear') {
            const clearedSession = { ...session!, items: [], total: 0 };
            await setSession(from, clearedSession);
            await sendMessage(from, tr.cartCleared);
            await showMenu(from, session!.locationId!, clearedSession);
          } else if (buttonId === 'action_menu') {
            await showMenu(from, session!.locationId!, session!);

          // Post-order buttons
          } else if (buttonId === 'post_new_order') {
            await startLocationSelection(from, lang);
          } else if (buttonId === 'post_reorder') {
            const orders = await getOrdersByPhone(from);
            if (orders.length === 0) {
              await sendMessage(from, tr.noReorder);
              await sendPostOrderActions(from, postOrderLabels(lang));
            } else {
              const lastOrder = orders[0];
              const items = lastOrder.items.map(i => ({
                name: i.menuItem.name,
                quantity: i.quantity,
                price: i.price,
                menuItemId: i.menuItemId,
              }));
              const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
              const reorderSession: OrderSession = {
                language: lang,
                locationId: lastOrder.locationId,
                items,
                total,
                status: 'browsing_menu',
              };
              await setSession(from, reorderSession);
              const itemList = items.map(i => `• ${i.quantity}x ${i.name}`).join('\n');
              await sendMessage(from, `🔄 *${lang === 'tr' ? 'Önceki sipariş yüklendi' : 'Last order loaded'}!*\n📍 ${lastOrder.location.name}\n\n${itemList}\n\n${tr.orderTotal(total)}`);
              await showMenu(from, lastOrder.locationId, reorderSession);
            }
          } else if (buttonId === 'post_my_orders') {
            const orders = await getOrdersByPhone(from);

            if (orders.length === 0) {
              await sendMessage(from, tr.noOrders);
            } else {
              const orderList = orders.map(order => {
                const itemList = order.items
                  .map(i => `  • ${i.quantity}x ${i.menuItem.name}`)
                  .join('\n');
                const date = new Date(order.createdAt);
                const formatted = date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
                return `*${lang === 'tr' ? 'Sipariş' : 'Order'} #${order.id}* — ${order.status}\n🕐 ${formatted}\n${itemList}\n${tr.orderTotal(order.totalPrice)}\n📍 ${order.location.name}`;
              }).join('\n\n');

              await sendMessage(from, `${tr.ordersHeader}\n\n${orderList}`);
            }

            await sendPostOrderActions(from, postOrderLabels(lang));
          }

          return res.sendStatus(200);
        }

        // Handle menu item selection from list
        if (selectedId?.startsWith('item_') && session?.locationId) {
          const menuItemId = parseInt(selectedId.replace('item_', ''));
          const menuItem = await findMenuItemById(menuItemId);

          if (!menuItem) {
            await sendMessage(from, `❌ ${lang === 'tr' ? 'Ürün bulunamadı.' : 'Item not found. Please try again.'}`);
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
          await sendMessage(from, tr.itemAdded(qty, menuItem.name, newTotal));
          await showMenu(from, session.locationId, updatedSession);
        }

        return res.sendStatus(200);
      }

      const text = message.text?.body?.trim() ?? '';
      const upper = text.toUpperCase();
      logger.info('Message received', { from, text });

      // Language selection
      if (!session || session.status === 'selecting_language') {
        if (text === '1') {
          await startLocationSelection(from, 'en');
        } else if (text === '2') {
          await startLocationSelection(from, 'tr');
        } else {
          await setSession(from, { language: 'en', status: 'selecting_language', items: [], total: 0 });
          await sendMessage(from, t('en').welcome);
        }
        return res.sendStatus(200);
      }

      // Handle location selection
      if (session.status === 'selecting_location') {
        const locations = await getAllLocations();
        const selectedIndex = parseInt(text) - 1;

        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= locations.length) {
          const locationList = locations
            .map((l, i) => `${i + 1}. ${l.name} — ${l.address}`)
            .join('\n');
          await sendMessage(from, `${tr.invalidLocation}\n\n${locationList}`);
          return res.sendStatus(200);
        }

        const selectedLocation = locations[selectedIndex];
        const newSession: OrderSession = {

          language: lang,
          locationId: selectedLocation.id,
          items: [],
          total: 0,
          status: 'browsing_menu',
        };

        await setSession(from, newSession);
        await sendMessage(from, tr.locationSelected(selectedLocation.name));
        await showMenu(from, selectedLocation.id, newSession);
        return res.sendStatus(200);
      }

      // Handle order confirmation
      if (session.status === 'awaiting_confirmation') {
        if (upper === 'YES' || upper === 'EVET') {
          if (session.promoCode) await incrementPromoUsage(session.promoCode);
          const order = await createOrder(from, session);

          // Earn loyalty points on confirmed order
          const earned = await earnPoints(from, order.totalPrice);
          const newBalance = await getPoints(from);
          await prisma.order.update({ where: { id: order.id }, data: { pointsEarned: earned } });

          await setSession(from, { language: lang, status: 'post_order', items: [], total: 0 });
          const discountLine = session.discountAmount
            ? `\n${lang === 'tr' ? 'İndirim' : 'Discount'}: -$${session.discountAmount.toFixed(2)} (${session.promoCode})`
            : '';
          const loyaltyLine = session.loyaltyDiscount
            ? `\n${lang === 'tr' ? 'Puan indirimi' : 'Points discount'}: -$${session.loyaltyDiscount.toFixed(2)}`
            : '';
          await sendMessage(from, `${tr.orderConfirmed(order.id)}${discountLine}${loyaltyLine}\n${tr.orderTotal(order.totalPrice)}`);
          await sendMessage(from, tr.pointsEarned(earned, newBalance));
          const paymentUrl = await createPaymentLink(order.id, order.totalPrice);
          await sendMessage(from, tr.paymentLink(paymentUrl));
          await sendPostOrderActions(from, postOrderLabels(lang));
        } else if (upper === 'NO' || upper === 'BACK' || upper === 'HAYIR' || upper === 'GERİ' || upper === 'GERI') {
          await setSession(from, { ...session, status: 'browsing_menu' });
          await sendMessage(from, lang === 'tr' ? '↩️ Tamam! Sepetinize dönüyoruz.' : '↩️ No problem! Going back to your cart.');
          await showMenu(from, session.locationId!, { ...session, status: 'browsing_menu' });
        } else if (upper.startsWith('PROMO ')) {
          const code = text.slice(6).trim();
          const result = await validatePromoCode(code);
          if (!result.valid) {
            await sendMessage(from, `❌ ${result.error}`);
          } else {
            const discount = Math.round(session.total * result.discountPercent! / 100 * 100) / 100;
            const newTotal = Math.max(0, Math.round((session.total - discount) * 100) / 100);
            await setSession(from, { ...session, promoCode: code.toUpperCase(), discountAmount: discount, total: newTotal });
            await sendMessage(from, tr.promoApplied(code.toUpperCase(), discount, newTotal));
          }
        } else {
          const hint = lang === 'tr'
            ? `*EVET* yazarak onaylayın, *GERİ* ile menüye dönün veya *PROMO [kod]* ile indirim uygulayın.`
            : `Type *YES* to confirm, *BACK* to return to menu, or *PROMO [code]* to apply a discount.`;
          await sendMessage(from, hint);
        }

        return res.sendStatus(200);
      }

      // Handle post-order state (text fallback if buttons not tapped)
      if (session.status === 'post_order') {
        await sendPostOrderActions(from, postOrderLabels(lang));
        return res.sendStatus(200);
      }

      // Handle commands while browsing menu
      if (session.status === 'browsing_menu') {
        if (upper === 'POINTS' || upper === 'PUAN') {
          const pts = await getPoints(from);
          await sendMessage(from, pts === 0 ? tr.noPoints : tr.pointsBalance(pts));
          return res.sendStatus(200);
        }

        if (upper === 'REDEEM' || upper === 'KULLAN') {
          const pts = await getPoints(from);
          if (pts < 100) {
            await sendMessage(from, pts === 0 ? tr.noPoints : tr.notEnoughPoints(pts));
            return res.sendStatus(200);
          }
          const result = await redeemPoints(from);
          if (!result) {
            await sendMessage(from, tr.notEnoughPoints(pts));
            return res.sendStatus(200);
          }
          const newTotal = Math.max(0, Math.round((session.total - result.discount) * 100) / 100);
          const updatedSession = {
            ...session,
            loyaltyDiscount: (session.loyaltyDiscount ?? 0) + result.discount,
            loyaltyPointsUsed: (session.loyaltyPointsUsed ?? 0) + result.pointsUsed,
            total: newTotal,
          };
          await setSession(from, updatedSession);
          const remaining = await getPoints(from);
          await sendMessage(from, tr.pointsRedeemed(result.discount, result.pointsUsed, remaining));
          return res.sendStatus(200);
        }

        if (upper === 'CART' || upper === 'SEPET') {
          await sendMessage(from, await getCartMessage(session));
          return res.sendStatus(200);
        }

        if (upper === 'MENU' || upper === 'MENÜ' || upper === 'MENU') {
          await showMenu(from, session.locationId!, session);
          return res.sendStatus(200);
        }

        if (upper === 'CLEAR' || upper === 'RESET' || upper === 'TEMİZLE' || upper === 'TEMIZLE') {
          const clearedSession = { ...session, items: [], total: 0 };
          await setSession(from, clearedSession);
          await sendMessage(from, tr.cartCleared);
          await showMenu(from, session.locationId!, clearedSession);
          return res.sendStatus(200);
        }

        if (upper.startsWith('REMOVE ') || upper.startsWith('KALDIR ')) {
          const prefix = upper.startsWith('REMOVE ') ? 'REMOVE ' : 'KALDIR ';
          const itemName = text.slice(prefix.length).trim();
          const existingItem = session.items.find(i =>
            i.name.toLowerCase().includes(itemName.toLowerCase())
          );

          if (!existingItem) {
            await sendMessage(from, tr.itemNotFound(itemName));
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

          await sendMessage(from, tr.itemRemoved(existingItem.name));
          await showMenu(from, session.locationId!, updatedSession);
          return res.sendStatus(200);
        }

        if (upper.startsWith('NOTE ') || upper.startsWith('NOT ')) {
          const prefix = upper.startsWith('NOTE ') ? 'NOTE ' : 'NOT ';
          const noteBody = text.slice(prefix.length).trim();
          const colonIndex = noteBody.indexOf(':');
          if (colonIndex === -1) {
            await sendMessage(from, tr.noteFormat);
            return res.sendStatus(200);
          }
          const itemName = noteBody.slice(0, colonIndex).trim();
          const noteText = noteBody.slice(colonIndex + 1).trim();

          const existingItem = session.items.find(i =>
            i.name.toLowerCase().includes(itemName.toLowerCase())
          );

          if (!existingItem) {
            await sendMessage(from, tr.noteItemNotFound(itemName));
            await sendMessage(from, await getCartMessage(session));
            return res.sendStatus(200);
          }

          const updatedItems = session.items.map(i =>
            i.menuItemId === existingItem.menuItemId ? { ...i, notes: noteText } : i
          );
          const updatedSession = { ...session, items: updatedItems };
          await setSession(from, updatedSession);
          await sendMessage(from, tr.noteAdded(existingItem.name, noteText));
          return res.sendStatus(200);
        }

        if (upper === 'CHECKOUT' || upper === 'ORDER' || upper === 'SİPARİŞ' || upper === 'SIPARIS') {
          if (session.items.length === 0) {
            await sendMessage(from, tr.cartEmpty);
            await showMenu(from, session.locationId!, session);
            return res.sendStatus(200);
          }

          await setSession(from, { ...session, status: 'awaiting_confirmation' });
          await sendMessage(from, buildOrderSummary(session));
          return res.sendStatus(200);
        }

        // Fallback — AI parsing for natural language
        const parsed = await parseOrder(text);
        if (parsed.intent === 'cancel') {
          await clearSession(from);
          await sendMessage(from, lang === 'tr' ? '❌ Sipariş iptal edildi. Yeni sipariş için mesaj gönderin.' : '❌ Order cancelled. Send any message to start again.');
          return res.sendStatus(200);
        }

        await sendMessage(from, tr.invalidOption);
        await showMenu(from, session.locationId!, session);
        return res.sendStatus(200);
      }
    }
  }

  res.sendStatus(200);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Webhook handler error', { error: error.message, stack: error.stack });
    captureException(error);
    res.sendStatus(500);
  }
});
