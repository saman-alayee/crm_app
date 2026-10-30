<script setup lang="ts">
const auth = useAuthStore();
const theme = useTheme();
const route = useRoute();
const mobileNavOpen = ref(false);
const unread = ref(0);
const panelLocked = ref(false);
const { api } = useApi();

const allNav = [
  { to: '/', label: 'داشبورد', hint: 'خلاصه وضعیت', icon: 'lucide:layout-dashboard', exact: true, permission: 'dashboard.view' },
  { to: '/employees', label: 'کارکنان', hint: 'پرسنل و پرونده', icon: 'lucide:users', permission: 'employees.view' },
  { to: '/departments', label: 'دپارتمان‌ها', hint: 'واحدهای سازمان', icon: 'lucide:building-2', permission: 'departments.view' },
  { to: '/leave', label: 'مرخصی', hint: 'درخواست و تأیید', icon: 'lucide:calendar-days', permission: 'leave.view' },
  { to: '/salary', label: 'حقوق و مساعده', hint: 'درخواست مالی', icon: 'lucide:wallet', permission: 'salary.view' },
  { to: '/bank', label: 'حساب بانکی', hint: 'شبا و بانک', icon: 'lucide:landmark', permission: 'bank.view' },
  { to: '/tasks', label: 'وظایف', hint: 'کارهای محول‌شده', icon: 'lucide:list-checks', permission: 'tasks.view' },
  { to: '/announcements', label: 'اطلاعیه‌ها', hint: 'پیام سازمانی', icon: 'lucide:megaphone', permission: 'announcements.view' },
  { to: '/roles', label: 'دسترسی‌ها', hint: 'نقش و مجوز', icon: 'lucide:shield', permission: 'roles.view' },
  { to: '/notifications', label: 'اعلان‌ها', hint: 'پیام‌های شما', icon: 'lucide:bell', permission: 'notifications.view' },
  { to: '/reports', label: 'گزارش‌ها', hint: 'آمار کارکنان', icon: 'lucide:bar-chart-3', permission: 'reports.view' },
  { to: '/audit', label: 'تاریخچه', hint: 'لاگ تغییرات', icon: 'lucide:scroll-text', permission: 'audit.view' },
  { to: '/backup', label: 'بکاپ', hint: 'پشتیبان دیتابیس', icon: 'lucide:database', permission: 'backup.export' },
  { to: '/settings', label: 'تنظیمات', hint: 'ظاهر و قفل', icon: 'lucide:settings', permission: 'settings.view' },
];

const nav = computed(() => allNav.filter((item) => auth.can(item.permission)));

async function onLogout() {
  await auth.logout();
  await navigateTo('/login');
}

async function refreshUnread() {
  if (!auth.can('notifications.view')) return;
  try {
    const res = await api<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count', {
      cacheTtlMs: 8_000,
    });
    unread.value = res.data.unreadCount;
  } catch {
    /* ignore */
  }
}

async function refreshPanelLock() {
  if (!auth.hasFullAccess) {
    panelLocked.value = false;
    return;
  }
  try {
    const res = await api<{ success: boolean; data: { locked: boolean } }>('/settings/panel-lock', {
      cacheTtlMs: 10_000,
    });
    panelLocked.value = !!res.data.locked;
  } catch {
    panelLocked.value = false;
  }
}

let unreadTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleUnreadRefresh() {
  if (unreadTimer) return;
  unreadTimer = setTimeout(() => {
    unreadTimer = null;
    void refreshUnread();
  }, 1200);
}

onMounted(() => {
  auth.hydrate();
  void auth.fetchMe().then(() => {
    void refreshUnread();
    void refreshPanelLock();
  });
});

watch(
  () => route.path,
  () => {
    mobileNavOpen.value = false;
    // Don't hammer API on every click — slight debounce is enough for badge
    scheduleUnreadRefresh();
  }
);
</script>

