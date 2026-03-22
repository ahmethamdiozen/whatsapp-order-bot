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

export async function sendQuickActions(to: string, hasItems: boolean): Promise<void> {
  const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;

  if (!hasItems) return; // Sepet boşken buton gönderme

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
        body: { text: 'What would you like to do?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'action_checkout', title: '✅ Checkout' } },
            { type: 'reply', reply: { id: 'action_clear', title: '🗑️ Clear Cart' } },
            { type: 'reply', reply: { id: 'action_menu', title: '📋 Menu' } },
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

export async function sendPostOrderActions(to: string): Promise<void> {
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
        body: { text: 'What would you like to do next?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'post_new_order', title: '🍔 New Order' } },
            { type: 'reply', reply: { id: 'post_my_orders', title: '📦 My Orders' } },
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