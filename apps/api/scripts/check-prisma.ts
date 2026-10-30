import { createRequire } from 'node:module';
import { prisma } from '../src/db/prisma.js';

const require = createRequire(import.meta.url);
console.log(
  'shop keys',
  Object.keys(prisma).filter((k) => /acqui|contact|trade|product|inventory|ops/i.test(k))
);
console.log('acquisitionSource', typeof (prisma as any).acquisitionSource);
console.log('client', require.resolve('@prisma/client'));
await (prisma as any)['$disconnect']();
