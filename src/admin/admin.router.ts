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

// ─── Orders ──────────────────────────────────────────────────────────────────

adminRouter.get('/orders', async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: { include: { menuItem: true } },
      location: true,
    },
  });
  res.json(orders);
});

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

// ─── Locations ────────────────────────────────────────────────────────────────

adminRouter.get('/locations', async (_req: Request, res: Response) => {
  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(locations);
});

// ─── Menu Items ───────────────────────────────────────────────────────────────

adminRouter.get('/menu-items', async (req: Request, res: Response) => {
  const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;

  const items = await prisma.menuItem.findMany({
    where: locationId ? { locationId } : undefined,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  res.json(items);
});

adminRouter.post('/menu-items', async (req: Request, res: Response) => {
  const { name, description, price, category, locationId } = req.body;

  if (!name || !price || !category || !locationId) {
    return res.status(400).json({ error: 'name, price, category, and locationId are required' });
  }

  const item = await prisma.menuItem.create({
    data: { name, description, price: parseFloat(price), category, locationId: parseInt(locationId) },
  });
  res.status(201).json(item);
});

adminRouter.put('/menu-items/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { name, description, price, category } = req.body;

  const item = await prisma.menuItem.update({
    where: { id },
    data: { name, description, price: parseFloat(price), category },
  });
  res.json(item);
});

adminRouter.delete('/menu-items/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await prisma.menuItem.delete({ where: { id } });
  res.sendStatus(204);
});

adminRouter.patch('/menu-items/:id/availability', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { isAvailable } = req.body as { isAvailable: boolean };

  const item = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable },
  });
  res.json(item);
});

// ─── Stats ────────────────────────────────────────────────────────────────────

adminRouter.get('/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [
    totalRevenue,
    todayRevenue,
    thisWeekRevenue,
    totalOrders,
    todayOrders,
    ordersByStatus,
    popularItems,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'DELIVERED' },
      _sum: { totalPrice: true },
    }),
    prisma.order.aggregate({
      where: { status: 'DELIVERED', createdAt: { gte: todayStart } },
      _sum: { totalPrice: true },
    }),
    prisma.order.aggregate({
      where: { status: 'DELIVERED', createdAt: { gte: weekStart } },
      _sum: { totalPrice: true },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { createdAt: true, totalPrice: true, status: true },
    }),
  ]);

  // Populate popular item names
  const menuItemIds = popularItems.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, name: true },
  });
  const itemNameMap = Object.fromEntries(menuItems.map(i => [i.id, i.name]));

  // Build daily revenue for last 7 days
  const dailyMap: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const order of recentOrders) {
    if (order.status === 'DELIVERED') {
      const date = order.createdAt.toISOString().slice(0, 10);
      if (date in dailyMap) dailyMap[date] += order.totalPrice;
    }
  }
  const dailyRevenue = Object.entries(dailyMap)
    .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    revenue: {
      total: totalRevenue._sum.totalPrice ?? 0,
      today: todayRevenue._sum.totalPrice ?? 0,
      thisWeek: thisWeekRevenue._sum.totalPrice ?? 0,
    },
    orders: {
      total: totalOrders,
      today: todayOrders,
      byStatus: Object.fromEntries(ordersByStatus.map(s => [s.status, s._count.id])),
    },
    popularItems: popularItems.map(i => ({
      name: itemNameMap[i.menuItemId] ?? 'Unknown',
      totalQuantity: i._sum.quantity ?? 0,
    })),
    dailyRevenue,
  });
});
