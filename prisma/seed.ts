import * as dotenv from 'dotenv';
dotenv.config({ path: `${__dirname}/../.env` });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEMO_PHONE = '15551234567';

async function main() {
  // Locations
  await prisma.location.createMany({
    data: [
      { name: 'Downtown Branch', address: '123 Main St', phone: '+1234567890' },
      { name: 'Airport Branch', address: '456 Airport Rd', phone: '+1234567891' },
    ],
    skipDuplicates: true,
  });

  const locations = await prisma.location.findMany({ orderBy: { id: 'asc' } });

  const menuItems = [
    // Burgers
    { name: 'Classic Burger', description: 'Beef patty, lettuce, tomato', price: 10.99, category: 'Burgers' },
    { name: 'Cheeseburger', description: 'Classic with cheddar', price: 11.99, category: 'Burgers' },
    { name: 'BBQ Burger', description: 'Smoky BBQ sauce, onion rings', price: 12.99, category: 'Burgers' },
    { name: 'Double Smash', description: 'Double beef, double cheese', price: 14.99, category: 'Burgers' },
    { name: 'Veggie Burger', description: 'Plant-based patty, avocado', price: 11.49, category: 'Burgers' },
    // Drinks
    { name: 'Cola', description: 'Chilled 330ml can', price: 2.49, category: 'Drinks' },
    { name: 'Lemonade', description: 'Freshly squeezed', price: 3.49, category: 'Drinks' },
    { name: 'Milkshake', description: 'Chocolate, vanilla or strawberry', price: 4.99, category: 'Drinks' },
    { name: 'Iced Tea', description: 'Peach or lemon', price: 2.99, category: 'Drinks' },
    { name: 'Water', description: 'Still mineral water 500ml', price: 1.49, category: 'Drinks' },
    // Desserts
    { name: 'Brownie', description: 'Warm chocolate fudge brownie', price: 4.49, category: 'Desserts' },
    { name: 'Ice Cream', description: 'Two scoops, choice of flavour', price: 3.99, category: 'Desserts' },
    { name: 'Apple Pie', description: 'Served warm with cream', price: 4.99, category: 'Desserts' },
    { name: 'Cheesecake', description: 'New York style', price: 5.49, category: 'Desserts' },
    { name: 'Cookie', description: 'Double chocolate chip', price: 2.49, category: 'Desserts' },
  ];

  for (const location of locations) {
    await prisma.menuItem.createMany({
      data: menuItems.map(item => ({ ...item, locationId: location.id })),
      skipDuplicates: true,
    });
  }

  console.log(`Seeded ${locations.length} locations × ${menuItems.length} items`);

  // Promo code
  await prisma.promoCode.upsert({
    where: { code: 'DEMO20' },
    update: {},
    create: {
      code: 'DEMO20',
      discountPercent: 20,
      usageLimit: 1000,
      isActive: true,
    },
  });

  console.log('Seeded promo code DEMO20');

  // Demo loyalty account
  await prisma.loyaltyAccount.upsert({
    where: { phone: DEMO_PHONE },
    update: {},
    create: {
      phone: DEMO_PHONE,
      points: 100,
      totalEarned: 100,
    },
  });

  console.log(`Seeded loyalty account for ${DEMO_PHONE} with 100 points`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
