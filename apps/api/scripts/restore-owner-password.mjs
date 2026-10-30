import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(root, '.env') });

process.env.DATABASE_URL = `file:${path.join(root, 'prisma', 'dev.db')}`;
const prisma = new PrismaClient();
const pass = process.env.SEED_OWNER_PASSWORD || 'ChangeMeOwner123!';
const hash = await bcrypt.hash(pass, 12);
await prisma.user.update({ where: { username: 'owner' }, data: { passwordHash: hash } });
console.log('owner password restored from .env');
await prisma.$disconnect();
