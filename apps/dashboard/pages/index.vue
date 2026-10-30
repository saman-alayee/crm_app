<script setup lang="ts">
const auth = useAuthStore();
const { api } = useApi();
const { formatNumber, formatDate } = useFormat();

type Summary = {
  employeesTotal: number;
  employeesActive: number;
  employeesInactive: number;
  leavePending: number;
  salaryPending: number;
  tasksOpen: number;
  tasksOverdue: number;
  departmentsTotal: number;
  recentNotifications: { id: string; title: string; body: string; isRead: boolean; createdAt: string }[];
  announcements: { id: string; title: string; body: string; isPinned: boolean; publishAt: string }[];
  hireAnniversaries: { id: string; name: string; hireDate: string }[];
};

const summary = ref<Summary | null>(null);
const reveal = ref(false);

const { loading, error } = usePageLoad(async () => {
  void auth.fetchMe();
  const res = await api<{ success: boolean; data: Summary }>('/dashboard/summary', {
    cacheTtlMs: 12_000,
  });
  summary.value = res.data;
  requestAnimationFrame(() => {
    reveal.value = true;
  });
}, 20_000);

const cards = computed(() => {
  const s = summary.value;
  if (!s) return [];
  const all = [
    {
      label: 'کل کارکنان',
      value: s.employeesTotal,
      icon: 'lucide:users',
      to: '/employees',
      tone: 'neutral',
      permission: 'employees.view',
    },
    {
      label: 'فعال',
      value: s.employeesActive,
      icon: 'lucide:user-check',
      to: '/employees',
      tone: 'ok',
      permission: 'employees.view',
    },
    {
      label: 'دپارتمان‌ها',
      value: s.departmentsTotal,
      icon: 'lucide:building-2',
      to: '/departments',
      tone: 'neutral',
      permission: 'departments.view',
    },
    {
      label: auth.can('leave.approve') ? 'مرخصی در انتظار' : 'مرخصی من',
      value: s.leavePending,
      icon: 'lucide:calendar-days',
      to: '/leave',
      tone: 'warn',
      permission: 'leave.view',
    },
    {
      label: auth.can('salary.approve') ? 'مالی در انتظار' : 'مالی من',
      value: s.salaryPending,
      icon: 'lucide:wallet',
      to: '/salary',
      tone: 'warn',
      permission: 'salary.view',
    },
    {
      label: 'وظایف باز',
      value: s.tasksOpen,
      icon: 'lucide:list-checks',
      to: '/tasks',
      tone: 'neutral',
      permission: 'tasks.view',
    },
    {
      label: 'عقب‌افتاده',
      value: s.tasksOverdue,
      icon: 'lucide:alarm-clock',
      to: '/tasks',
      tone: 'danger',
      permission: 'tasks.view',
    },
  ];
  return all.filter((card) => auth.can(card.permission));
});

const quickLinks = computed(() => [
  { to: '/employees', label: 'کارکنان', desc: 'پرسنل و پرونده', icon: 'lucide:users', permission: 'employees.view' },
  { to: '/announcements', label: 'اطلاعیه‌ها', desc: 'اعلان سازمانی', icon: 'lucide:megaphone', permission: 'announcements.view' },
  { to: '/departments', label: 'دپارتمان‌ها', desc: 'ساختار سازمان', icon: 'lucide:building-2', permission: 'departments.view' },
  {
    to: '/leave',
    label: 'مرخصی',
    desc: auth.can('leave.approve') ? 'تأیید درخواست‌ها' : 'درخواست و پیگیری',
    icon: 'lucide:calendar-days',
    permission: 'leave.view',
  },
  { to: '/tasks', label: 'وظایف', desc: 'پیگیری کارها', icon: 'lucide:list-checks', permission: 'tasks.view' },
  { to: '/settings', label: 'تنظیمات', desc: 'تم، قفل و بکاپ', icon: 'lucide:settings', permission: 'settings.view' },
  { to: '/reports', label: 'گزارش‌ها', desc: 'آمار خروجی', icon: 'lucide:bar-chart-3', permission: 'reports.view' },
]);

useHead({ title: 'داشبورد - پنل مدیریت' });
</script>

