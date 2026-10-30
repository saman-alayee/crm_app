import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, categoryId: true, tagId: true },
  });

  let categoryLinks = 0;
  let tagLinks = 0;

  for (const product of products) {
    const existingCategories = await prisma.productCategory.count({
      where: { productId: product.id },
    });
    if (!existingCategories && product.categoryId) {
      await prisma.productCategory.create({
        data: { productId: product.id, categoryId: product.categoryId },
      });
      categoryLinks += 1;
    }

    if (product.tagId) {
      const existingTags = await prisma.productTag.count({
        where: { productId: product.id },
      });
      if (!existingTags) {
        await prisma.productTag.create({
          data: { productId: product.id, tagId: product.tagId },
        });
        tagLinks += 1;
      }
    }
  }

  console.log(`BACKFILL_OK categories=${categoryLinks} tags=${tagLinks} products=${products.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
