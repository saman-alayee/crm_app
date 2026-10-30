<script setup lang="ts">
const route = useRoute();
const authStore = useAuthStore();
const { navVisible, roleLabel, canAccessPath, role, isFullAdmin } = useAdminAccess();
const {
  enabled: alarmEnabled,
  pendingCount,
  latestAlert,
  dismissAlert,
  openOrders,
  unlockAudio,
  requestNotificationPermission,
} = useNewOrderAlarm();
const mobileNavOpen = ref(false);

const allNavItems = [
  { to: '/admin', label: 'داشبورد', icon: 'lucide:layout-dashboard', exact: true },
  { to: '/admin/orders', label: 'سفارش‌ها', icon: 'lucide:package' },
  { to: '/admin/sales', label: 'گزارش فروش', icon: 'lucide:bar-chart-3' },
  { to: '/admin/products', label: 'محصولات', icon: 'lucide:shopping-basket' },
  { to: '/admin/reviews', label: 'نظرات', icon: 'lucide:star' },
  { to: '/admin/home-picks', label: 'صفحه اول', icon: 'lucide:sparkles' },
  { to: '/admin/category-feed', label: 'محصولات دسته', icon: 'lucide:list-ordered' },
  { to: '/admin/categories', label: 'دسته‌بندی', icon: 'lucide:layers' },
  { to: '/admin/sliders', label: 'بنر صفحه اول', icon: 'lucide:images' },
  { to: '/admin/customers', label: 'مشتریان', icon: 'lucide:user-round' },
  { to: '/admin/coupons', label: 'کدهای تخفیف', icon: 'lucide:ticket-percent' },
  { to: '/admin/users', label: 'کاربران', icon: 'lucide:users' },
  { to: '/admin/backup', label: 'بکاپ دیتابیس', icon: 'lucide:database' },
  { to: '/admin/settings', label: 'تنظیمات', icon: 'lucide:settings' },
  { to: '/admin/content', label: 'قوانین و مقررات', icon: 'lucide:file-text' },
];

const navItems = computed(() =>
  allNavItems.filter((item) => {
    if (item.to === '/admin/backup') return isFullAdmin.value;
    return navVisible(item.to);
  })
);

function onAlarmToggle() {
  unlockAudio();
  if (alarmEnabled.value) void requestNotificationPermission();
}

onMounted(() => {
  // Sync live role from DB → fresh JWT so nav/permissions match assignment
  void authStore.fetchProfile().catch(() => undefined);
});

watch(role, () => {
  if (route.path.startsWith('/admin') && route.path !== '/admin/login' && !canAccessPath(route.path)) {
    void navigateTo('/admin');
  }
});

