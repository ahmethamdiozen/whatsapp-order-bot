import { Router, Request, Response, NextFunction } from 'express';
import { updateOrderStatus } from '../order/order.service';
import { sendMessage } from '../bot/messenger';
import { prisma } from '../lib/prisma';

export const adminRouter = Router();

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'] as const;
type OrderStatus = typeof VALID_STATUSES[number];

const STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  PREPARING: '👨‍🍳 Your order is being prepared!',
  READY:     '✅ Your order is ready! Come pick it up.',
  DELIVERED: '🎉 Your order has been delivered. Enjoy your meal!',
  CANCELLED: '❌ Your order has been cancelled. Please contact us for more information.',
};

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

adminRouter.use(authMiddleware);

adminRouter.patch('/orders/:id/status', async (req: Request, res: Response) => {
  const orderId = parseInt(req.params.id as string);
  const { status } = req.body as { status: OrderStatus };

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const order = await updateOrderStatus(orderId, status);

  const message = STATUS_MESSAGES[status];
  if (message) {
    await sendMessage(order.customerPhone, message);
  }

  res.json({ id: order.id, status: order.status });
});

adminRouter.get('/orders', async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      items: { include: { menuItem: true } },
      location: true,
    },
  });
  res.json(orders);
});
