import { PrismaClient, UserRole } from '@prisma/client';
import { config } from '../src/config';

const prisma = new PrismaClient();

const categories = [
  { name: 'لبنیات', slug: 'labaniat', sortOrder: 1, image: '/images/categories/dairy.jpg' },
  { name: 'نوشیدنی', slug: 'noshedani', sortOrder: 2, image: '/images/categories/drinks.jpg' },
  { name: 'تنقلات', slug: 'tangholat', sortOrder: 3, image: '/images/categories/snacks.jpg' },
  { name: 'مواد غذایی', slug: 'mavad-ghazaei', sortOrder: 4, image: '/images/categories/food.jpg' },
  { name: 'میوه و سبزیجات', slug: 'mive-sabzi', sortOrder: 5, image: '/images/categories/fruits.jpg' },
  { name: 'شوینده‌ها', slug: 'shoyandeha', sortOrder: 6, image: '/images/categories/cleaning.jpg' },
  { name: 'محصولات خانه', slug: 'mahsulat-khane', sortOrder: 7, image: '/images/categories/home.jpg' },
];

const products = [
  { slug: 'shir-pagah', name: 'شیر تازه پگاه', unit: '۱ لیتر', price: 45000, discountPrice: 26500, stock: 50, categorySlug: 'labaniat', isFeatured: true, isNew: false, image: '/images/products/milk.jpg' },
  { slug: 'mast-kale', name: 'ماست پرچرب کاله', unit: '۹۰۰ گرم', price: 32000, discountPrice: null, stock: 40, categorySlug: 'labaniat', isFeatured: true, isNew: true, image: '/images/products/yogurt.jpg' },
  { slug: 'panir-lighvan', name: 'پنیر لیقوان', unit: '۴۰۰ گرم', price: 85000, discountPrice: 72000, stock: 30, categorySlug: 'labaniat', isFeatured: false, isNew: false, image: '/images/products/cheese.jpg' },
  { slug: 'kare-hayvani', name: 'کره حیوانی', unit: '۱۰۰ گرم', price: 28000, discountPrice: null, stock: 25, categorySlug: 'labaniat', isFeatured: false, isNew: true, image: '/images/products/butter.jpg' },
  { slug: 'dogh-sonati', name: 'دوغ سنتی', unit: '۱.۵ لیتر', price: 18000, discountPrice: 15000, stock: 60, categorySlug: 'labaniat', isFeatured: true, isNew: false, image: '/images/products/doogh.jpg' },
  { slug: 'ab-madani-damavand', name: 'آب معدنی دماوند', unit: '۱.۵ لیتر', price: 8000, discountPrice: null, stock: 100, categorySlug: 'noshedani', isFeatured: false, isNew: false, image: '/images/products/water.jpg' },
  { slug: 'nushabe-pepsi', name: 'نوشابه پپسی', unit: '۱.۵ لیتر', price: 22000, discountPrice: 18500, stock: 80, categorySlug: 'noshedani', isFeatured: true, isNew: false, image: '/images/products/soda.jpg' },
  { slug: 'abmive-sunich', name: 'آبمیوه سن‌ایچ', unit: '۱ لیتر', price: 35000, discountPrice: null, stock: 45, categorySlug: 'noshedani', isFeatured: false, isNew: true, image: '/images/products/juice.jpg' },
  { slug: 'chips-mazmaz', name: 'چیپس مزمز', unit: '۱۰۰ گرم', price: 25000, discountPrice: 19900, stock: 70, categorySlug: 'tangholat', isFeatured: true, isNew: false, image: '/images/products/chips.jpg' },
  { slug: 'pofak-nacho', name: 'پفک ناچو', unit: '۱۲۰ گرم', price: 22000, discountPrice: null, stock: 55, categorySlug: 'tangholat', isFeatured: false, isNew: false, image: '/images/products/puffs.jpg' },
  { slug: 'biskuit-saghe-talaei', name: 'بیسکویت ساقه طلایی', unit: '۱۵۰ گرم', price: 18000, discountPrice: 14500, stock: 65, categorySlug: 'tangholat', isFeatured: true, isNew: true, image: '/images/products/biscuits.jpg' },
  { slug: 'shokolat-lint', name: 'شکلات تلخ لینت', unit: '۱۰۰ گرم', price: 95000, discountPrice: null, stock: 20, categorySlug: 'tangholat', isFeatured: false, isNew: false, image: '/images/products/chocolate.jpg' },
  { slug: 'berenj-hashemi', name: 'برنج هاشمی', unit: '۵ کیلوگرم', price: 450000, discountPrice: 420000, stock: 15, categorySlug: 'mavad-ghazaei', isFeatured: true, isNew: false, image: '/images/products/rice.jpg' },
  { slug: 'roghan-aftabgardan', name: 'روغن آفتابگردان', unit: '۱.۸ لیتر', price: 120000, discountPrice: null, stock: 35, categorySlug: 'mavad-ghazaei', isFeatured: false, isNew: false, image: '/images/products/oil.jpg' },
  { slug: 'rob-goje', name: 'رب گوجه فرنگی', unit: '۸۰۰ گرم', price: 45000, discountPrice: 38000, stock: 50, categorySlug: 'mavad-ghazaei', isFeatured: false, isNew: true, image: '/images/products/tomato-paste.jpg' },
  { slug: 'namak-tasfiye', name: 'نمک تصفیه شده', unit: '۱ کیلوگرم', price: 12000, discountPrice: null, stock: 90, categorySlug: 'mavad-ghazaei', isFeatured: false, isNew: false, image: '/images/products/salt.jpg' },
  { slug: 'sib-ghermez', name: 'سیب قرمز', unit: '۱ کیلوگرم', price: 55000, discountPrice: 48000, stock: 40, categorySlug: 'mive-sabzi', isFeatured: true, isNew: true, image: '/images/products/apple.jpg' },
  { slug: 'moz', name: 'موز', unit: '۱ کیلوگرم', price: 85000, discountPrice: null, stock: 30, categorySlug: 'mive-sabzi', isFeatured: true, isNew: false, image: '/images/products/banana.jpg' },
  { slug: 'goje-farangi', name: 'گوجه فرنگی', unit: '۱ کیلوگرم', price: 35000, discountPrice: 28000, stock: 45, categorySlug: 'mive-sabzi', isFeatured: false, isNew: false, image: '/images/products/tomato.jpg' },
  { slug: 'khiar', name: 'خیار', unit: '۱ کیلوگرم', price: 42000, discountPrice: null, stock: 35, categorySlug: 'mive-sabzi', isFeatured: false, isNew: true, image: '/images/products/cucumber.jpg' },
  { slug: 'maye-zarfshui', name: 'مایع ظرفشویی', unit: '۱ لیتر', price: 38000, discountPrice: 32000, stock: 60, categorySlug: 'shoyandeha', isFeatured: true, isNew: false, image: '/images/products/dish-soap.jpg' },
  { slug: 'pudr-lebas', name: 'پودر لباسشویی', unit: '۵۰۰ گرم', price: 65000, discountPrice: null, stock: 40, categorySlug: 'shoyandeha', isFeatured: false, isNew: false, image: '/images/products/detergent.jpg' },
  { slug: 'dastmal-kaghazi', name: 'دستمال کاغذی', unit: 'بسته ۲ عددی', price: 28000, discountPrice: 24000, stock: 75, categorySlug: 'shoyandeha', isFeatured: false, isNew: true, image: '/images/products/paper-towel.jpg' },
  { slug: 'kise-zobale', name: 'کیسه زباله', unit: 'بسته ۳۰ عددی', price: 35000, discountPrice: null, stock: 50, categorySlug: 'mahsulat-khane', isFeatured: false, isNew: false, image: '/images/products/trash-bags.jpg' },
  { slug: 'foil-alominium', name: 'فویل آلومینیومی', unit: '۱۰ متر', price: 42000, discountPrice: 35000, stock: 30, categorySlug: 'mahsulat-khane', isFeatured: false, isNew: false, image: '/images/products/foil.jpg' },
];

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.user.upsert({
    where: { phone: config.adminPhone },
    update: { role: 'ADMIN' as UserRole },
    create: {
      phone: config.adminPhone,
      firstName: 'مدیر',
      lastName: 'سیستم',
      role: 'ADMIN' as UserRole,
    },
  });
  console.log('✅ Admin user created');

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log('✅ Categories created');

  for (const prod of products) {
    const category = await prisma.category.findUnique({ where: { slug: prod.categorySlug } });
    if (!category) continue;

    const { categorySlug, ...data } = prod;

    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {
        name: data.name,
        unit: data.unit,
        price: data.price,
        discountPrice: data.discountPrice,
        stock: data.stock,
        categoryId: category.id,
        isFeatured: data.isFeatured,
        isNew: data.isNew,
        image: data.image,
        isActive: true,
      },
      create: {
        ...data,
        categoryId: category.id,
        isActive: true,
      },
    });

    const savedProduct = await prisma.product.findUnique({
      where: { slug: prod.slug },
      include: { images: true },
    });

    if (savedProduct && prod.image) {
      if (savedProduct.images.length === 0) {
        await prisma.productImage.create({
          data: {
            productId: savedProduct.id,
            url: prod.image,
            sortOrder: 0,
          },
        });
      } else if (savedProduct.image !== prod.image) {
        await prisma.product.update({
          where: { id: savedProduct.id },
          data: { image: savedProduct.images[0]?.url ?? prod.image },
        });
      }
    }

    // Hide duplicate rows from older seeds (same name, different slug)
    const duplicates = await prisma.product.findMany({
      where: {
        name: prod.name,
        slug: { not: prod.slug },
      },
      select: { id: true },
    });

    if (duplicates.length) {
      const duplicateIds = duplicates.map((item) => item.id);
      await prisma.cartItem.deleteMany({ where: { productId: { in: duplicateIds } } });
      await prisma.product.updateMany({
        where: { id: { in: duplicateIds } },
        data: { isActive: false },
      });
    }
  }
  console.log('✅ Products created');

  await prisma.contentPage.upsert({
    where: { slug: 'terms' },
    update: {},
    create: {
      slug: 'terms',
      title: 'قوانین و مقررات',
      body: `# قوانین و مقررات KIAA KALA

## ۱. ثبت سفارش
- ثبت سفارش به منزله پذیرش قیمت‌ها و شرایط فروشگاه است.
- حداقل مبلغ سفارش طبق شرایط روز محاسبه می‌شود.

## ۲. ارسال و تحویل
- ارسال سفارش‌ها در ساعات کاری انجام می‌شود.
- هزینه ارسال بسته به منطقه ممکن است متفاوت باشد.
- پرداخت در محل (پس از تحویل) انجام می‌شود.

## ۳. مرجوعی و تعویض
- کالاهای فاسدشدنی قابل مرجوعی نیستند مگر مغایرت یا کیفیت نامناسب.
- در صورت مشکل، حداکثر تا ۲۴ ساعت پس از تحویل با پشتیبانی تماس بگیرید.

## ۴. حریم خصوصی
- اطلاعات شما محرمانه نگهداری می‌شود و فقط برای پردازش سفارش استفاده می‌شود.

## ۵. تماس
- پشتیبانی: 09120000000`,
      isPublished: true,
    },
  });
  console.log('✅ Content pages created');

  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: { perUserLimit: 1 },
    create: {
      code: 'WELCOME10',
      title: 'تخفیف خوش‌آمدگویی',
      type: 'PERCENT',
      value: 10,
      minPurchase: 100000,
      maxDiscount: 50000,
      usageLimit: 100,
      perUserLimit: 1,
      isActive: true,
    },
  });
  console.log('✅ Sample coupon created');

  console.log('🎉 Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
