import { prisma } from '../lib/prisma';
import { OrderSession } from '../lib/session';

export async function createOrder(phone: string, session: OrderSession) {
  return prisma.order.create({
    data: {
      customerPhone: phone,
      locationId: session.locationId,
      totalPrice: session.total,
      status: 'CONFIRMED',
      items: {
        create: session.items.map(item => ({
          quantity: item.quantity,
          price: item.price,
          menuItemId: item.menuItemId,
        })),
      },
    },
    include: { items: true },
  });
}