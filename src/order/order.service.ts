import { prisma } from '../lib/prisma';
import { OrderSession } from '../lib/session';

export async function createOrder(phone: string, session: OrderSession) {
    if (!session.locationId) {
        throw new Error('Location ID is required to create an order');
    }
  
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

export async function updateOrderStatus(orderId: number, status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED') {
  return prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
}

export async function updatePaymentStatus(orderId: number, paymentStatus: 'PAID' | 'FAILED') {
  return prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus },
  });
}

export async function getOrdersByPhone(phone: string) {
  return prisma.order.findMany({
    where: { customerPhone: phone },
    orderBy: { createdAt: 'desc' },
    take: 5, // Son 5 sipariş
    include: {
      items: {
        include: { menuItem: true },
      },
      location: true,
    },
  });
}