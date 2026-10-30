/**
 * Create or reset an admin panel user.
 * Usage:
 *   DATABASE_URL=file:... node create-admin-user.mjs <username> <password> [firstName] [lastName]
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const username = (process.argv[2] || '').trim().toLowerCase();
const password = process.argv[3] || '';
const firstName = process.argv[4] || 'سامان';
const lastName = process.argv[5] || 'ادمین';

if (!username || password.length < 6) {
  console.error('Usage: node create-admin-user.mjs <username> <password> [firstName] [lastName]');
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);

let role = await prisma.role.findUnique({ where: { slug: 'admin' } });
if (!role) {
  role = await prisma.role.findUnique({ where: { slug: 'owner' } });
}
if (!role) {
  console.error('admin/owner role missing — run seed first');
  process.exit(1);
}

const user = await prisma.user.upsert({
  where: { username },
  create: {
    username,
    email: `${username}@crm.local`,
    passwordHash,
    isActive: true,
    employee: {
      create: {
        firstName,
        lastName,
        employeeCode: `ADM-${username.slice(0, 8).toUpperCase()}`,
        jobTitle: 'ادمین',
        department: 'مدیریت',
      },
    },
  },
  update: {
    passwordHash,
    isActive: true,
  },
});

await prisma.userRole.deleteMany({ where: { userId: user.id } });
await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

console.log(JSON.stringify({ ok: true, username, role: role.slug, userId: user.id }, null, 2));
await prisma.$disconnect();
