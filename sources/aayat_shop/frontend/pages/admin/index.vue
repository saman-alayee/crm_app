<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });

const api = useApi();

const stats = ref<{
  orders: {
    total: number;
    newOrders: number;
    preparing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
  products: number;
  categories: number;
} | null>(null);

onMounted(async () => {
  const { data } = await api.get<typeof stats.value>('/admin/stats');
  stats.value = data;
});

const { navVisible, isFullAdmin } = useAdminAccess();

const quickLinks = [
  { to: '/admin/orders?status=NEW', label: 'منتظر ارسال مشتری', desc: 'پرداخت شده؛ هنوز پست نشود', icon: 'lucide:inbox' },
  { to: '/admin/orders?status=PREPARING', label: 'درخواست ارسال', desc: 'بسته‌بندی و پست کنید', icon: 'lucide:package' },
  { to: '/admin/products', label: 'محصولات', desc: 'قیمت، موجودی، عکس و دسته', icon: 'lucide:shopping-basket' },
  { to: '/admin/categories', label: 'عکس دسته‌ها', desc: 'تصویر کارت‌های صفحه اول', icon: 'lucide:images' },
  { to: '/admin/sliders', label: 'بنر صفحه اول', desc: 'اسلاید بالای فروشگاه', icon: 'lucide:image' },
  { to: '/admin/reviews', label: 'نظرات', desc: 'نظر مشتریان زیر محصولات', icon: 'lucide:star' },
  { to: '/admin/customers', label: 'مشتریان', desc: 'خریدها و شماره تماس', icon: 'lucide:user-round' },
  { to: '/admin/settings', label: 'هزینه ارسال و سبد', desc: 'متن ارسال و زمان ۳۰ دقیقه‌ای سبد', icon: 'lucide:truck' },
  { to: '/admin/home-picks', label: 'صفحه اول', desc: 'انتخاب دستی تخفیف‌دار و ویژه', icon: 'lucide:sparkles' },
  { to: '/admin/category-feed', label: 'محصولات دسته', desc: 'ترتیب نمایش هر دسته در صفحه اول', icon: 'lucide:list-ordered' },
  { to: '/admin/sales', label: 'گزارش فروش', desc: 'درآمد و پرفروش‌ها در بازه تاریخ', icon: 'lucide:bar-chart-3' },
  { to: '/admin/coupons', label: 'کدهای تخفیف', desc: 'کدی که مشتری در سبد وارد می‌کند', icon: 'lucide:ticket-percent' },
  { to: '/admin/users', label: 'کاربران و دسترسی', desc: 'مدیر، مسئول، پرسنل', icon: 'lucide:users' },
  { to: '/admin/backup', label: 'بکاپ دیتابیس', desc: 'دانلود نسخه فشرده دیتابیس', icon: 'lucide:database' },
  { to: '/admin/content', label: 'قوانین و مقررات', desc: 'متن صفحه قوانین سایت', icon: 'lucide:file-text' },
];

const visibleLinks = computed(() =>
  quickLinks.filter((link) => {
    const path = link.to.split('?')[0];
    if (path === '/admin/backup') return isFullAdmin.value;
    return navVisible(path);
  })
);

useHead({ title: 'داشبورد - پنل مدیریت' });
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-gray-800 mb-1">داشبورد</h1>
    <p class="text-sm leading-6 text-gray-500 mb-6 max-w-3xl">
      از اینجا سفارش‌های پرداخت‌شده، لباس‌ها، بنر صفحه اول و متن‌های فروشگاه را مدیریت کنید.
      سفارش تا وقتی مشتری دکمهٔ «ارسال» را نزند نباید پست شود. بعد از آن در «درخواست ارسال» می‌آید.
    </p>

    <div v-if="stats" class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
      <div class="card p-4">
        <AppIcon name="lucide:clipboard-list" size="sm" class="text-gray-400 mb-2" />
        <p class="text-xs text-gray-500">کل سفارش</p>
        <p class="text-2xl font-bold">{{ stats.orders.total }}</p>
      </div>
      <div class="card p-4 border-s-4 border-s-blue-500">
        <AppIcon name="lucide:bell-dot" size="sm" class="text-blue-500 mb-2" />
        <p class="text-xs text-gray-500">جدید</p>
        <p class="text-2xl font-bold text-blue-600">{{ stats.orders.newOrders }}</p>
      </div>
      <div class="card p-4 border-s-4 border-s-yellow-500">
        <AppIcon name="lucide:package-open" size="sm" class="text-yellow-600 mb-2" />
        <p class="text-xs text-gray-500">آماده‌سازی</p>
        <p class="text-2xl font-bold text-yellow-600">{{ stats.orders.preparing }}</p>
      </div>
      <div class="card p-4 border-s-4 border-s-purple-500">
        <AppIcon name="lucide:truck" size="sm" class="text-purple-600 mb-2" />
        <p class="text-xs text-gray-500">ارسال شده</p>
        <p class="text-2xl font-bold text-purple-600">{{ stats.orders.shipped }}</p>
      </div>
      <div class="card p-4 border-s-4 border-s-green-500">
        <AppIcon name="lucide:circle-check-big" size="sm" class="text-green-600 mb-2" />
        <p class="text-xs text-gray-500">تحویل</p>
        <p class="text-2xl font-bold text-green-600">{{ stats.orders.delivered }}</p>
      </div>
      <div class="card p-4">
        <AppIcon name="lucide:circle-x" size="sm" class="text-red-400 mb-2" />
        <p class="text-xs text-gray-500">لغو شده</p>
        <p class="text-2xl font-bold text-red-500">{{ stats.orders.cancelled }}</p>
      </div>
    </div>

    <h2 class="text-sm font-bold text-gray-700 mb-3">دسترسی سریع</h2>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="link in visibleLinks"
        :key="link.to"
        :to="link.to"
        class="card p-4 hover:shadow-md transition-shadow flex items-start gap-3"
      >
        <div class="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
          <AppIcon :name="link.icon" size="md" class="text-primary-600" />
        </div>
        <div>
          <p class="font-medium text-gray-800">{{ link.label }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ link.desc }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
