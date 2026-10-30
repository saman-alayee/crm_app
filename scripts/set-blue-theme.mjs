import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  for (const [key, value] of Object.entries({
    themePrimary: '#0b6e99',
    themeAccent: '#7ebfd6',
  })) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    console.log('ok', key, value);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
