import { Router, Request, Response } from 'express';
import { parseOrder } from '../bot/ai';
import { sendMessage } from '../bot/messenger';
import { findMenuItemByName } from '../menu/menu.service';

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
      const text = message.text?.body;
      console.log(`Message received - From: ${from}, Text: ${text}`);

      const parsed = await parseOrder(text);
      console.log('AI parsed:', JSON.stringify(parsed, null, 2));

      if (parsed.intent === 'order' && parsed.items.length > 0) {
        // Her item'ı menüde ara — locationId 1 şimdilik sabit
        const locationId = 1;
        const resolvedItems = await Promise.all(
          parsed.items.map(async (item) => {
            const menuItem = await findMenuItemByName(item.name, locationId);
            return { ...item, menuItem };
          })
        );

        const notFound = resolvedItems.filter(i => !i.menuItem);
        const found = resolvedItems.filter(i => i.menuItem);

        if (notFound.length > 0) {
          const names = notFound.map(i => i.name).join(', ');
          await sendMessage(from, `❌ Menüde bulunamadı: ${names}`);
          return res.sendStatus(200);
        }

        // Toplam fiyat hesapla
        const total = found.reduce((sum, i) => {
          return sum + (i.menuItem!.price * i.quantity);
        }, 0);

        const itemList = found
          .map(i => `${i.quantity}x ${i.menuItem!.name} — $${(i.menuItem!.price * i.quantity).toFixed(2)}`)
          .join('\n');

        await sendMessage(
          from,
          `✅ Siparişiniz:\n\n${itemList}\n\nToplam: $${total.toFixed(2)}\n\nOnaylamak için *EVET* yazın.`
        );
      }
    }
  }

  res.sendStatus(200);
});