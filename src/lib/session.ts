import { redis } from './redis';
import type { Language } from './i18n';

export interface OrderSession {
  locationId?: number;
  language?: Language;
  items: {
    name: string;
    quantity: number;
    price: number;
    menuItemId: number;
    notes?: string;
  }[];
  total: number;
  discountAmount?: number;
  promoCode?: string;
  status: 'selecting_language' | 'selecting_location' | 'browsing_menu' | 'awaiting_confirmation' | 'post_order' | 'confirmed' | 'cancelled';
}

export async function setSession(phone: string, session: OrderSession): Promise<void> {
  await redis.set(`session:${phone}`, JSON.stringify(session), 'EX', 3600);
}

export async function getSession(phone: string): Promise<OrderSession | null> {
  const data = await redis.get(`session:${phone}`);
  return data ? JSON.parse(data) : null;
}

export async function clearSession(phone: string): Promise<void> {
  await redis.del(`session:${phone}`);
}