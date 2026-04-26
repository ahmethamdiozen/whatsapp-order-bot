export async function sendMessage(to: string, text: string): Promise<void> {
  const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('WhatsApp send error:', error);
  }
}

export async function sendInteractiveList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[]
): Promise<void> {
  const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonLabel,
          sections,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('WhatsApp interactive list error:', error);
  }
}

export interface QuickActionLabels {
  body: string;
  checkout: string;
  clearCart: string;
  menu: string;
}

export interface PostOrderLabels {
  body: string;
  newOrder: string;
  reorder: string;
  myOrders: string;
}

export interface MessageTransport {
  sendText(to: string, text: string): Promise<void>;
  sendInteractiveList(to: string, bodyText: string, buttonLabel: string, sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]): Promise<void>;
  sendQuickActions(to: string, hasItems: boolean, labels?: QuickActionLabels): Promise<void>;
  sendPostOrderActions(to: string, labels?: PostOrderLabels): Promise<void>;
}

export async function sendQuickActions(
  to: string,
  hasItems: boolean,
  labels: QuickActionLabels = {
    body: 'What would you like to do?',
    checkout: '✅ Checkout',
    clearCart: '🗑️ Clear Cart',
    menu: '📋 Menu',
  }
): Promise<void> {
  const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;

  if (!hasItems) return;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: labels.body },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'action_checkout', title: labels.checkout } },
            { type: 'reply', reply: { id: 'action_clear', title: labels.clearCart } },
            { type: 'reply', reply: { id: 'action_menu', title: labels.menu } },
          ],
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('WhatsApp button error:', error);
  }
}

export async function sendPostOrderActions(
  to: string,
  labels: PostOrderLabels = {
    body: 'What would you like to do next?',
    newOrder: '🍔 New Order',
    reorder: '🔄 Reorder',
    myOrders: '📦 My Orders',
  }
): Promise<void> {
  const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: labels.body },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'post_new_order', title: labels.newOrder } },
            { type: 'reply', reply: { id: 'post_reorder', title: labels.reorder } },
            { type: 'reply', reply: { id: 'post_my_orders', title: labels.myOrders } },
          ],
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('WhatsApp post order error:', error);
  }
}