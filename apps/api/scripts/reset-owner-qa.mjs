import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const hash = await bcrypt.hash('QaOwner123!', 12);
await prisma.user.update({ where: { username: 'owner' }, data: { passwordHash: hash } });
console.log('owner -> QaOwner123!');
await prisma.$disconnect();
