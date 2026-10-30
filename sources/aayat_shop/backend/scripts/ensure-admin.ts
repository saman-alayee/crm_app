import prisma from '../src/config/database';
import { config } from '../src/config';
import { SITE_NAME } from '../src/config/site';

async function main() {
  for (const phone of config.adminPhones) {
    const user = await prisma.user.upsert({
      where: { phone },
      update: { role: 'ADMIN', isActive: true },
      create: {
        phone,
        role: 'ADMIN',
        firstName: 'مدیر',
        lastName: SITE_NAME,
        isActive: true,
      },
    });
    console.log(`OK ${user.phone} id=${user.id} role=${user.role} active=${user.isActive}`);
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
