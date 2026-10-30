<script setup lang="ts">
const route = useRoute();
const api = useApi();

const unreadCount = ref(0);

const navItems = [
  { to: '/profile', label: 'حساب', icon: 'lucide:user', exact: true },
  { to: '/profile/favorites', label: 'علاقه‌مندی', icon: 'lucide:heart' },
  { to: '/profile/orders', label: 'سفارش‌ها', icon: 'lucide:package' },
  { to: '/profile/notifications', label: 'اعلان‌ها', icon: 'lucide:bell', badge: true },
  { to: '/profile/addresses', label: 'آدرس‌ها', icon: 'lucide:map-pin' },
  { to: '/profile/password', label: 'رمز عبور', icon: 'lucide:key-round' },
  { to: '/profile/edit', label: 'تنظیمات', icon: 'lucide:settings' },
];

function isActive(item: (typeof navItems)[0]) {
  if (item.exact) return route.path === item.to;
  return route.path.startsWith(item.to);
}

onMounted(async () => {
  try {
    const { data } = await api.get<{ unreadCount: number }>('/notifications');
    unreadCount.value = data.unreadCount;
  } catch {
    // ignore
  }
});

watch(
  () => route.path,
  async () => {
    if (!route.path.startsWith('/profile')) return;
    try {
      const { data } = await api.get<{ unreadCount: number }>('/notifications');
      unreadCount.value = data.unreadCount;
    } catch {
      // ignore
    }
  }
);
</script>

<template>
  <nav class="sticky top-14 md:top-16 z-40 bg-white/95 backdrop-blur border-b border-gray-100 -mx-0">
    <div class="max-w-3xl mx-auto px-4 py-2">
      <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm whitespace-nowrap transition-colors shrink-0',
            isActive(item)
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          ]"
        >
          <AppIcon :name="item.icon" size="sm" />
          {{ item.label }}
          <span
            v-if="item.badge && unreadCount > 0"
            :class="[
              'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
              isActive(item) ? 'bg-white text-primary-600' : 'bg-red-500 text-white',
            ]"
          >
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>
