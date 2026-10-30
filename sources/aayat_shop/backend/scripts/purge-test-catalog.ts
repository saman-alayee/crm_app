/**
 * Remove demo / seed test products and demo categories; keep WooCommerce-imported catalog.
 *
 * Usage: npx tsx scripts/purge-test-catalog.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_CATEGORY_SLUGS = ['zanane', 'mardane', 'dokhtarane', 'pesarane'];

/** دسته‌های seed سوپرمارکت (prisma/seed.ts) — با کاتالوگ وردپرس جایگزین می‌شوند */
const SEED_HYPERMARKET_CATEGORY_SLUGS = [
  'labaniat',
  'noshedani',
  'tangholat',
  'mavad-ghazaei',
  'mive-sabzi',
  'shoyandeha',
  'mahsulat-khane',
  'nan-sobhane',
  'konserv',
  'behdasht',
];

async function deleteProducts(ids: string[]) {
  if (!ids.length) return 0;
  await prisma.productImage.deleteMany({ where: { productId: { in: ids } } });
  await prisma.productCategory.deleteMany({ where: { productId: { in: ids } } });
  await prisma.productTag.deleteMany({ where: { productId: { in: ids } } });
  await prisma.categoryFeedProduct.deleteMany({ where: { productId: { in: ids } } });
  await prisma.favorite.deleteMany({ where: { productId: { in: ids } } });
  await prisma.cartItem.deleteMany({ where: { productId: { in: ids } } });
  const r = await prisma.product.deleteMany({ where: { id: { in: ids } } });
  return r.count;
}

async function main() {
  const testCategorySlugs = [...DEMO_CATEGORY_SLUGS, ...SEED_HYPERMARKET_CATEGORY_SLUGS];
  const testCategories = await prisma.category.findMany({
    where: { slug: { in: testCategorySlugs } },
    select: { id: true, slug: true },
  });
  const testCategoryIds = testCategories.map((c) => c.id);

  const testProducts = await prisma.product.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'demo-' } },
        { id: { startsWith: 'seed-' } },
        { slug: { startsWith: 'seed-' } },
        ...(testCategoryIds.length
          ? [
              { categoryId: { in: testCategoryIds } },
              { productCategories: { some: { categoryId: { in: testCategoryIds } } } },
            ]
          : []),
      ],
    },
    select: { id: true, slug: true },
  });

  const removedProducts = await deleteProducts(testProducts.map((p) => p.id));

  const demoCats = await prisma.category.findMany({
    where: { slug: { in: testCategorySlugs } },
    select: { id: true, slug: true },
  });

  let categoriesRemoved = 0;
  for (const cat of demoCats) {
    const linked = await prisma.product.count({
      where: {
        OR: [{ categoryId: cat.id }, { productCategories: { some: { categoryId: cat.id } } }],
      },
    });
    if (linked > 0) {
      console.warn(`Skip demo category ${cat.slug}: still has ${linked} products`);
      continue;
    }
    await prisma.tag.deleteMany({ where: { categoryId: cat.id } });
    await prisma.slider.deleteMany({ where: { categoryId: cat.id } });
    await prisma.category.delete({ where: { id: cat.id } });
    categoriesRemoved += 1;
  }

  const orphanProducts = await prisma.product.findMany({
    where: {
      NOT: {
        OR: [
          { image: { startsWith: '/uploads/wc/' } },
          { images: { some: { url: { startsWith: '/uploads/wc/' } } } },
        ],
      },
    },
    select: { id: true, slug: true },
  });
  const removedOrphans = await deleteProducts(orphanProducts.map((p) => p.id));

  const seedSliders = await prisma.slider.deleteMany({
    where: {
      OR: [
        { linkUrl: { contains: 'labaniat' } },
        { image: { startsWith: '/images/' } },
        { image: { contains: 'unsplash' } },
      ],
    },
  });

  const remaining = await prisma.product.count();
  const categories = await prisma.category.count();

  console.log(
    `PURGE_OK removedProducts=${removedProducts} removedNonWcImages=${removedOrphans} testCategoriesRemoved=${categoriesRemoved} seedSlidersRemoved=${seedSliders.count} remainingProducts=${remaining} categories=${categories}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