<template>
  <div class="dash" :class="{ 'dash--ready': reveal && !loading }">
    <header class="dash__intro dash-rise" style="--i: 0">
      <p class="page-header__eyebrow">فروشگاه سامی</p>
      <h1 class="dash__title">سلام، {{ auth.displayName }}</h1>
      <p class="dash__sub">از اینجا وضعیت کلی را ببینید و با یک کلیک به بخش موردنظر بروید</p>
    </header>

    <UiHelpBanner
      class="dash-rise"
      style="--i: 0"
      storage-key="dashboard-welcome"
      title="چطور از داشبورد استفاده کنم؟"
      :steps="[
        'کارت‌های رنگی بالا را بزنید تا مستقیم به مرخصی، مالی یا وظایف بروید.',
        'اگر عددی قرمز یا نارنجی دیدید، یعنی کاری در انتظار تأیید شماست.',
        'از «دسترسی سریع» برای رفتن به بخش‌های پرکاربرد استفاده کنید.',
      ]"
    />

    <div v-if="error" class="dash__error dash-rise" style="--i: 1">{{ error }}</div>

    <DashboardSkeleton v-if="loading" />

    <template v-else-if="summary">
      <section class="dash__stats">
        <NuxtLink
          v-for="(card, idx) in cards"
          :key="card.label"
          :to="card.to"
          class="stat-tile dash-rise hover-lift"
          :class="`stat-tile--${card.tone}`"
          :style="{ '--i': idx + 1 }"
        >
          <span class="stat-tile__icon" aria-hidden="true">
            <AppIcon :name="card.icon" size="sm" />
          </span>
          <span class="stat-tile__label">{{ card.label }}</span>
          <span class="stat-tile__value">{{ formatNumber(card.value) }}</span>
          <span class="stat-tile__shine" aria-hidden="true" />
        </NuxtLink>
      </section>

      <div class="dash__grid">
        <section class="panel dash-rise hover-soft" style="--i: 8">
          <div class="panel__head">
            <h2 class="panel__title">اطلاعیه‌ها</h2>
            <NuxtLink
              v-if="auth.can('announcements.create') || auth.can('announcements.edit')"
              to="/announcements"
              class="panel__link hover-underline"
            >
              مدیریت
            </NuxtLink>
            <NuxtLink v-else to="/announcements" class="panel__link hover-underline">مشاهده</NuxtLink>
          </div>
          <EmptyState
            v-if="!summary.announcements?.length"
            plain
            title="اطلاعیه‌ای نیست"
            message="هنوز اطلاعیه‌ای منتشر نشده است"
            tip="مدیران می‌توانند از منوی «اطلاعیه‌ها» پیام سازمانی بفرستند."
            icon="lucide:megaphone"
          />
          <ul v-else class="feed">
            <li v-for="a in summary.announcements" :key="a.id" class="feed__item hover-row">
              <div class="feed__top">
                <AppIcon v-if="a.isPinned" name="lucide:pin" size="sm" class="feed__pin" />
                <p class="feed__title">{{ a.title }}</p>
              </div>
              <p class="feed__body">{{ a.body }}</p>
            </li>
          </ul>
        </section>

        <section v-if="auth.can('employees.view')" class="panel dash-rise hover-soft" style="--i: 9">
          <div class="panel__head">
            <h2 class="panel__title">سالگرد استخدام</h2>
          </div>
          <EmptyState
            v-if="!summary.hireAnniversaries?.length"
            plain
            title="سالگردی در این ماه نیست"
            message="وقتی تاریخ استخدام کارکنان نزدیک شود اینجا دیده می‌شود"
            tip="تاریخ استخدام را در پرونده هر کارمند کامل کنید."
            icon="lucide:cake"
          />
          <ul v-else class="feed">
            <li v-for="h in summary.hireAnniversaries" :key="h.id" class="feed__item feed__item--row hover-row">
              <NuxtLink :to="`/employees/${h.id}`" class="feed__title hover-underline">{{ h.name }}</NuxtLink>
              <span class="feed__meta">{{ formatDate(h.hireDate) }}</span>
            </li>
          </ul>
        </section>
      </div>

      <section class="dash-rise" style="--i: 10">
        <h2 class="dash__section">دسترسی سریع</h2>
        <div class="quick">
          <NuxtLink
            v-for="(link, idx) in quickLinks.filter((l) => auth.can(l.permission))"
            :key="`${link.to}-${link.desc}`"
            :to="link.to"
            class="quick__card hover-magnetic"
            :style="{ '--i': idx }"
          >
            <span class="quick__icon">
              <AppIcon :name="link.icon" size="md" />
            </span>
            <span class="quick__text">
              <span class="quick__label">{{ link.label }}</span>
              <span class="quick__desc">{{ link.desc }}</span>
            </span>
            <AppIcon name="lucide:arrow-left" size="sm" class="quick__arrow" />
          </NuxtLink>
        </div>
      </section>

      <section class="panel dash-rise hover-soft" style="--i: 11">
        <div class="panel__head">
          <h2 class="panel__title">آخرین اعلان‌ها</h2>
          <NuxtLink to="/notifications" class="panel__link hover-underline">همه</NuxtLink>
        </div>
        <EmptyState
          v-if="!summary.recentNotifications?.length"
          plain
          title="اعلانی نیست"
          message="پیام‌های سیستم و مدیران اینجا نمایش داده می‌شود"
          tip="اعلان‌های جدید با زنگوله بالای صفحه هم مشخص می‌شوند."
          icon="lucide:bell-off"
        />
        <ul v-else class="feed">
          <li v-for="n in summary.recentNotifications" :key="n.id" class="feed__item hover-row">
            <p class="feed__title">{{ n.title }}</p>
            <p class="feed__body">{{ n.body }}</p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dash {
  max-width: 72rem;
}

