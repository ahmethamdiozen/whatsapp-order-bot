jest.mock('../../src/lib/session');
jest.mock('../../src/menu/menu.service');
jest.mock('../../src/order/order.service');
jest.mock('../../src/bot/messenger');
jest.mock('../../src/bot/ai');
jest.mock('../../src/payment/payment.service');
jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/lib/redis', () => ({ redis: {} }));
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({})));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({})));

import request from 'supertest';
import { app } from '../../src/app';
import { getSession, setSession, clearSession } from '../../src/lib/session';
import { getAllLocations, getMenuGroupedByCategory, findMenuItemById } from '../../src/menu/menu.service';
import { createOrder, getOrdersByPhone } from '../../src/order/order.service';
import { sendMessage, sendInteractiveList, sendQuickActions, sendPostOrderActions } from '../../src/bot/messenger';
import { parseOrder } from '../../src/bot/ai';
import { createPaymentLink } from '../../src/payment/payment.service';

const mockGetSession = getSession as jest.Mock;
const mockSetSession = setSession as jest.Mock;
const mockClearSession = clearSession as jest.Mock;
const mockGetAllLocations = getAllLocations as jest.Mock;
const mockGetMenuGroupedByCategory = getMenuGroupedByCategory as jest.Mock;
const mockFindMenuItemById = findMenuItemById as jest.Mock;
const mockCreateOrder = createOrder as jest.Mock;
const mockGetOrdersByPhone = getOrdersByPhone as jest.Mock;
const mockSendMessage = sendMessage as jest.Mock;
const mockSendInteractiveList = sendInteractiveList as jest.Mock;
const mockSendQuickActions = sendQuickActions as jest.Mock;
const mockSendPostOrderActions = sendPostOrderActions as jest.Mock;
const mockParseOrder = parseOrder as jest.Mock;
const mockCreatePaymentLink = createPaymentLink as jest.Mock;

const FROM = '+905001234567';

const mockLocations = [
  { id: 1, name: 'Downtown', address: '123 Main St' },
  { id: 2, name: 'Uptown', address: '456 Oak Ave' },
];

const mockGroupedMenu = {
  Mains: [{ id: 1, name: 'Burger', price: 9.99, description: 'Juicy' }],
  Drinks: [{ id: 2, name: 'Coke', price: 2.99, description: 'Cold' }],
};

function textMessage(text: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ from: FROM, type: 'text', text: { body: text } }] } }] }],
  };
}

function buttonMessage(buttonId: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ from: FROM, type: 'interactive', interactive: { button_reply: { id: buttonId } } }] } }] }],
  };
}

function listMessage(selectedId: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ from: FROM, type: 'interactive', interactive: { list_reply: { id: selectedId } } }] } }] }],
  };
}

beforeEach(() => {
  mockSetSession.mockResolvedValue(undefined);
  mockClearSession.mockResolvedValue(undefined);
  mockSendMessage.mockResolvedValue(undefined);
  mockSendInteractiveList.mockResolvedValue(undefined);
  mockSendQuickActions.mockResolvedValue(undefined);
  mockSendPostOrderActions.mockResolvedValue(undefined);
  mockGetAllLocations.mockResolvedValue(mockLocations);
  mockGetMenuGroupedByCategory.mockResolvedValue(mockGroupedMenu);
  mockCreatePaymentLink.mockResolvedValue('https://checkout.stripe.com/pay/test');
});

// ─── Webhook Verification ────────────────────────────────────────────────────

describe('GET /webhook — verification', () => {
  it('returns challenge when token matches', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': 'abc123',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('abc123');
  });

  it('returns 403 when token does not match', async () => {
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'abc123',
    });
    expect(res.status).toBe(403);
  });
});

// ─── New User ────────────────────────────────────────────────────────────────

describe('POST /webhook — new user (no session)', () => {
  it('sends welcome message and shows location selection', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await request(app).post('/webhook').send(textMessage('hello'));

    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('Welcome'));
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('Downtown'));
    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ status: 'selecting_location' }));
  });
});

// ─── Location Selection ──────────────────────────────────────────────────────

describe('POST /webhook — selecting_location', () => {
  const selectingSession = { status: 'selecting_location', items: [], total: 0 };

  it('selects a valid location and shows menu', async () => {
    mockGetSession.mockResolvedValue(selectingSession);

    const res = await request(app).post('/webhook').send(textMessage('1'));

    expect(res.status).toBe(200);
    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({
      locationId: mockLocations[0].id,
      status: 'browsing_menu',
    }));
    expect(mockSendInteractiveList).toHaveBeenCalled();
  });

  it('rejects invalid location number', async () => {
    mockGetSession.mockResolvedValue(selectingSession);

    const res = await request(app).post('/webhook').send(textMessage('9'));

    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('valid number'));
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('rejects non-numeric input', async () => {
    mockGetSession.mockResolvedValue(selectingSession);

    const res = await request(app).post('/webhook').send(textMessage('downtown'));

    expect(res.status).toBe(200);
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('valid number'));
  });
});

