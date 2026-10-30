import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('acquisitionSource', typeof p.acquisitionSource);
console.log('contact', typeof p.contact);
console.log('tradeRequest', typeof p.tradeRequest);
console.log('inventoryItem', typeof p.inventoryItem);
await p.$disconnect();
