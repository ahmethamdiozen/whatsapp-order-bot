import * as dotenv from 'dotenv';
dotenv.config({ path: `${__dirname}/../.env` });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const locations = await prisma.location.createMany({
    data: [
      { name: 'Downtown Branch', address: '123 Main St', phone: '+1234567890' },
      { name: 'Airport Branch', address: '456 Airport Rd', phone: '+1234567891' },
      { name: 'Mall Branch', address: '789 Mall Ave', phone: '+1234567892' },
    ],
  });

  console.log('Seeded locations:', locations.count);

  // Get all locations to assign menu items
  const allLocations = await prisma.location.findMany();

  for (const location of allLocations) {
    await prisma.menuItem.createMany({
      data: [
        { name: 'Burger', description: 'Classic beef burger', price: 12.99, category: 'Main', locationId: location.id },
        { name: 'Cheeseburger', description: 'Burger with cheese', price: 14.99, category: 'Main', locationId: location.id },
        { name: 'Fries', description: 'Crispy french fries', price: 4.99, category: 'Side', locationId: location.id },
        { name: 'Coke', description: 'Cold coca-cola', price: 2.99, category: 'Drink', locationId: location.id },
        { name: 'Water', description: 'Mineral water', price: 1.99, category: 'Drink', locationId: location.id },
      ],
    });
  }

  console.log('Seeded menu items for all locations');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());