// ─── Browsing Menu ───────────────────────────────────────────────────────────

describe('POST /webhook — browsing_menu', () => {
  const browsingSession = { status: 'browsing_menu', locationId: 1, items: [], total: 0 };

  it('adds item to cart when list reply received', async () => {
    mockGetSession.mockResolvedValue(browsingSession);
    mockFindMenuItemById.mockResolvedValue({ id: 1, name: 'Burger', price: 9.99 });

    const res = await request(app).post('/webhook').send(listMessage('item_1'));

    expect(res.status).toBe(200);
    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({
      items: [expect.objectContaining({ name: 'Burger', quantity: 1 })],
      total: 9.99,
    }));
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('Burger'));
  });

  it('increments quantity when same item added again', async () => {
    const sessionWithItem = {
      ...browsingSession,
      items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
      total: 9.99,
    };
    mockGetSession.mockResolvedValue(sessionWithItem);
    mockFindMenuItemById.mockResolvedValue({ id: 1, name: 'Burger', price: 9.99 });

    await request(app).post('/webhook').send(listMessage('item_1'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({
      items: [expect.objectContaining({ quantity: 2 })],
      total: 19.98,
    }));
  });

  it('responds with error when item not found', async () => {
    mockGetSession.mockResolvedValue(browsingSession);
    mockFindMenuItemById.mockResolvedValue(null);

    await request(app).post('/webhook').send(listMessage('item_999'));

    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('not found'));
  });

  it('CART command shows cart contents', async () => {
    const sessionWithItem = {
      ...browsingSession,
      items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
      total: 9.99,
    };
    mockGetSession.mockResolvedValue(sessionWithItem);

    await request(app).post('/webhook').send(textMessage('CART'));

    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('Burger'));
  });

  it('MENU command shows menu', async () => {
    mockGetSession.mockResolvedValue(browsingSession);

    await request(app).post('/webhook').send(textMessage('MENU'));

    expect(mockSendInteractiveList).toHaveBeenCalled();
  });

  it('CLEAR command empties cart', async () => {
    const sessionWithItem = {
      ...browsingSession,
      items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
      total: 9.99,
    };
    mockGetSession.mockResolvedValue(sessionWithItem);

    await request(app).post('/webhook').send(textMessage('CLEAR'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ items: [], total: 0 }));
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('cleared'));
  });

  it('REMOVE command removes one item from cart', async () => {
    const sessionWithItems = {
      ...browsingSession,
      items: [
        { name: 'Burger', quantity: 2, price: 9.99, menuItemId: 1 },
        { name: 'Coke', quantity: 1, price: 2.99, menuItemId: 2 },
      ],
      total: 22.97,
    };
    mockGetSession.mockResolvedValue(sessionWithItems);

    await request(app).post('/webhook').send(textMessage('REMOVE Burger'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ name: 'Burger', quantity: 1 })]),
    }));
  });

  it('REMOVE command removes item entirely when quantity is 1', async () => {
    const sessionWithItem = {
      ...browsingSession,
      items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
      total: 9.99,
    };
    mockGetSession.mockResolvedValue(sessionWithItem);

    await request(app).post('/webhook').send(textMessage('REMOVE Burger'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ items: [], total: 0 }));
  });

  it('REMOVE responds with error when item not in cart', async () => {
    mockGetSession.mockResolvedValue(browsingSession);

    await request(app).post('/webhook').send(textMessage('REMOVE Pizza'));

    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('not found'));
  });

  it('CHECKOUT with empty cart shows warning', async () => {
    mockGetSession.mockResolvedValue(browsingSession);

    await request(app).post('/webhook').send(textMessage('CHECKOUT'));

    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('empty'));
  });

  it('CHECKOUT with items moves to awaiting_confirmation', async () => {
    const sessionWithItem = {
      ...browsingSession,
      items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
      total: 9.99,
    };
    mockGetSession.mockResolvedValue(sessionWithItem);

    await request(app).post('/webhook').send(textMessage('CHECKOUT'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ status: 'awaiting_confirmation' }));
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('Order Summary'));
  });

  it('cancel AI intent clears session', async () => {
    mockGetSession.mockResolvedValue(browsingSession);
    mockParseOrder.mockResolvedValue({ intent: 'cancel', items: [], rawMessage: 'cancel' });

    await request(app).post('/webhook').send(textMessage('cancel everything'));

    expect(mockClearSession).toHaveBeenCalledWith(FROM);
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('cancelled'));
  });

  it('checkout button moves to awaiting_confirmation', async () => {
    const sessionWithItem = {
      ...browsingSession,
      items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
      total: 9.99,
    };
    mockGetSession.mockResolvedValue(sessionWithItem);

    await request(app).post('/webhook').send(buttonMessage('action_checkout'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ status: 'awaiting_confirmation' }));
  });

  it('checkout button with empty cart shows warning', async () => {
    mockGetSession.mockResolvedValue(browsingSession);

    await request(app).post('/webhook').send(buttonMessage('action_checkout'));

    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('empty'));
  });

  it('clear button empties cart', async () => {
    const sessionWithItem = {
      ...browsingSession,
      items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
      total: 9.99,
    };
    mockGetSession.mockResolvedValue(sessionWithItem);

    await request(app).post('/webhook').send(buttonMessage('action_clear'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ items: [], total: 0 }));
  });

  it('menu button shows menu', async () => {
    mockGetSession.mockResolvedValue(browsingSession);

    await request(app).post('/webhook').send(buttonMessage('action_menu'));

    expect(mockSendInteractiveList).toHaveBeenCalled();
  });
});

