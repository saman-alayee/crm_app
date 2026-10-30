import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.notification.findMany({
    where: {
      OR: [{ title: { contains: '?' } }, { body: { contains: '?' } }],
    },
  });
  for (const n of rows) {
    const title = n.title.includes('?')
      ? n.title.startsWith('اطلاعیه')
        ? 'اطلاعیه: خوش‌آمدگویی'
        : 'اعلان سیستم'
      : n.title;
    const body = n.body.includes('?')
      ? 'به پنل فروشگاه سامی خوش آمدید.'
      : n.body;
    await prisma.notification.update({
      where: { id: n.id },
      data: { title, body },
    });
    console.log('fixed notification', n.id);
  }
  console.log('done', rows.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