<template>
  <div class="min-h-screen" style="color: var(--hr-text)">
    <aside class="admin-shell-aside fixed top-0 start-0 z-sidebar hidden h-full flex-col border-e lg:flex">
      <div class="border-b px-5 py-5" style="border-color: color-mix(in srgb, var(--hr-border) 70%, transparent)">
        <div class="flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
            <AppIcon name="lucide:briefcase-business" size="sm" />
          </div>
          <div>
            <p class="text-sm font-semibold tracking-tight">فروشگاه سامی</p>
            <p class="text-[11px]" style="color: var(--hr-muted)">پنل کارکنان</p>
          </div>
        </div>
      </div>
      <nav class="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="admin-nav-link"
          :title="item.hint"
          :class="{
            'admin-nav-active': item.exact
              ? route.path === item.to
              : route.path === item.to || route.path.startsWith(item.to + '/'),
          }"
        >
          <AppIcon :name="item.icon" size="md" class="shrink-0 opacity-80" />
          <span class="flex-1 min-w-0">
            <span class="block truncate">{{ item.label }}</span>
            <span class="block truncate text-[10px] font-normal opacity-70">{{ item.hint }}</span>
          </span>
          <span
            v-if="item.to === '/notifications' && unread > 0"
            class="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white"
          >
            {{ unread > 99 ? '۹۹+' : unread }}
          </span>
        </NuxtLink>
      </nav>
    </aside>

    <Transition name="admin-drawer">
      <div v-if="mobileNavOpen" class="fixed inset-0 z-50 lg:hidden">
        <div class="admin-drawer-backdrop absolute inset-0 bg-black/40" @click="mobileNavOpen = false" />
        <aside
          class="admin-drawer-panel absolute top-0 start-0 flex h-full w-72 flex-col shadow-xl"
          style="background: var(--hr-card)"
        >
          <div class="flex items-center justify-between border-b p-4" style="border-color: var(--hr-border)">
            <p class="font-bold">فروشگاه سامی</p>
            <button class="rounded-lg p-2 hover:bg-primary-50" type="button" @click="mobileNavOpen = false">
              <AppIcon name="lucide:x" size="lg" />
            </button>
          </div>
          <nav class="flex-1 space-y-1 overflow-y-auto p-4">
            <NuxtLink
              v-for="item in nav"
              :key="item.to"
              :to="item.to"
              class="admin-nav-link"
              :title="item.hint"
              :class="{
                'admin-nav-active': item.exact
                  ? route.path === item.to
                  : route.path === item.to || route.path.startsWith(item.to + '/'),
              }"
            >
              <AppIcon :name="item.icon" size="md" class="shrink-0 opacity-80" />
              <span class="flex-1 min-w-0">
                <span class="block truncate">{{ item.label }}</span>
                <span class="block truncate text-[10px] font-normal opacity-70">{{ item.hint }}</span>
              </span>
            </NuxtLink>
          </nav>
        </aside>
      </div>
    </Transition>

    <div class="lg:ms-sidebar">
      <header class="admin-shell-header sticky top-0 z-header border-b px-4 py-2.5 lg:px-6">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              class="rounded-lg p-2 lg:hidden"
              style="background: var(--hr-primary-50)"
              type="button"
              @click="mobileNavOpen = true"
            >
              <AppIcon name="lucide:menu" size="lg" />
            </button>
            <div>
              <p class="text-sm font-medium">{{ auth.displayName }}</p>
              <p class="text-xs" style="color: var(--hr-muted)">
                {{ auth.roles.map((r) => r.name).join('، ') || 'بدون نقش' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="icon-chip"
              type="button"
              :title="theme.state.value.dark ? 'حالت روشن' : 'حالت تاریک'"
              @click="theme.toggleDark()"
            >
              <AppIcon :name="theme.state.value.dark ? 'lucide:sun' : 'lucide:moon'" size="md" />
            </button>
            <NuxtLink
              v-if="auth.can('notifications.view')"
              to="/notifications"
              class="icon-chip relative"
            >
              <AppIcon name="lucide:bell" size="md" :class="unread > 0 ? 'text-red-500' : ''" />
              <span
                v-if="unread > 0"
                class="absolute -top-0.5 -end-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
              >
                {{ unread > 99 ? '99+' : unread }}
              </span>
            </NuxtLink>
            <button
              class="logout-chip"
              type="button"
              @click="onLogout"
            >
              <AppIcon name="lucide:log-out" size="sm" />
              خروج
            </button>
          </div>
        </div>
      </header>

      <div
        v-if="panelLocked"
        class="flex items-center justify-between gap-3 border-b px-4 py-2 text-sm lg:px-7"
        style="background: var(--hr-danger-bg); border-color: var(--hr-danger-border); color: var(--hr-danger)"
      >
        <span class="inline-flex items-center gap-2">
          <AppIcon name="lucide:lock" size="sm" />
          پنل برای سایر کاربران قفل است — فقط شما دسترسی دارید
        </span>
        <NuxtLink to="/settings" class="text-xs font-medium underline-offset-2 hover:underline">مدیریت قفل</NuxtLink>
      </div>

      <main class="p-4 lg:px-7 lg:py-6">
        <div class="admin-page-shell">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-drawer-enter-active,
.admin-drawer-leave-active {
  transition: opacity var(--ds-duration) ease;
}
.admin-drawer-enter-active .admin-drawer-panel,
.admin-drawer-leave-active .admin-drawer-panel {
  transition: transform var(--ds-duration-slow) var(--ds-ease);
}
.admin-drawer-enter-from,
.admin-drawer-leave-to {
  opacity: 0;
}
.admin-drawer-enter-from .admin-drawer-panel,
.admin-drawer-leave-to .admin-drawer-panel {
  transform: translateX(100%);
}
</style>
