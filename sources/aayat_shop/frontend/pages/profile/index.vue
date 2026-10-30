<script setup lang="ts">
import { SITE_NAME } from '~/constants/site';

definePageMeta({ layout: 'profile', middleware: 'auth' });

const authStore = useAuthStore();
const api = useApi();
const { toPersianDigits, formatNumber } = useFormat();

const stats = ref({ orders: 0, unread: 0, addresses: 0 });
const loading = ref(true);

const menuItems = [
  {
    to: '/profile/favorites',
    label: 'علاقه‌مندی‌ها',
    desc: 'محصولات ذخیره‌شده',
    icon: 'lucide:bookmark',
    color: 'red',
  },
  {
    to: '/profile/orders',
    label: 'سفارش‌های من',
    desc: 'پیگیری وضعیت خریدها',
    icon: 'lucide:package',
    color: 'blue',
  },
  {
    to: '/profile/notifications',
    label: 'اعلان‌ها',
    desc: 'وضعیت ارسال و پیام‌ها',
    icon: 'lucide:bell',
    color: 'orange',
    badge: true,
  },
  {
    to: '/profile/addresses',
    label: 'آدرس‌های من',
    desc: 'مدیریت آدرس تحویل',
    icon: 'lucide:map-pin',
    color: 'green',
  },
  {
    to: '/profile/edit',
    label: 'اطلاعات حساب',
    desc: 'نام و تنظیمات پروفایل',
    icon: 'lucide:user-cog',
    color: 'purple',
  },
  {
    to: '/profile/password',
    label: 'رمز عبور',
    desc: 'تعیین یا تغییر رمز ورود',
    icon: 'lucide:key-round',
    color: 'blue',
  },
];

const initials = computed(() => {
  const u = authStore.user;
  if (u?.firstName && u?.lastName) {
    return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`;
  }
  if (u?.firstName) return u.firstName.slice(0, 2);
  return u?.phone?.slice(-2) || '؟';
});

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  red: 'bg-red-50 text-red-600',
};

onMounted(async () => {
  loading.value = true;
  try {
    const [ordersRes, notifRes, addrRes] = await Promise.all([
      api.get<{ pagination: { total: number } }>('/orders?limit=1'),
      api.get<{ unreadCount: number }>('/notifications'),
      api.get<unknown[]>('/addresses'),
    ]);
    stats.value = {
      orders: ordersRes.data.pagination?.total ?? 0,
      unread: notifRes.data.unreadCount ?? 0,
      addresses: Array.isArray(addrRes.data) ? addrRes.data.length : 0,
    };
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
});

useHead({ title: `حساب کاربری - ${SITE_NAME}` });
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-white p-6 mb-5 shadow-lg">
      <div class="absolute -top-8 -start-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      <div class="absolute -bottom-6 -end-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />

      <div class="relative flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl font-bold shrink-0">
          {{ initials }}
        </div>
        <div class="min-w-0">
          <h1 class="text-lg font-bold truncate">{{ authStore.fullName }}</h1>
          <p class="text-sm text-primary-100 mt-0.5" dir="ltr">{{ authStore.user?.phone }}</p>
          <p v-if="authStore.isAdmin" class="text-xs bg-white/20 inline-block px-2 py-0.5 rounded-full mt-2">
            مدیر سیستم
          </p>
        </div>
      </div>

      <div v-if="!loading" class="relative grid grid-cols-3 gap-2 mt-5">
        <NuxtLink to="/profile/orders" class="bg-white/15 backdrop-blur rounded-xl p-3 text-center hover:bg-white/25 transition-colors">
          <p class="text-lg font-bold">{{ formatNumber(stats.orders) }}</p>
          <p class="text-[11px] text-primary-100">سفارش</p>
        </NuxtLink>
        <NuxtLink to="/profile/notifications" class="bg-white/15 backdrop-blur rounded-xl p-3 text-center hover:bg-white/25 transition-colors relative">
          <p class="text-lg font-bold">{{ formatNumber(stats.unread) }}</p>
          <p class="text-[11px] text-primary-100">اعلان جدید</p>
        </NuxtLink>
        <NuxtLink to="/profile/addresses" class="bg-white/15 backdrop-blur rounded-xl p-3 text-center hover:bg-white/25 transition-colors">
          <p class="text-lg font-bold">{{ formatNumber(stats.addresses) }}</p>
          <p class="text-[11px] text-primary-100">آدرس</p>
        </NuxtLink>
      </div>
    </div>

    <!-- Quick menu -->
    <div class="space-y-2 mb-6">
      <NuxtLink
        v-for="item in menuItems"
        :key="item.to"
        :to="item.to"
        class="card flex items-center gap-3 p-4 hover:shadow-md transition-all active:scale-[0.99]"
      >
        <div :class="['w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colorMap[item.color]]">
          <AppIcon :name="item.icon" size="md" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-gray-800">{{ item.label }}</span>
            <span
              v-if="item.badge && stats.unread > 0"
              class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            >
              {{ stats.unread }}
            </span>
          </div>
          <p class="text-xs text-gray-400 mt-0.5">{{ item.desc }}</p>
        </div>
        <AppIcon name="lucide:chevron-left" size="md" class="text-gray-300 shrink-0" />
      </NuxtLink>

      <NuxtLink
        v-if="authStore.isAdmin"
        to="/admin"
        class="card flex items-center gap-3 p-4 border border-primary-100 bg-primary-50/50 hover:bg-primary-50 transition-colors"
      >
        <div class="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center">
          <AppIcon name="lucide:layout-dashboard" size="md" class="text-primary-600" />
        </div>
        <div class="flex-1">
          <span class="text-sm font-semibold text-primary-700">پنل مدیریت</span>
          <p class="text-xs text-primary-500 mt-0.5">مدیریت فروشگاه</p>
        </div>
        <AppIcon name="lucide:chevron-left" size="md" class="text-primary-400" />
      </NuxtLink>
    </div>

    <!-- Footer actions -->
    <div class="space-y-2">
      <NuxtLink to="/pages/terms" class="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 px-1">
        <AppIcon name="lucide:file-text" size="sm" />
        قوانین و مقررات
      </NuxtLink>
      <button
        class="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 px-1 w-full"
        @click="authStore.logout(); navigateTo('/')"
      >
        <AppIcon name="lucide:log-out" size="sm" />
        خروج از حساب
      </button>
    </div>
  </div>
</template>