// ─── Awaiting Confirmation ───────────────────────────────────────────────────

describe('POST /webhook — awaiting_confirmation', () => {
  const confirmingSession = {
    status: 'awaiting_confirmation',
    locationId: 1,
    items: [{ name: 'Burger', quantity: 1, price: 9.99, menuItemId: 1 }],
    total: 9.99,
  };

  it('YES creates order and sends payment link', async () => {
    mockGetSession.mockResolvedValue(confirmingSession);
    mockCreateOrder.mockResolvedValue({ id: 42, totalPrice: 9.99 });

    await request(app).post('/webhook').send(textMessage('YES'));

    expect(mockCreateOrder).toHaveBeenCalledWith(FROM, confirmingSession);
    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ status: 'post_order' }));
    expect(mockCreatePaymentLink).toHaveBeenCalledWith(42, 9.99);
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('payment'));
    expect(mockSendPostOrderActions).toHaveBeenCalledWith(FROM);
  });

  it('NO returns to browsing menu', async () => {
    mockGetSession.mockResolvedValue(confirmingSession);

    await request(app).post('/webhook').send(textMessage('NO'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ status: 'browsing_menu' }));
    expect(mockSendInteractiveList).toHaveBeenCalled();
  });

  it('BACK returns to browsing menu', async () => {
    mockGetSession.mockResolvedValue(confirmingSession);

    await request(app).post('/webhook').send(textMessage('BACK'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ status: 'browsing_menu' }));
  });

  it('other text prompts for YES or BACK', async () => {
    mockGetSession.mockResolvedValue(confirmingSession);

    await request(app).post('/webhook').send(textMessage('maybe'));

    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('YES'));
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});

// ─── Post-Order ──────────────────────────────────────────────────────────────

describe('POST /webhook — post_order', () => {
  const postOrderSession = { status: 'post_order', items: [], total: 0 };

  it('any text re-sends post-order buttons', async () => {
    mockGetSession.mockResolvedValue(postOrderSession);

    await request(app).post('/webhook').send(textMessage('thanks'));

    expect(mockSendPostOrderActions).toHaveBeenCalledWith(FROM);
  });

  it('New Order button starts location selection', async () => {
    mockGetSession.mockResolvedValue(postOrderSession);

    await request(app).post('/webhook').send(buttonMessage('post_new_order'));

    expect(mockSetSession).toHaveBeenCalledWith(FROM, expect.objectContaining({ status: 'selecting_location' }));
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('select a branch'));
  });

  it('My Orders button shows order history', async () => {
    mockGetSession.mockResolvedValue(postOrderSession);
    mockGetOrdersByPhone.mockResolvedValue([
      {
        id: 1,
        status: 'DELIVERED',
        totalPrice: 9.99,
        createdAt: new Date('2026-03-01T10:00:00Z'),
        location: { name: 'Downtown' },
        items: [{ quantity: 1, menuItem: { name: 'Burger' } }],
      },
    ]);

    await request(app).post('/webhook').send(buttonMessage('post_my_orders'));

    expect(mockGetOrdersByPhone).toHaveBeenCalledWith(FROM);
    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('Order #1'));
    expect(mockSendPostOrderActions).toHaveBeenCalledWith(FROM);
  });

  it('My Orders button shows message when no orders', async () => {
    mockGetSession.mockResolvedValue(postOrderSession);
    mockGetOrdersByPhone.mockResolvedValue([]);

    await request(app).post('/webhook').send(buttonMessage('post_my_orders'));

    expect(mockSendMessage).toHaveBeenCalledWith(FROM, expect.stringContaining('no previous orders'));
  });
});
