import * as dotenv from 'dotenv';
dotenv.config({ path: `${__dirname}/../.env` });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const location = await prisma.location.create({
    data: {
      name: 'Downtown Branch',
      address: '123 Main St',
      phone: '+1234567890',
      menuItems: {
        create: [
          { name: 'Burger', description: 'Classic beef burger', price: 12.99, category: 'Main' },
          { name: 'Cheeseburger', description: 'Burger with cheese', price: 14.99, category: 'Main' },
          { name: 'Fries', description: 'Crispy french fries', price: 4.99, category: 'Side' },
          { name: 'Coke', description: 'Cold coca-cola', price: 2.99, category: 'Drink' },
          { name: 'Water', description: 'Mineral water', price: 1.99, category: 'Drink' },
        ],
      },
    },
  });

  console.log('Seeded location:', location.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());