import { prisma } from '../apps/api/src/db/prisma.js';

console.log(
  'shop keys',
  Object.keys(prisma).filter((k) => /acqui|contact|trade|product|inventory|ops/i.test(k))
);
console.log('acquisitionSource', typeof (prisma as any).acquisitionSource);
console.log('productOption', typeof (prisma as any).productOption);
await prisma.$disconnect();