watch(() => route.path, () => {
  mobileNavOpen.value = false;
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Desktop sidebar -->
    <aside class="fixed top-0 start-0 h-full w-64 bg-white border-e border-gray-200 z-40 hidden lg:flex lg:flex-col">
      <div class="p-6 border-b border-gray-100">
        <NuxtLink to="/admin">
          <AppLogo size="sm" :link="false" />
        </NuxtLink>
        <p class="text-xs text-gray-400 mt-1">پنل مدیریت</p>
      </div>
      <nav class="p-4 space-y-1 flex-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="admin-nav-link"
          :class="{ 'admin-nav-active': item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(item.to + '/') }"
        >
          <AppIcon :name="item.icon" size="md" class="shrink-0 opacity-80" />
          <span class="flex-1">{{ item.label }}</span>
          <span
            v-if="item.to === '/admin/orders' && pendingCount > 0"
            class="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {{ pendingCount > 99 ? '۹۹+' : pendingCount }}
          </span>
        </NuxtLink>
        <hr class="my-4 border-gray-100" />
        <NuxtLink to="/" class="admin-nav-link">
          <AppIcon name="lucide:store" size="md" class="shrink-0 opacity-80" />
          <span>بازگشت به فروشگاه</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- Mobile drawer -->
    <Transition name="admin-drawer">
      <div v-if="mobileNavOpen" class="fixed inset-0 z-50 lg:hidden">
        <div class="admin-drawer-backdrop absolute inset-0 bg-black/40" @click="mobileNavOpen = false" />
        <aside class="admin-drawer-panel absolute top-0 start-0 h-full w-72 bg-white shadow-xl flex flex-col">
          <div class="p-4 border-b flex items-center justify-between">
            <AppLogo size="sm" :link="false" />
            <button class="p-2 rounded-lg hover:bg-gray-100 text-gray-500" @click="mobileNavOpen = false">
              <AppIcon name="lucide:x" size="lg" />
            </button>
          </div>
          <nav class="p-4 space-y-1 flex-1 overflow-y-auto">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="admin-nav-link"
              :class="{ 'admin-nav-active': item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(item.to + '/') }"
            >
              <AppIcon :name="item.icon" size="md" class="shrink-0 opacity-80" />
              <span class="flex-1">{{ item.label }}</span>
              <span
                v-if="item.to === '/admin/orders' && pendingCount > 0"
                class="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
              >
                {{ pendingCount > 99 ? '۹۹+' : pendingCount }}
              </span>
            </NuxtLink>
            <hr class="my-4 border-gray-100" />
            <NuxtLink to="/" class="admin-nav-link">
              <AppIcon name="lucide:store" size="md" class="shrink-0 opacity-80" />
              <span>بازگشت به فروشگاه</span>
            </NuxtLink>
          </nav>
        </aside>
      </div>
    </Transition>

    <div class="lg:ms-64">
      <header class="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 lg:px-6 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              class="lg:hidden p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              @click="mobileNavOpen = true"
            >
              <AppIcon name="lucide:menu" size="lg" />
            </button>
            <div>
              <p class="text-sm font-medium text-gray-800">{{ authStore.fullName }}</p>
              <p class="text-xs text-gray-400">{{ roleLabel }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600"
              title="سفارش‌های در انتظار"
              @click="openOrders"
            >
              <AppIcon name="lucide:bell" size="md" :class="pendingCount > 0 ? 'text-red-500' : ''" />
              <span
                v-if="pendingCount > 0"
                class="absolute -top-0.5 -end-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
              >
                {{ pendingCount > 99 ? '99+' : pendingCount }}
              </span>
            </button>
            <label
              class="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none"
              title="صدا و بنر داخل پنل هنگام سفارش جدید (جدا از پیامک)"
            >
              <input
                v-model="alarmEnabled"
                type="checkbox"
                class="rounded border-gray-300"
                @change="onAlarmToggle"
              />
              نوتیف سفارش
            </label>
            <NuxtLink
              v-if="canAccessPath('/admin/settings')"
              to="/admin/settings"
              class="hidden md:inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 px-2 py-1 rounded-lg hover:bg-gray-50"
              title="تنظیم پیامک نوتیف ثبت سفارش"
            >
              <AppIcon name="lucide:message-square-text" size="sm" />
              پیامک
            </NuxtLink>
            <button
              class="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
              @click="authStore.logout(); navigateTo('/')"
            >
              <AppIcon name="lucide:log-out" size="sm" />
              خروج
            </button>
          </div>
        </div>
      </header>

      <!-- Live new-order alert banner -->
      <Transition name="alert-slide">
        <div
          v-if="latestAlert && alarmEnabled"
          class="bg-red-600 text-white px-4 lg:px-6 py-3 flex items-center justify-between gap-3 shadow-md"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="relative flex h-3 w-3 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span class="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
            <p class="text-sm font-medium truncate">
              سفارش جدید ثبت شد:
              <span class="font-mono" dir="ltr">{{ latestAlert.orderNumber }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="text-sm bg-white text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50"
              @click="openOrders"
            >
              مشاهده
            </button>
            <button
              type="button"
              class="p-1.5 rounded-lg hover:bg-red-500"
              aria-label="بستن"
              @click="dismissAlert"
            >
              <AppIcon name="lucide:x" size="sm" />
            </button>
          </div>
        </div>
      </Transition>

      <main class="p-4 lg:p-6">
        <Transition name="admin-page" mode="out-in">
          <div :key="route.path" class="admin-page-shell">
            <slot />
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-nav-link {
  @apply flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}
.admin-nav-link:hover {
  transform: translateX(-2px);
}
.admin-nav-active {
  @apply bg-primary-50 text-primary-700 font-medium shadow-sm;
}
.admin-nav-active :deep(svg) {
  @apply text-primary-600 opacity-100;
}
.alert-slide-enter-active,
.alert-slide-leave-active {
  transition: all 0.25s ease;
}
.alert-slide-enter-from,
.alert-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.admin-page-enter-active,
.admin-page-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}
.admin-page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.admin-page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.admin-drawer-enter-active,
.admin-drawer-leave-active {
  transition: opacity 0.25s ease;
}
.admin-drawer-enter-active .admin-drawer-panel,
.admin-drawer-leave-active .admin-drawer-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.admin-drawer-enter-from,
.admin-drawer-leave-to {
  opacity: 0;
}
.admin-drawer-enter-from .admin-drawer-panel,
.admin-drawer-leave-to .admin-drawer-panel {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .admin-nav-link,
  .admin-page-enter-active,
  .admin-page-leave-active,
  .admin-drawer-enter-active,
  .admin-drawer-leave-active,
  .admin-drawer-enter-active .admin-drawer-panel,
  .admin-drawer-leave-active .admin-drawer-panel {
    transition: none !important;
    transform: none !important;
  }
}
</style>
