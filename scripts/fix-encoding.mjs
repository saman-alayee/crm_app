import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const badAnn = await prisma.announcement.findMany();
  for (const a of badAnn) {
    if (a.title.includes('?') || a.body.includes('?')) {
      await prisma.announcement.update({
        where: { id: a.id },
        data: {
          title: 'خوش‌آمدگویی',
          body: 'به پنل فروشگاه سامی خوش آمدید. از این بخش اطلاعیه‌های سازمانی را دنبال کنید.',
        },
      });
      console.log('fixed announcement', a.id);
    }
  }

  const employees = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true, jobTitle: true, employeeCode: true },
  });
  let i = 1;
  for (const e of employees) {
    const broken =
      e.firstName.includes('?') ||
      e.lastName.includes('?') ||
      (e.jobTitle || '').includes('?');
    if (!broken) continue;
    await prisma.employee.update({
      where: { id: e.id },
      data: {
        firstName: `کارمند`,
        lastName: `${i}`,
        jobTitle: e.jobTitle && e.jobTitle.includes('?') ? 'کارشناس' : e.jobTitle,
      },
    });
    console.log('fixed employee', e.id, `-> کارمند ${i}`);
    i += 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
