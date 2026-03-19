import Anthropic from "@anthropic-ai/sdk";
import { ParsedOrder } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are an AI assistant for a restaurant ordering system.
Your job is to analyze customer messages and extract order information.

Rules:
- If the message contains any food or drink items, ALWAYS set intent to "order"
- Extract item names and quantities accurately
- If quantity is not specified, assume 1
- For cancellations set intent to "cancel"
- For questions set intent to "question"
- For everything else set intent to "other"

Respond ONLY with a JSON object, no extra text:
{
  "intent": "order" | "question" | "cancel" | "other",
  "items": [{ "name": "item name", "quantity": 1, "notes": "optional special requests" }],
  "rawMessage": "original message"
}`;

export async function parseOrder(message: string): Promise<ParsedOrder> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: message }],
  });

    console.log('Sending to Claude:', message);
    console.log('Response raw:', JSON.stringify(response.content, null, 2));

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(clean) as ParsedOrder;
  } catch {
    return {
      intent: 'other',
      items: [],
      rawMessage: message,
    };
  }
}