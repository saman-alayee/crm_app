/**
 * Sets default homepage tile images for known category slugs when image is empty.
 * Safe to re-run: does not overwrite an existing image.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOME_IMAGES: Record<string, string> = {
  't-shirt': '/wp-home/categories/tshirt.png',
  'paperbacks-and-shirts': '/wp-home/categories/blouse.png',
  pants: '/wp-home/categories/pants.png',
  overalls: '/wp-home/categories/overalls.png',
  'knitted-blouse': '/wp-home/categories/knitted-blouse.png',
  'beach-shirt': '/wp-home/categories/dress.png',
  coat: '/wp-home/categories/coat.png',
};

async function main() {
  let updated = 0;
  for (const [slug, image] of Object.entries(HOME_IMAGES)) {
    const result = await prisma.category.updateMany({
      where: {
        slug,
        OR: [{ image: null }, { image: '' }],
      },
      data: { image },
    });
    updated += result.count;
    console.log(`${slug}: ${result.count ? 'set ' + image : 'skipped (already set or missing)'}`);
  }
  console.log(`done, updated=${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
