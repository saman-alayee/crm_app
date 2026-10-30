import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PASSWORD = 'QaTest123!';

const USERS = [
  { username: 'admin_qa', firstName: 'ادمین', lastName: 'تست', slug: 'admin', code: 'QA-ADM' },
  { username: 'hr_qa', firstName: 'منابع', lastName: 'انسانی', slug: 'hr-manager', code: 'QA-HR' },
  { username: 'manager_qa', firstName: 'مدیر', lastName: 'واحد', slug: 'manager', code: 'QA-MGR' },
  { username: 'accountant_qa', firstName: 'حسابدار', lastName: 'تست', slug: 'accountant', code: 'QA-ACC' },
  { username: 'employee_qa', firstName: 'کارمند', lastName: 'تست', slug: 'employee', code: 'QA-EMP' },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const roles = await prisma.role.findMany();
  const bySlug = Object.fromEntries(roles.map((r) => [r.slug, r]));

  for (const u of USERS) {
    const role = bySlug[u.slug];
    if (!role) {
      console.error('missing role', u.slug);
      continue;
    }
    const user = await prisma.user.upsert({
      where: { username: u.username },
      create: {
        username: u.username,
        email: `${u.username}@qa.local`,
        passwordHash,
        isActive: true,
        employee: {
          create: {
            firstName: u.firstName,
            lastName: u.lastName,
            employeeCode: u.code,
            department: u.slug === 'accountant' ? 'مالی' : 'عملیات',
            jobTitle: u.firstName,
            phone: '0912000000' + String(USERS.indexOf(u) + 1).slice(-1),
          },
        },
      },
      update: {
        passwordHash,
        isActive: true,
      },
      include: { employee: true },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    console.log('ok', u.username, '→', u.slug, user.employee?.id);
  }

  console.log('\nPassword for all QA users:', PASSWORD);
  console.log('Also owner / from .env (default ChangeMeOwner123!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