.dash__intro {
  margin-bottom: 1.75rem;
}

.dash__eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hr-muted);
  margin-bottom: 0.35rem;
}

.dash__title {
  font-size: clamp(1.35rem, 2.2vw, 1.75rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.dash__sub {
  margin-top: 0.35rem;
  font-size: 0.875rem;
  color: var(--hr-muted);
}

.dash__error {
  margin-bottom: 1rem;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background: var(--hr-danger-bg);
  color: var(--hr-danger);
  border: 1px solid var(--hr-danger-border);
}

.dash__section {
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--hr-muted);
}

.dash__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin-bottom: 1.25rem;
}

@media (min-width: 768px) {
  .dash__stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .dash__stats {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
}

.stat-tile {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.95rem 0.9rem;
  border-radius: 1rem;
  background: var(--hr-card);
  border: 1px solid color-mix(in srgb, var(--hr-border) 55%, transparent);
  text-decoration: none;
  color: inherit;
  min-height: 6.2rem;
}

.stat-tile__icon {
  width: 1.75rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.55rem;
  background: var(--hr-primary-50);
  color: var(--hr-primary-700);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), background 0.25s ease;
}

.stat-tile__label {
  font-size: 0.7rem;
  color: var(--hr-muted);
}

.stat-tile__value {
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
}

.stat-tile--ok .stat-tile__value { color: var(--hr-success); }
.stat-tile--warn .stat-tile__value { color: var(--hr-warning); }
.stat-tile--danger .stat-tile__value { color: var(--hr-danger); }

.stat-tile__shine {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 35%,
    color-mix(in srgb, var(--hr-primary) 14%, transparent) 48%,
    transparent 62%
  );
  transform: translateX(120%);
  opacity: 0;
  transition: transform 0.7s ease, opacity 0.35s ease;
}

.stat-tile:hover .stat-tile__shine {
  transform: translateX(-120%);
  opacity: 1;
}

.stat-tile:hover .stat-tile__icon {
  transform: translateY(-2px) scale(1.08);
  background: color-mix(in srgb, var(--hr-primary) 18%, var(--hr-card));
}

.dash__grid {
  display: grid;
  gap: 0.85rem;
  margin-bottom: 1.35rem;
}

@media (min-width: 1024px) {
  .dash__grid {
    grid-template-columns: 1fr 1fr;
  }
}

.panel {
  background: var(--hr-card);
  border: 1px solid color-mix(in srgb, var(--hr-border) 50%, transparent);
  border-radius: 1.1rem;
  padding: 1rem 1.1rem;
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.panel__title {
  font-size: 0.92rem;
  font-weight: 600;
}

.panel__link {
  font-size: 0.75rem;
  color: var(--hr-link);
  text-decoration: none;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.feed__item {
  border-radius: 0.75rem;
  padding: 0.65rem 0.7rem;
  transition: background 0.25s ease, transform 0.25s ease, padding-inline-start 0.25s ease;
}

.feed__item--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.feed__top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.feed__pin {
  color: var(--hr-primary-700);
}

.feed__title {
  font-size: 0.875rem;
  font-weight: 550;
  text-decoration: none;
  color: inherit;
}

.feed__body {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--hr-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed__meta {
  font-size: 0.7rem;
  color: var(--hr-muted);
  white-space: nowrap;
}

.quick {
  display: grid;
  gap: 0.55rem;
  margin-bottom: 1.35rem;
}

@media (min-width: 640px) {
  .quick {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .quick {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.quick__card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.85rem 0.9rem;
  border-radius: 1rem;
  background: var(--hr-card);
  border: 1px solid color-mix(in srgb, var(--hr-border) 50%, transparent);
  text-decoration: none;
  color: inherit;
  overflow: hidden;
}

.quick__icon {
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hr-primary-50);
  color: var(--hr-primary-700);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), background 0.25s ease;
}

.quick__text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.quick__label {
  font-size: 0.85rem;
  font-weight: 600;
}

.quick__desc {
  font-size: 0.7rem;
  color: var(--hr-muted);
}

.quick__arrow {
  opacity: 0;
  transform: translateX(6px);
  color: var(--hr-primary-700);
  transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.quick__card:hover .quick__icon {
  transform: rotate(-8deg) scale(1.08);
  background: color-mix(in srgb, var(--hr-primary) 20%, var(--hr-card));
}

.quick__card:hover .quick__arrow {
  opacity: 1;
  transform: translateX(0);
}

.dash-rise {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: calc(var(--i, 0) * 45ms);
}

.dash--ready .dash-rise {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .dash-rise,
  .stat-tile__shine,
  .stat-tile__icon,
  .quick__icon,
  .quick__arrow {
    transition: none !important;
  }
  .dash-rise {
    opacity: 1;
    transform: none;
  }
}
</style>
