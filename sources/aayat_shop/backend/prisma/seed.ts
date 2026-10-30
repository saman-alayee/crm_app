import {
  CouponType,
  NotificationType,
  OrderStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { config } from '../src/config';
import { SITE_NAME } from '../src/config/site';

const prisma = new PrismaClient();

const categories = [
  { name: 'لبنیات', slug: 'labaniat', sortOrder: 1, image: '/images/categories/dairy.jpg' },
  { name: 'نوشیدنی', slug: 'noshedani', sortOrder: 2, image: '/images/categories/drinks.jpg' },
  { name: 'تنقلات', slug: 'tangholat', sortOrder: 3, image: '/images/categories/snacks.jpg' },
  { name: 'مواد غذایی', slug: 'mavad-ghazaei', sortOrder: 4, image: '/images/categories/food.jpg' },
  { name: 'میوه و سبزیجات', slug: 'mive-sabzi', sortOrder: 5, image: '/images/categories/fruits.jpg' },
  { name: 'شوینده‌ها', slug: 'shoyandeha', sortOrder: 6, image: '/images/categories/cleaning.jpg' },
  { name: 'محصولات خانه', slug: 'mahsulat-khane', sortOrder: 7, image: '/images/categories/home.jpg' },
  { name: 'نان و صبحانه', slug: 'nan-sobhane', sortOrder: 8, image: '/images/categories/bread.jpg' },
  { name: 'کنسرو و کمپوت', slug: 'konserv', sortOrder: 9, image: '/images/categories/canned.jpg' },
  { name: 'بهداشت شخصی', slug: 'behdasht', sortOrder: 10, image: '/images/categories/personal-care.jpg' },
];

type ProductSeed = {
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  discountPrice?: number;
  stock: number;
  unit: string;
  description: string;
  isFeatured?: boolean;
  isNew?: boolean;
  image?: string;
};

const products: ProductSeed[] = [
  {
    slug: 'shir-pasteurized-1l',
    name: 'شیر پاستوریزه یک لیتری',
    categorySlug: 'labaniat',
    price: 45000,
    discountPrice: 39000,
    stock: 80,
    unit: '۱ عدد',
    description: 'شیر پاستوریزه تازه، مناسب مصرف روزانه.',
    isFeatured: true,
  },
  {
    slug: 'mast-khamei-900g',
    name: 'ماست خامه‌ای ۹۰۰ گرمی',
    categorySlug: 'labaniat',
    price: 62000,
    stock: 45,
    unit: '۱ عدد',
    description: 'ماست پرچرب با طعم طبیعی.',
    isNew: true,
  },
  {
    slug: 'panir-liquan-400g',
    name: 'پنیر لیقوان ۴۰۰ گرمی',
    categorySlug: 'labaniat',
    price: 98000,
    discountPrice: 89000,
    stock: 30,
    unit: '۱ عدد',
    description: 'پنیر صبحانه با کیفیت بالا.',
    isFeatured: true,
  },
  {
    slug: 'ab-madani-1-5l',
    name: 'آب معدنی ۱.۵ لیتری',
    categorySlug: 'noshedani',
    price: 12000,
    stock: 200,
    unit: '۱ عدد',
    description: 'آب معدنی طبیعی، بسته ۶ عددی تک‌فروشی.',
    isFeatured: true,
  },
  {
    slug: 'nooshabe-pepsi-1-5l',
    name: 'نوشابه پپسی ۱.۵ لیتری',
    categorySlug: 'noshedani',
    price: 28000,
    discountPrice: 25000,
    stock: 60,
    unit: '۱ عدد',
    description: 'نوشابه گازدار خنک.',
  },
  {
    slug: 'abmive-sanich-1l',
    name: 'آبمیوه سن‌ایچ یک لیتری',
    categorySlug: 'noshedani',
    price: 55000,
    stock: 40,
    unit: '۱ عدد',
    description: 'آبمیوه طبیعی بدون شکر افزوده.',
    isNew: true,
  },
  {
    slug: 'chips-mazmaz-100g',
    name: 'چیپس مزمز ۱۰۰ گرمی',
    categorySlug: 'tangholat',
    price: 35000,
    discountPrice: 29000,
    stock: 100,
    unit: '۱ عدد',
    description: 'چیپس سیب‌زمینی با طعم کلاسیک.',
    isFeatured: true,
  },
  {
    slug: 'pofak-60g',
    name: 'پفک ۶۰ گرمی',
    categorySlug: 'tangholat',
    price: 18000,
    stock: 120,
    unit: '۱ عدد',
    description: 'تنقلات سبک و خوشمزه.',
  },
  {
    slug: 'shokolat-farmand',
    name: 'شکلات تخته‌ای فارمند',
    categorySlug: 'tangholat',
    price: 85000,
    discountPrice: 72000,
    stock: 25,
    unit: '۱ عدد',
    description: 'شکلات شیری با طعم عالی.',
    isNew: true,
  },
  {
    slug: 'berenj-tarem-5kg',
    name: 'برنج طارم هاشمی ۵ کیلویی',
    categorySlug: 'mavad-ghazaei',
    price: 420000,
    discountPrice: 395000,
    stock: 20,
    unit: '۱ عدد',
    description: 'برنج ایرانی درجه یک.',
    isFeatured: true,
  },
  {
    slug: 'roghan-1-5l',
    name: 'روغن آفتابگردان ۱.۵ لیتری',
    categorySlug: 'mavad-ghazaei',
    price: 185000,
    stock: 35,
    unit: '۱ عدد',
    description: 'روغن پخت و پز با کیفیت استاندارد.',
  },
  {
    slug: 'rob-goje-800g',
    name: 'رب گوجه ۸۰۰ گرمی',
    categorySlug: 'mavad-ghazaei',
    price: 48000,
    discountPrice: 42000,
    stock: 50,
    unit: '۱ عدد',
    description: 'رب گوجه غلیظ برای غذاها.',
  },
  {
    slug: 'sib-1kg',
    name: 'سیب درختی یک کیلویی',
    categorySlug: 'mive-sabzi',
    price: 65000,
    stock: 40,
    unit: '۱ کیلو',
    description: 'سیب تازه و درجه یک.',
    isFeatured: true,
  },
  {
    slug: 'goje-1kg',
    name: 'گوجه فرنگی یک کیلویی',
    categorySlug: 'mive-sabzi',
    price: 38000,
    discountPrice: 32000,
    stock: 55,
    unit: '۱ کیلو',
    description: 'گوجه تازه مناسب سالاد و پخت.',
    isNew: true,
  },
  {
    slug: 'sibzamini-2kg',
    name: 'سیب‌زمینی ۲ کیلویی',
    categorySlug: 'mive-sabzi',
    price: 52000,
    stock: 70,
    unit: '۲ کیلو',
    description: 'سیب‌زمینی درشت و تازه.',
  },
  {
    slug: 'maye-zarfshuyi-1l',
    name: 'مایع ظرفشویی ۱ لیتری',
    categorySlug: 'shoyandeha',
    price: 72000,
    discountPrice: 65000,
    stock: 45,
    unit: '۱ عدد',
    description: 'پاک‌کننده قوی با رایحه ملایم.',
    isFeatured: true,
  },
  {
    slug: 'powder-labashui-2kg',
    name: 'پودر لباسشویی ۲ کیلویی',
    categorySlug: 'shoyandeha',
    price: 145000,
    stock: 30,
    unit: '۱ عدد',
    description: 'پودر لباسشویی با قدرت لکه‌بری بالا.',
  },
  {
    slug: 'dastmal-kaghazi',
    name: 'دستمال کاغذی ۲۰۰ برگی',
    categorySlug: 'shoyandeha',
    price: 38000,
    stock: 60,
    unit: '۱ عدد',
    description: 'دستمال نرم و مقاوم.',
    isNew: true,
  },
  {
    slug: 'lamp-led-9w',
    name: 'لامپ LED ۹ وات',
    categorySlug: 'mahsulat-khane',
    price: 95000,
    discountPrice: 82000,
    stock: 40,
    unit: '۱ عدد',
    description: 'لامپ کم‌مصرف با نور گرم.',
    isFeatured: true,
  },
  {
    slug: 'battery-aa-4pack',
    name: 'باطری قلمی AA بسته ۴ عددی',
    categorySlug: 'mahsulat-khane',
    price: 68000,
    stock: 50,
    unit: '۱ بسته',
    description: 'باطری آلکالاین با عمر بالا.',
  },
  {
    slug: 'naylon-zobale',
    name: 'نایلون زباله ۳ رول',
    categorySlug: 'mahsulat-khane',
    price: 42000,
    stock: 80,
    unit: '۱ بسته',
    description: 'نایلون ضخیم مناسب آشپزخانه.',
    isNew: true,
  },
  {
    slug: 'nan-barbarei',
    name: 'نان بربری تازه',
    categorySlug: 'nan-sobhane',
    price: 15000,
    stock: 100,
    unit: '۱ عدد',
    description: 'نان بربری تازه پخت روز.',
    isFeatured: true,
  },
  {
    slug: 'kare-100g',
    name: 'کره حیوانی ۱۰۰ گرمی',
    categorySlug: 'nan-sobhane',
    price: 78000,
    discountPrice: 69000,
    stock: 35,
    unit: '۱ عدد',
    description: 'کره حیوانی با کیفیت بالا.',
    isNew: true,
  },
  {
    slug: 'moraba-albaloo',
    name: 'مربا آلبالو ۳۰۰ گرمی',
    categorySlug: 'nan-sobhane',
    price: 92000,
    stock: 28,
    unit: '۱ عدد',
    description: 'مربا خانگی با طعم طبیعی.',
  },
  {
    slug: 'konserv-lubia',
    name: 'کنسرو لوبیا چیتی ۴۰۰ گرمی',
    categorySlug: 'konserv',
    price: 45000,
    discountPrice: 39000,
    stock: 60,
    unit: '۱ عدد',
    description: 'لوبیا چیتی آماده مصرف.',
    isFeatured: true,
  },
  {
    slug: 'konserv-tun-mahi',
    name: 'کنسرو تن ماهی ۱۸۰ گرمی',
    categorySlug: 'konserv',
    price: 115000,
    stock: 40,
    unit: '۱ عدد',
    description: 'تن ماهی در روغن زیتون.',
  },
  {
    slug: 'compote-holo',
    name: 'کمپوت هلو ۶۰۰ گرمی',
    categorySlug: 'konserv',
    price: 58000,
    stock: 45,
    unit: '۱ عدد',
    description: 'کمپوت میوه بدون مواد نگهدارنده.',
    isNew: true,
  },
  {
    slug: 'shampo-400ml',
    name: 'شامپو ۴۰۰ میلی‌لیتری',
    categorySlug: 'behdasht',
    price: 125000,
    discountPrice: 108000,
    stock: 32,
    unit: '۱ عدد',
    description: 'شامپو مناسب انواع مو.',
    isFeatured: true,
  },
  {
    slug: 'dastkesh-liquid',
    name: 'مایع دستشویی ۵۰۰ میلی‌لیتری',
    categorySlug: 'behdasht',
    price: 68000,
    stock: 55,
    unit: '۱ عدد',
    description: 'مایع دستشویی با رایحه ملایم.',
  },
  {
    slug: 'dandan-shostan',
    name: 'خمیر دندان ۱۰۰ میلی‌لیتری',
    categorySlug: 'behdasht',
    price: 52000,
    discountPrice: 45000,
    stock: 70,
    unit: '۱ عدد',
    description: 'خمیر دندان ضد پوسیدگی.',
  },
];

const contentPages = [
  {
    slug: 'terms',
    title: 'قوانین و مقررات',
    body: `## محصولات استوک ما
- کلیه محصولات فروشگاه استوک و اورجینال هستن و از برندهای اروپایی انتخاب شده.
- به هیچ عنوان کالاها تولیدی یا داخلی نیستن.
- هر آیتم به صورت تک سایت و تک رنگ عرضه می‌شه و کیفیت‌شون تضمین شده است.
- لطفاً قبل از خرید، توضیحات هر محصول در سایت رو دقیق مطالعه کنین و خریدتون رو طبق اطلاعات سایت انجام بدین.

## هزینه و روش ارسال
- همشهریان عزیزمون می‌تونن خریدشون رو به صورت حضوری انجام بدن و حتی به صورت آنلاین خرید کنند و حضوری درب فروشگاه تحویل بگیرند.
- پرداخت هزینه پست در محل (هنگام تحویل) انجام می‌شود.

## مرجوعی و تعویض
- به هیچ عنوان امکان تعویض یا مرجوع کردن محصولات خریداری‌شده از سایت وجود نداره.
- خرید شما قطعی و نهاییه، پس لطفاً قبل از ثبت سفارش دقت کنین.

## توضیحات تکمیلی
- لطفاً آدرس و اطلاعات تماس‌تون رو دقیق وارد کنین تا سفارش به درستی و بدون مشکل به دستتون برسه.
- خرید از سایت به معنی پذیرش قوانین و مقررات فروشگاه است.
- تلاش می‌کنیم همه سفارش‌ها در کمترین زمان ممکن ارسال بشن، اما زمان دقیق تحویل بسته به روش ارسال و فاصله شهر مقصد ممکنه متفاوت باشه.`,
  },
  {
    slug: 'about',
    title: 'درباره ما',
    body: `ما کارمون رو با یه دغدغه‌ی ساده ولی مهم شروع کردیم؛ اینکه توی این گرونی، مردم بتونن لباس باکیفیت بخرن، بدون اینکه مجبور باشن هزینه‌های خیلی بالا بدن. واقعیت اینه که هرچی زمان می‌گذره، کیفیت خیلی از پوشاک‌های بازار کمتر می‌شه، اما قیمت‌ها مدام بالاتر می‌رن.

ما وقتی این شرایط رو دیدیم، تصمیم گرفتیم یه فروشگاه راه بندازیم که تمرکزش فقط روی کیفیت بالا و قیمت منصفانه باشه. توی مجموعه‌ی ما پوشاک استوک انتخاب می‌شه؛ لباس‌هایی که از نظر کیفیت کاملاً قابل اعتماد هستن و این فرصت رو می‌دن که با هزینه‌ی کمتر، خرید بهتری داشته باشین.

همه‌ی کارها با دقت انتخاب و بررسی می‌شن چون اعتقاد داریم استوک بودن اصلاً به معنی بی‌کیفیت بودن نیست، بلکه یه انتخاب هوشمندانه‌ست. هدف ما اینه که شما با خیال راحت خرید کنین و از انتخابتون راضی باشین.

این فروشگاه با همراهی من و همسرم راه‌اندازی شده و سعی می‌کنیم با صداقت، احترام و مسئولیت‌پذیری کنار شما باشیم. اعتماد شما برای ما از هر چیزی مهم‌تره و همیشه تلاش می‌کنیم این اعتماد رو حفظ کنیم.`,
  },
  {
    slug: 'privacy',
    title: 'حریم خصوصی',
    body: `# حریم خصوصی

اطلاعات شما فقط برای پردازش سفارش و ارتباط با شما استفاده می‌شود.

- شماره موبایل برای احراز هویت و پیگیری سفارش
- آدرس فقط برای ارسال کالا
- اطلاعات به اشخاص ثالث فروخته نمی‌شود`,
  },
  {
    slug: 'shipping',
    title: 'شرایط ارسال',
    body: `# شرایط ارسال

## زمان ارسال
- سفارش‌های ثبت‌شده تا ساعت ۱۶ همان روز یا روز کاری بعد ارسال می‌شوند.

## هزینه ارسال
- پرداخت هزینه پست در محل (هنگام تحویل) انجام می‌شود.

## تحویل
- پرداخت درب منزل`,
  },
  {
    slug: 'faq',
    title: 'سوالات متداول',
    body: `# سوالات متداول

## چطور سفارش بدهم؟
محصول را به سبد اضافه کنید و مراحل تسویه را تکمیل کنید.

## پرداخت چگونه است؟
پرداخت در محل هنگام تحویل انجام می‌شود.

## کد تخفیف دارم، کجا وارد کنم؟
در صفحه تسویه حساب کد تخفیف را وارد کنید.`,
  },
];

const coupons = [
  {
    code: 'WELCOME10',
    title: 'تخفیف خوش‌آمدگویی',
    type: 'PERCENT' as CouponType,
    value: 10,
    minPurchase: 100000,
    maxDiscount: 50000,
    usageLimit: 100,
    perUserLimit: 1,
  },
  {
    code: 'SAVE50K',
    title: '۵۰ هزار تومان تخفیف',
    type: 'FIXED' as CouponType,
    value: 50000,
    minPurchase: 250000,
    usageLimit: 50,
    perUserLimit: 2,
  },
  {
    code: 'NOWRUZ15',
    title: 'تخفیف ۱۵ درصدی',
    type: 'PERCENT' as CouponType,
    value: 15,
    minPurchase: 150000,
    maxDiscount: 80000,
    usageLimit: 200,
    perUserLimit: 1,
  },
];

const demoCustomers = [
  { phone: '09121111111', firstName: 'علی', lastName: 'رضایی' },
  { phone: '09122222222', firstName: 'مریم', lastName: 'احمدی' },
  { phone: '09123333333', firstName: 'رضا', lastName: 'کریمی' },
];

const categoryTags: Record<string, { name: string; slug: string; icon?: string; sortOrder: number }[]> = {
  labaniat: [
    { name: 'شیر', slug: 'shir', sortOrder: 1 },
    { name: 'ماست', slug: 'mast', sortOrder: 2 },
    { name: 'پنیر', slug: 'panir', sortOrder: 3 },
  ],
  noshedani: [
    { name: 'آب معدنی', slug: 'ab-madani', sortOrder: 1 },
    { name: 'نوشابه', slug: 'nooshabe', sortOrder: 2 },
    { name: 'آبمیوه', slug: 'abmive', sortOrder: 3 },
  ],
  tangholat: [
    { name: 'چیپس', slug: 'chips', sortOrder: 1 },
    { name: 'شکلات', slug: 'shokolat', sortOrder: 2 },
  ],
  'mavad-ghazaei': [
    { name: 'برنج', slug: 'berenj', sortOrder: 1 },
    { name: 'روغن', slug: 'roghan', sortOrder: 2 },
    { name: 'رب و چاشنی', slug: 'rob', sortOrder: 3 },
  ],
  'mive-sabzi': [
    { name: 'میوه', slug: 'mive', sortOrder: 1 },
    { name: 'سبزیجات', slug: 'sabzi', sortOrder: 2 },
  ],
  shoyandeha: [
    { name: 'ظرفشویی', slug: 'zarfshuyi', sortOrder: 1 },
    { name: 'لباسشویی', slug: 'labashui', sortOrder: 2 },
  ],
  'mahsulat-khane': [
    { name: 'روشنایی', slug: 'roshanaei', sortOrder: 1 },
    { name: 'لوازم خانگی', slug: 'lavazem', sortOrder: 2 },
  ],
  'nan-sobhane': [
    { name: 'نان', slug: 'nan', sortOrder: 1 },
    { name: 'صبحانه', slug: 'sobhane', sortOrder: 2 },
  ],
  konserv: [
    { name: 'کنسرو', slug: 'konserv-tag', sortOrder: 1 },
    { name: 'کمپوت', slug: 'compote', sortOrder: 2 },
  ],
  behdasht: [
    { name: 'مراقبت مو', slug: 'mo', sortOrder: 1 },
    { name: 'بهداشت دهان', slug: 'dandan', sortOrder: 2 },
  ],
};

const productTagMap: Record<string, string> = {
  'shir-pasteurized-1l': 'shir',
  'mast-khamei-900g': 'mast',
  'panir-liquan-400g': 'panir',
  'ab-madani-1-5l': 'ab-madani',
  'nooshabe-pepsi-1-5l': 'nooshabe',
  'abmive-sanich-1l': 'abmive',
  'chips-mazmaz-100g': 'chips',
  'shokolat-farmand': 'shokolat',
  'berenj-tarem-5kg': 'berenj',
  'roghan-1-5l': 'roghan',
  'rob-goje-800g': 'rob',
  'sib-1kg': 'mive',
  'goje-1kg': 'sabzi',
  'maye-zarfshuyi-1l': 'zarfshuyi',
  'powder-labashui-2kg': 'labashui',
  'lamp-led-9w': 'roshanaei',
  'nan-barbarei': 'nan',
  'kare-100g': 'sobhane',
  'konserv-lubia': 'konserv-tag',
  'compote-holo': 'compote',
  'shampo-400ml': 'mo',
  'dandan-shostan': 'dandan',
};

async function upsertProduct(prod: ProductSeed) {
  const category = await prisma.category.findUnique({ where: { slug: prod.categorySlug } });
  if (!category) return;

  const image = prod.image ?? category.image;
  const { categorySlug, ...data } = prod;

  let tagId: string | null = null;
  const tagSlug = productTagMap[prod.slug];
  if (tagSlug) {
    const tag = await prisma.tag.findUnique({
      where: { categoryId_slug: { categoryId: category.id, slug: tagSlug } },
    });
    tagId = tag?.id ?? null;
  }

  await prisma.product.upsert({
    where: { slug: prod.slug },
    update: {
      name: data.name,
      description: data.description,
      unit: data.unit,
      price: data.price,
      discountPrice: data.discountPrice ?? null,
      stock: data.stock,
      categoryId: category.id,
      tagId,
      isFeatured: data.isFeatured ?? false,
      isNew: data.isNew ?? false,
      image,
      isActive: true,
    },
    create: {
      ...data,
      discountPrice: data.discountPrice ?? null,
      categoryId: category.id,
      tagId,
      image,
      isFeatured: data.isFeatured ?? false,
      isNew: data.isNew ?? false,
      isActive: true,
    },
  });

  const savedProduct = await prisma.product.findUnique({
    where: { slug: prod.slug },
    include: { images: true },
  });

  if (savedProduct && image && savedProduct.images.length === 0) {
    await prisma.productImage.create({
      data: { productId: savedProduct.id, url: image, sortOrder: 0 },
    });
  }
}

async function seedOrders() {
  const customer1 = await prisma.user.findUnique({ where: { phone: '09121111111' } });
  const customer2 = await prisma.user.findUnique({ where: { phone: '09122222222' } });
  const customer3 = await prisma.user.findUnique({ where: { phone: '09123333333' } });
  const welcomeCoupon = await prisma.coupon.findUnique({ where: { code: 'WELCOME10' } });

  const productBySlug = async (slug: string) => {
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) throw new Error(`Missing product: ${slug}`);
    return product;
  };

  const orderSeeds = [
    {
      orderNumber: 'HM-SEED-001',
      status: 'NEW' as OrderStatus,
      userId: customer1?.id,
      customerName: 'علی رضایی',
      customerPhone: '09121111111',
      deliveryAddress: 'تهران، سعادت‌آباد، خیابان سرو، پلاک ۱۲',
      addressTitle: 'منزل',
      items: [
        { slug: 'shir-pasteurized-1l', quantity: 2 },
        { slug: 'chips-mazmaz-100g', quantity: 1 },
      ],
      logs: ['NEW'] as OrderStatus[],
    },
    {
      orderNumber: 'HM-SEED-002',
      status: 'PREPARING' as OrderStatus,
      userId: customer2?.id,
      customerName: 'مریم احمدی',
      customerPhone: '09122222222',
      deliveryAddress: 'تهران، پونک، بلوار میرزابابایی، پلاک ۸',
      addressTitle: 'منزل',
      items: [
        { slug: 'berenj-tarem-5kg', quantity: 1 },
        { slug: 'roghan-1-5l', quantity: 1 },
        { slug: 'ab-madani-1-5l', quantity: 6 },
      ],
      logs: ['NEW', 'PREPARING'] as OrderStatus[],
    },
    {
      orderNumber: 'HM-SEED-003',
      status: 'SHIPPED' as OrderStatus,
      userId: customer2?.id,
      customerName: 'مریم احمدی',
      customerPhone: '09122222222',
      deliveryAddress: 'تهران، پونک، بلوار میرزابابایی، پلاک ۸',
      addressTitle: 'منزل',
      items: [
        { slug: 'maye-zarfshuyi-1l', quantity: 2 },
        { slug: 'lamp-led-9w', quantity: 1 },
      ],
      logs: ['NEW', 'PREPARING', 'SHIPPED'] as OrderStatus[],
    },
    {
      orderNumber: 'HM-SEED-004',
      status: 'DELIVERED' as OrderStatus,
      userId: customer3?.id,
      customerName: 'رضا کریمی',
      customerPhone: '09123333333',
      deliveryAddress: 'تهران، نیاوران، خیابان باهنر، پلاک ۲۵',
      addressTitle: 'محل کار',
      couponCode: 'WELCOME10',
      couponId: welcomeCoupon?.id,
      discountAmount: 42000,
      items: [
        { slug: 'panir-liquan-400g', quantity: 1 },
        { slug: 'nooshabe-pepsi-1-5l', quantity: 2 },
        { slug: 'goje-1kg', quantity: 2 },
        { slug: 'shokolat-farmand', quantity: 1 },
      ],
      logs: ['NEW', 'PREPARING', 'SHIPPED', 'DELIVERED'] as OrderStatus[],
    },
    {
      orderNumber: 'HM-SEED-005',
      status: 'CANCELLED' as OrderStatus,
      userId: undefined,
      customerName: 'مهمان نمونه',
      customerPhone: '09124444444',
      deliveryAddress: 'تهران، ونک، خیابان ملاصدرا، پلاک ۳',
      addressTitle: 'منزل',
      items: [{ slug: 'sib-1kg', quantity: 1 }],
      logs: ['NEW', 'CANCELLED'] as OrderStatus[],
    },
  ];

  for (const seed of orderSeeds) {
    const lineItems = await Promise.all(
      seed.items.map(async (item) => {
        const product = await productBySlug(item.slug);
        const price = product.discountPrice ?? product.price;
        return {
          productId: product.id,
          quantity: item.quantity,
          price,
          name: product.name,
        };
      })
    );

    const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = seed.discountAmount ?? 0;
    const totalPrice = subtotal - discountAmount;

    const order = await prisma.order.upsert({
      where: { orderNumber: seed.orderNumber },
      update: {
        status: seed.status,
        subtotal,
        discountAmount,
        totalPrice,
        customerName: seed.customerName,
        customerPhone: seed.customerPhone,
        deliveryAddress: seed.deliveryAddress,
        addressTitle: seed.addressTitle,
        couponCode: seed.couponCode ?? null,
        couponId: seed.couponId ?? null,
        userId: seed.userId ?? null,
      },
      create: {
        orderNumber: seed.orderNumber,
        status: seed.status,
        subtotal,
        discountAmount,
        totalPrice,
        customerName: seed.customerName,
        customerPhone: seed.customerPhone,
        deliveryAddress: seed.deliveryAddress,
        addressTitle: seed.addressTitle,
        couponCode: seed.couponCode ?? null,
        couponId: seed.couponId ?? null,
        userId: seed.userId ?? null,
      },
    });

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderStatusLog.deleteMany({ where: { orderId: order.id } });
    await prisma.notification.deleteMany({ where: { orderId: order.id } });

    await prisma.orderItem.createMany({
      data: lineItems.map((item) => ({ ...item, orderId: order.id })),
    });

    for (const [index, status] of seed.logs.entries()) {
      await prisma.orderStatusLog.create({
        data: {
          orderId: order.id,
          status,
          note: index === 0 ? 'ثبت سفارش نمونه' : `تغییر وضعیت به ${status}`,
          createdAt: new Date(Date.now() - (seed.logs.length - index) * 3600000),
        },
      });
    }

    if (seed.status === 'SHIPPED' && customer2) {
      await prisma.notification.create({
        data: {
          userId: customer2.id,
          orderId: order.id,
          title: 'سفارش ارسال شد',
          message: `سفارش ${seed.orderNumber} ارسال شد و به زودی تحویل داده می‌شود.`,
          type: NotificationType.ORDER_STATUS,
        },
      });
    }

    if (seed.status === 'DELIVERED' && customer3) {
      await prisma.notification.create({
        data: {
          userId: customer3.id,
          orderId: order.id,
          title: 'سفارش تحویل شد',
          message: `سفارش ${seed.orderNumber} با موفقیت تحویل داده شد.`,
          type: NotificationType.ORDER_STATUS,
        },
      });
    }
  }
}

