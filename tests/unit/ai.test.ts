const mockMessagesCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
);

import { parseOrder } from '../../src/bot/ai';

function makeResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('AI Parser', () => {
  describe('parseOrder', () => {
    it('parses a simple order', async () => {
      mockMessagesCreate.mockResolvedValue(
        makeResponse(JSON.stringify({ intent: 'order', items: [{ name: 'Burger', quantity: 1 }], rawMessage: 'I want a burger' })),
      );

      const result = await parseOrder('I want a burger');

      expect(result.intent).toBe('order');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Burger');
      expect(result.items[0].quantity).toBe(1);
    });

    it('parses an order with multiple items and quantities', async () => {
      mockMessagesCreate.mockResolvedValue(
        makeResponse(JSON.stringify({
          intent: 'order',
          items: [{ name: 'Burger', quantity: 2 }, { name: 'Coke', quantity: 3 }],
          rawMessage: '2 burgers and 3 cokes',
        })),
      );

      const result = await parseOrder('2 burgers and 3 cokes');

      expect(result.items).toHaveLength(2);
      expect(result.items[1].quantity).toBe(3);
    });

    it('strips markdown code blocks from response', async () => {
      mockMessagesCreate.mockResolvedValue(
        makeResponse('```json\n{"intent":"order","items":[{"name":"Fries","quantity":2}],"rawMessage":"2 fries"}\n```'),
      );

      const result = await parseOrder('2 fries');

      expect(result.intent).toBe('order');
      expect(result.items[0].name).toBe('Fries');
    });

    it('returns cancel intent for cancellation messages', async () => {
      mockMessagesCreate.mockResolvedValue(
        makeResponse(JSON.stringify({ intent: 'cancel', items: [], rawMessage: 'cancel my order' })),
      );

      const result = await parseOrder('cancel my order');

      expect(result.intent).toBe('cancel');
    });

    it('returns question intent', async () => {
      mockMessagesCreate.mockResolvedValue(
        makeResponse(JSON.stringify({ intent: 'question', items: [], rawMessage: 'What time do you close?' })),
      );

      const result = await parseOrder('What time do you close?');

      expect(result.intent).toBe('question');
    });

    it('falls back to other intent on invalid JSON', async () => {
      mockMessagesCreate.mockResolvedValue(makeResponse('not valid json'));

      const result = await parseOrder('something weird');

      expect(result.intent).toBe('other');
      expect(result.items).toEqual([]);
      expect(result.rawMessage).toBe('something weird');
    });

    it('falls back gracefully on non-text content type', async () => {
      mockMessagesCreate.mockResolvedValue({ content: [{ type: 'tool_use', id: 'x' }] });

      const result = await parseOrder('something');

      expect(result.intent).toBe('other');
    });
  });
});
