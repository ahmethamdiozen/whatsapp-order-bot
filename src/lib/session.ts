import { redis } from './redis';

export interface OrderSession {
  locationId?: number;
  items: {
    name: string;
    quantity: number;
    price: number;
    menuItemId: number;
  }[];
  total: number;
  status: 'selecting_location' | 'awaiting_confirmation' | 'confirmed' | 'cancelled';
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