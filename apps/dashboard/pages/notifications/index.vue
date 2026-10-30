<script setup lang="ts">
const notif = useNotificationsStore();
const toast = useToast();
const { formatDate } = useFormat();

onMounted(() => {
  void notif.fetchList();
});

async function onMarkRead(id: string) {
  try {
    await notif.markRead(id);
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

async function onMarkAll() {
  try {
    await notif.markAll();
    toast.success('همه خوانده شد');
  } catch (e: any) {
    toast.error(e?.data?.message || 'خطا');
  }
}

useHead({ title: 'اعلان‌ها' });
</script>

<template>
  <div>
    <UiPageHeader
      eyebrow="ارتباطات"
      title="اعلان‌ها"
      subtitle="به‌صورت لحظه‌ای — بدون نیاز به رفرش"
    >
      <template #actions>
        <span class="live-pill" :class="notif.live ? 'is-on' : 'is-off'">
          <span class="live-pill__dot" />
          {{ notif.live ? 'زنده' : 'آفلاین' }}
        </span>
        <button class="btn-secondary" type="button" @click="onMarkAll">خواندن همه</button>
      </template>
    </UiPageHeader>

    <LoadingSpinner v-if="notif.loading && !notif.items.length" />
    <EmptyState
      v-else-if="!notif.items.length"
      title="اعلانی نیست"
      message="هنوز پیامی برای شما نیامده"
      tip="اعلان‌های جدید همین‌جا و روی زنگوله ظاهر می‌شوند."
      icon="lucide:bell-off"
    />
    <TransitionGroup v-else name="notif" tag="div" class="space-y-2">
      <button
        v-for="n in notif.items"
        :key="n.id"
        type="button"
        class="notif-card card w-full p-4 text-start"
        :class="{ 'is-unread': !n.isRead, 'is-flash': n._flash }"
        @click="onMarkRead(n.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-semibold">{{ n.title }}</p>
            <p class="mt-1 text-sm" style="color: var(--hr-muted)">{{ n.body }}</p>
            <p class="mt-2 text-xs" style="color: var(--hr-muted)">{{ formatDate(n.createdAt) }}</p>
          </div>
          <span v-if="!n.isRead" class="badge badge-info">جدید</span>
        </div>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid color-mix(in srgb, var(--hr-border) 60%, transparent);
}
.live-pill.is-on {
  color: var(--hr-success);
  background: color-mix(in srgb, var(--hr-success) 10%, var(--hr-card));
}
.live-pill.is-off {
  color: var(--hr-muted);
  background: var(--hr-card);
}
.live-pill__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: currentColor;
}
.live-pill.is-on .live-pill__dot {
  box-shadow: 0 0 0 0 currentColor;
  animation: live-pulse 1.6s ease-out infinite;
}

@keyframes live-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--hr-success) 55%, transparent);
  }
  70% {
    box-shadow: 0 0 0 8px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.notif-card {
  transition:
    opacity 0.25s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.35s ease,
    background 0.35s ease;
}
.notif-card.is-unread {
  box-shadow: inset 3px 0 0 var(--hr-btn);
}
.notif-card:not(.is-unread) {
  opacity: 0.72;
}
.notif-card.is-flash {
  background: color-mix(in srgb, var(--hr-primary-50) 80%, var(--hr-card));
  transform: translateY(-2px);
}

.notif-enter-active,
.notif-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.notif-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.notif-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

@media (prefers-reduced-motion: reduce) {
  .live-pill__dot,
  .notif-card,
  .notif-enter-active,
  .notif-leave-active {
    animation: none !important;
    transition: none !important;
  }
}
</style>