async function seedCart() {
  const customer = await prisma.user.findUnique({ where: { phone: '09121111111' } });
  if (!customer) return;

  const milk = await prisma.product.findUnique({ where: { slug: 'shir-pasteurized-1l' } });
  const chips = await prisma.product.findUnique({ where: { slug: 'chips-mazmaz-100g' } });
  if (!milk || !chips) return;

  const cart = await prisma.cart.upsert({
    where: { userId: customer.id },
    update: {},
    create: { userId: customer.id },
  });

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.createMany({
    data: [
      { cartId: cart.id, productId: milk.id, quantity: 2 },
      { cartId: cart.id, productId: chips.id, quantity: 1 },
    ],
  });
}

async function main() {
  console.log('🌱 Seeding database...');
  /** کاتالوگ پوشاک: `npm run import:woocommerce` — seed قدیمی سوپرمارکت فقط با SEED_HYPERMARKET_CATALOG=true */
  const seedHypermarketCatalog = process.env.SEED_HYPERMARKET_CATALOG === 'true';

  for (const adminPhone of config.adminPhones) {
    await prisma.user.upsert({
      where: { phone: adminPhone },
      update: {
        role: 'ADMIN' as UserRole,
        firstName: 'مدیر',
        lastName: SITE_NAME,
        isActive: true,
      },
      create: {
        phone: adminPhone,
        firstName: 'مدیر',
        lastName: SITE_NAME,
        role: 'ADMIN' as UserRole,
      },
    });
    console.log(`✅ Admin user: ${adminPhone}`);
  }

  for (const customer of demoCustomers) {
    await prisma.user.upsert({
      where: { phone: customer.phone },
      update: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        role: 'CUSTOMER',
        isActive: true,
      },
      create: {
        ...customer,
        role: 'CUSTOMER',
      },
    });
  }
  console.log('✅ Demo customers created');

  if (seedHypermarketCatalog) {
    for (const cat of categories) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: cat,
        create: cat,
      });
    }
    console.log('✅ Categories created (hypermarket sample)');

    for (const [categorySlug, tags] of Object.entries(categoryTags)) {
      const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!category) continue;

      for (const tag of tags) {
        await prisma.tag.upsert({
          where: { categoryId_slug: { categoryId: category.id, slug: tag.slug } },
          update: { name: tag.name, sortOrder: tag.sortOrder, icon: tag.icon ?? null },
          create: {
            categoryId: category.id,
            name: tag.name,
            slug: tag.slug,
            sortOrder: tag.sortOrder,
            icon: tag.icon ?? null,
          },
        });
      }
    }
    console.log('✅ Tags created (hypermarket sample)');

    await prisma.slider.deleteMany({});
    await prisma.slider.createMany({
      data: [
        {
          title: 'کالکشن پوشاک',
          image: '/images/placeholder-product.svg',
          linkUrl: '/categories/woman-clothe',
          sortOrder: 1,
          placement: 'HOME_TOP',
          isActive: true,
        },
      ],
    });
    console.log('✅ Sliders created (sample)');
  } else {
    console.log('⏭️ Skipping hypermarket catalog (use npm run import:woocommerce)');
  }

  await prisma.customerGroup.upsert({
    where: { id: 'seed-vip-group' },
    update: { name: 'مشتریان VIP', description: 'مشتریان با خرید بالا' },
    create: { id: 'seed-vip-group', name: 'مشتریان VIP', description: 'مشتریان با خرید بالا' },
  });
  console.log('✅ Customer groups created');

  await prisma.product.updateMany({
    where: { slug: { startsWith: 'fake-' } },
    data: { isActive: false },
  });

  if (seedHypermarketCatalog) {
    for (const prod of products) {
      await upsertProduct(prod);
    }
    console.log(`✅ Products created (${products.length})`);
  }

  for (const page of contentPages) {
    await prisma.contentPage.upsert({
      where: { slug: page.slug },
      update: {
        title: page.title,
        body: page.body,
        isPublished: true,
      },
      create: {
        ...page,
        isPublished: true,
      },
    });
  }
  console.log('✅ Content pages created');

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {
        title: coupon.title,
        type: coupon.type,
        value: coupon.value,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscount ?? null,
        usageLimit: coupon.usageLimit ?? null,
        perUserLimit: coupon.perUserLimit ?? null,
        isActive: true,
      },
      create: {
        ...coupon,
        maxDiscount: coupon.maxDiscount ?? null,
        isActive: true,
      },
    });
  }
  console.log('✅ Coupons created');

  for (const customer of demoCustomers) {
    const user = await prisma.user.findUnique({ where: { phone: customer.phone } });
    if (!user) continue;

    await prisma.address.deleteMany({ where: { userId: user.id } });
    await prisma.address.create({
      data: {
        userId: user.id,
        title: 'منزل',
        address: `تهران، آدرس نمونه ${customer.firstName} ${customer.lastName}`,
        province: 'تهران',
        city: 'تهران',
        postalCode: '1234567890',
        plaque: '1',
        unit: '1',
        isDefault: true,
      },
    });

    const existingWelcome = await prisma.notification.findFirst({
      where: { userId: user.id, title: `خوش آمدید به ${SITE_NAME}` },
    });
    if (!existingWelcome) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: `خوش آمدید به ${SITE_NAME}`,
          message: `${customer.firstName} عزیز، به ${SITE_NAME} خوش آمدید.`,
          type: NotificationType.GENERAL,
        },
      });
    }
  }
  console.log('✅ Addresses and notifications created');

  if (seedHypermarketCatalog) {
    await seedOrders();
    console.log('✅ Sample orders created');

    await seedCart();
    console.log('✅ Sample cart created');
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
